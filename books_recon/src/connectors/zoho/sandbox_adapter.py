"""Sandbox-only Zoho write adapter with hardened normalization semantics."""

from __future__ import annotations

from dataclasses import asdict, dataclass
from decimal import Decimal
from typing import Any, Protocol
from urllib.parse import urlencode
from uuid import UUID

import httpx
from sqlalchemy import select

from core.config import Settings
from db.models.banking import BankAccount, BankTransaction
from db.models.reference import VendorMaster
from db.models.zoho import ZohoSnapshotBill
from db.repositories.proposals import ProposalLineRepository, ProposalRepository
from db.repositories.reference import ZohoAccountMappingRepository, ZohoTaxMappingRepository
from db.repositories.zoho import ZohoSnapshotRepository
from zoho_contracts.service import ZohoContractMapResult


class ZohoUnknownOutcomeError(RuntimeError):
    def __init__(
        self,
        message: str,
        *,
        raw_response: dict[str, Any] | None = None,
        external_correlation_ids: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(message)
        self.raw_response = raw_response or {}
        self.external_correlation_ids = external_correlation_ids or {}


@dataclass(frozen=True)
class ZohoTransportResponse:
    status_code: int
    payload: dict[str, Any]
    headers: dict[str, str]


class ZohoTransport(Protocol):
    def refresh_access_token(self, settings: Settings) -> tuple[str, str]:
        """Return access token and API domain."""

    def send_json(
        self,
        *,
        method: str,
        url: str,
        headers: dict[str, str],
        json_body: dict[str, Any],
    ) -> ZohoTransportResponse:
        """Send JSON request and return a decoded transport response."""

    def get_json(
        self,
        *,
        url: str,
        headers: dict[str, str],
        params: dict[str, Any],
    ) -> ZohoTransportResponse:
        """Send GET request and return a decoded transport response."""


@dataclass(frozen=True)
class NormalizedZohoError:
    code: str
    message: str
    category: str
    field: str | None = None


@dataclass(frozen=True)
class ZohoPreparedRequest:
    module: str
    method: str
    url: str
    headers: dict[str, str]
    body: dict[str, Any]


@dataclass(frozen=True)
class ZohoNormalizedResponse:
    status: str
    external_id: str | None
    raw_response: dict[str, Any]
    normalized_errors: list[dict[str, Any]]
    retryable_flag: bool
    request_dispatched: bool
    external_correlation_ids: dict[str, Any]


@dataclass(frozen=True)
class ZohoLookupResult:
    status: str
    lookup_strategy: str
    raw_response: dict[str, Any]
    matched_external_id: str | None
    matched_external_number: str | None
    correlation_ids: dict[str, Any]


class HttpxZohoTransport:
    def __init__(self, client: httpx.Client | None = None) -> None:
        self.client = client or httpx.Client(timeout=30.0)

    def refresh_access_token(self, settings: Settings) -> tuple[str, str]:
        if not settings.zoho_sandbox_client_id or not settings.zoho_sandbox_client_secret or not settings.zoho_sandbox_refresh_token:
            raise ValueError("Zoho sandbox credentials are incomplete.")
        token_response = self.client.post(
            f"{settings.zoho_sandbox_accounts_url.rstrip('/')}/oauth/v2/token",
            params={
                "grant_type": "refresh_token",
                "client_id": settings.zoho_sandbox_client_id,
                "client_secret": settings.zoho_sandbox_client_secret,
                "refresh_token": settings.zoho_sandbox_refresh_token,
            },
        )
        token_response.raise_for_status()
        payload = token_response.json()
        access_token = payload.get("access_token")
        api_domain = payload.get("api_domain") or settings.zoho_sandbox_api_domain
        if not access_token or not api_domain:
            raise ValueError("Zoho sandbox token response is missing access token or api_domain.")
        return str(access_token), str(api_domain)

    def send_json(
        self,
        *,
        method: str,
        url: str,
        headers: dict[str, str],
        json_body: dict[str, Any],
    ) -> ZohoTransportResponse:
        response = self.client.request(method=method, url=url, headers=headers, json=json_body)
        try:
            payload = response.json()
        except ValueError:
            payload = {"message": response.text}
        return ZohoTransportResponse(
            status_code=response.status_code,
            payload=payload,
            headers={key.lower(): value for key, value in response.headers.items()},
        )

    def get_json(
        self,
        *,
        url: str,
        headers: dict[str, str],
        params: dict[str, Any],
    ) -> ZohoTransportResponse:
        response = self.client.get(url=url, headers=headers, params=params)
        try:
            payload = response.json()
        except ValueError:
            payload = {"message": response.text}
        return ZohoTransportResponse(
            status_code=response.status_code,
            payload=payload,
            headers={key.lower(): value for key, value in response.headers.items()},
        )


class ZohoSandboxAdapter:
    SUPPORTED_MODULES = {"vendorpayments", "bills"}

    def __init__(
        self,
        *,
        settings: Settings,
        proposal_repository: ProposalRepository,
        proposal_line_repository: ProposalLineRepository,
        zoho_account_mapping_repository: ZohoAccountMappingRepository | None = None,
        zoho_tax_mapping_repository: ZohoTaxMappingRepository | None = None,
        zoho_snapshot_repository: ZohoSnapshotRepository | None = None,
        transport: ZohoTransport | None = None,
    ) -> None:
        self.settings = settings
        self.proposal_repository = proposal_repository
        self.proposal_line_repository = proposal_line_repository
        self.zoho_account_mapping_repository = zoho_account_mapping_repository
        self.zoho_tax_mapping_repository = zoho_tax_mapping_repository
        self.zoho_snapshot_repository = zoho_snapshot_repository or ZohoSnapshotRepository(proposal_repository.session)
        self.transport = transport or HttpxZohoTransport()

    def execute(
        self,
        *,
        proposal_id,
        contract: ZohoContractMapResult,
        idempotency_key: str,
        request_hash: str,
    ) -> tuple[ZohoPreparedRequest, ZohoNormalizedResponse]:
        prepared: ZohoPreparedRequest | None = None
        try:
            prepared = self.build_request(
                proposal_id=proposal_id,
                contract=contract,
                idempotency_key=idempotency_key,
                request_hash=request_hash,
            )
            access_token, _ = self.transport.refresh_access_token(self.settings)
            response = self.transport.send_json(
                method=prepared.method,
                url=prepared.url,
                headers={
                    **prepared.headers,
                    "Authorization": f"Zoho-oauthtoken {access_token}",
                    "content-type": "application/json",
                },
                json_body=prepared.body,
            )
        except ValueError as exc:
            return (prepared or self._fallback_request(contract, idempotency_key, request_hash)), self._normalize_exception(
                exc,
                category="request_build_error",
                retryable=False,
                request_dispatched=False,
            )
        except ZohoUnknownOutcomeError as exc:
            return (prepared or self._fallback_request(contract, idempotency_key, request_hash)), self._normalize_unknown_outcome(exc)
        except (httpx.NetworkError, httpx.TimeoutException) as exc:
            return (prepared or self._fallback_request(contract, idempotency_key, request_hash)), self._normalize_exception(
                exc,
                category="network_error",
                retryable=True,
                request_dispatched=False,
            )
        except httpx.HTTPError as exc:
            return (prepared or self._fallback_request(contract, idempotency_key, request_hash)), self._normalize_exception(
                exc,
                category="http_client_error",
                retryable=False,
                request_dispatched=False,
            )
        return prepared, self._normalize_http_response(contract.target_module, response)

    def build_request(
        self,
        *,
        proposal_id,
        contract: ZohoContractMapResult,
        idempotency_key: str,
        request_hash: str,
    ) -> ZohoPreparedRequest:
        if contract.target_module not in self.SUPPORTED_MODULES:
            raise ValueError(f"Unsupported Zoho sandbox module: {contract.target_module}")
        if not self.settings.zoho_sandbox_enabled:
            raise ValueError("Zoho sandbox execution is disabled.")
        if not self.settings.zoho_sandbox_org_id:
            raise ValueError("Zoho sandbox organization id is not configured.")
        api_domain = (self.settings.zoho_sandbox_api_domain or "https://www.zohoapis.com").rstrip("/")
        query = urlencode({"organization_id": self.settings.zoho_sandbox_org_id})
        if contract.target_module == "bills":
            body = self._build_bill_body(proposal_id=proposal_id, idempotency_key=idempotency_key)
        else:
            body = self._build_vendor_payment_body(
                proposal_id=proposal_id,
                contract=contract,
                idempotency_key=idempotency_key,
                request_hash=request_hash,
            )
        return ZohoPreparedRequest(
            module=contract.target_module,
            method="POST",
            url=f"{api_domain}/books/v3/{contract.target_module}?{query}",
            headers={
                "X-Books-Recon-Idempotency-Key": idempotency_key,
                "X-Books-Recon-Request-Hash": request_hash,
            },
            body=body,
        )

    def build_lookup_keys(self, *, contract: ZohoContractMapResult, prepared_request: ZohoPreparedRequest) -> dict[str, Any]:
        body = prepared_request.body
        if contract.target_module == "bills":
            return {
                "reference_number": body.get("reference_number"),
                "bill_number": body.get("bill_number"),
                "vendor_id": body.get("vendor_id"),
            }
        if contract.target_module == "vendorpayments":
            bills = body.get("bills") or []
            first_bill = bills[0] if bills else {}
            return {
                "reference_number": body.get("reference_number"),
                "vendor_id": body.get("vendor_id"),
                "amount": body.get("amount"),
                "bill_id": first_bill.get("bill_id"),
                "date": body.get("date"),
            }
        return {}

    def lookup_existing(
        self,
        *,
        target_module: str,
        environment: str,
        lookup_keys: dict[str, Any],
        request_correlation: dict[str, Any] | None = None,
    ) -> ZohoLookupResult:
        if environment != "sandbox":
            raise ValueError(f"Unsupported environment for sandbox lookup: {environment}")
        if target_module not in self.SUPPORTED_MODULES:
            raise ValueError(f"Unsupported Zoho sandbox lookup module: {target_module}")
        if not self.settings.zoho_sandbox_enabled:
            raise ValueError("Zoho sandbox execution is disabled.")
        if not self.settings.zoho_sandbox_org_id:
            raise ValueError("Zoho sandbox organization id is not configured.")

        api_domain = (self.settings.zoho_sandbox_api_domain or "https://www.zohoapis.com").rstrip("/")
        access_token, _ = self.transport.refresh_access_token(self.settings)
        params = {
            "organization_id": self.settings.zoho_sandbox_org_id,
            **{key: value for key, value in lookup_keys.items() if value is not None},
        }
        response = self.transport.get_json(
            url=f"{api_domain}/books/v3/{target_module}",
            headers={"Authorization": f"Zoho-oauthtoken {access_token}"},
            params=params,
        )
        correlation_ids = self._correlation_ids(response.headers, response.payload)
        payload = response.payload
        if response.status_code >= 500:
            return ZohoLookupResult(
                status="lookup_error",
                lookup_strategy="query_by_reference",
                raw_response={"http_status": response.status_code, "body": payload, "headers": response.headers},
                matched_external_id=None,
                matched_external_number=None,
                correlation_ids=correlation_ids,
            )
        records = self._extract_lookup_records(target_module, payload)
        if len(records) > 1:
            return ZohoLookupResult(
                status="ambiguous",
                lookup_strategy="query_by_reference",
                raw_response={"http_status": response.status_code, "body": payload, "headers": response.headers},
                matched_external_id=None,
                matched_external_number=None,
                correlation_ids={**(request_correlation or {}), **correlation_ids},
            )
        if not records:
            return ZohoLookupResult(
                status="not_found",
                lookup_strategy="query_by_reference",
                raw_response={"http_status": response.status_code, "body": payload, "headers": response.headers},
                matched_external_id=None,
                matched_external_number=None,
                correlation_ids={**(request_correlation or {}), **correlation_ids},
            )
        record = records[0]
        return ZohoLookupResult(
            status="matched",
            lookup_strategy="query_by_reference",
            raw_response={"http_status": response.status_code, "body": payload, "headers": response.headers},
            matched_external_id=self._lookup_external_id(target_module, record),
            matched_external_number=self._lookup_external_number(target_module, record),
            correlation_ids={**(request_correlation or {}), **correlation_ids},
        )

    def _build_bill_body(self, *, proposal_id, idempotency_key: str) -> dict[str, Any]:
        proposal = self.proposal_repository.get(proposal_id)
        if proposal is None:
            raise ValueError(f"Unknown proposal_id: {proposal_id}")
        lines = self.proposal_line_repository.list_for_proposal(proposal_id)
        header_line = next((line for line in lines if line.action_type == "create_vendor_bill"), None)
        if header_line is None or header_line.vendor_master_id is None:
            raise ValueError("Bill proposal is missing resolved vendor header.")
        vendor = self.proposal_repository.session.get(VendorMaster, header_line.vendor_master_id)
        if vendor is None or not vendor.zoho_contact_id:
            raise ValueError("Resolved vendor is missing zoho_contact_id for sandbox execution.")

        line_items: list[dict[str, Any]] = []
        for line in lines:
            if line.action_type not in {"expense_placeholder", "tax_placeholder"}:
                continue
            if line.account_master_id is None:
                raise ValueError(f"Proposal line {line.line_no} is missing account_master_id.")
            account_mapping = self._require_account_mapping(account_master_id=str(line.account_master_id), target_module="bills")
            item = {
                "account_id": account_mapping.zoho_account_id,
                "description": line.description,
                "quantity": 1,
                "rate": float(Decimal(str(line.amount))),
            }
            if line.action_type == "tax_placeholder":
                tax_mapping = self._require_tax_mapping(
                    tax_code=str(line.tax_code),
                    account_master_id=str(line.account_master_id),
                    target_module="bills",
                )
                item["tax_id"] = tax_mapping.zoho_tax_id
            line_items.append(item)
        if not line_items:
            raise ValueError("Bill proposal did not yield any Zoho bill line_items.")

        invoice_meta = header_line.allocation_json or {}
        if not invoice_meta.get("invoice_number"):
            raise ValueError("Bill proposal is missing invoice_number in header allocation metadata.")
        if not invoice_meta.get("invoice_date"):
            raise ValueError("Bill proposal is missing invoice_date in header allocation metadata.")

        return {
            "vendor_id": vendor.zoho_contact_id,
            "bill_number": invoice_meta["invoice_number"],
            "reference_number": str(idempotency_key),
            "date": invoice_meta["invoice_date"],
            "line_items": line_items,
        }

    def _build_vendor_payment_body(
        self,
        *,
        proposal_id,
        contract: ZohoContractMapResult,
        idempotency_key: str,
        request_hash: str,
    ) -> dict[str, Any]:
        proposal = self.proposal_repository.get(proposal_id)
        if proposal is None:
            raise ValueError(f"Unknown proposal_id: {proposal_id}")
        lines = self.proposal_line_repository.list_for_proposal(proposal_id)
        apply_line = next((line for line in lines if line.action_type == "apply_bill"), None)
        if apply_line is None or not apply_line.zoho_target_object_ref:
            raise ValueError("Vendor payment proposal is missing Zoho bill reference.")
        bill = self.zoho_snapshot_repository.resolve_eligible("bill", str(apply_line.zoho_target_object_ref))
        if bill is None:
            eligibility = self.zoho_snapshot_repository.evaluate_ref("bill", apply_line.zoho_target_object_ref)
            raise ValueError(
                f"Eligible Zoho snapshot bill not found for reference {apply_line.zoho_target_object_ref}. "
                f"Reasons: {', '.join(eligibility.reasons)}"
            )

        allocation = apply_line.allocation_json or {}
        transaction_id = allocation.get("bank_transaction_id")
        transaction = self.proposal_repository.session.get(BankTransaction, self._coerce_uuid(transaction_id)) if transaction_id else None
        if transaction is None:
            raise ValueError("Vendor payment proposal is missing bank transaction context.")
        bank_account = self.proposal_repository.session.get(BankAccount, transaction.bank_account_id)
        paid_through_account_id = None
        if bank_account is not None:
            paid_through_account_id = (bank_account.metadata_json or {}).get("zoho_paid_through_account_id")
        paid_through_account_id = paid_through_account_id or self.settings.zoho_sandbox_paid_through_account_id
        if not paid_through_account_id:
            raise ValueError("Sandbox paid_through_account_id is not configured.")

        amount_applied = allocation.get("settlement_amount") or contract.contract_payload.get("amount")
        return {
            "vendor_id": bill.vendor_id,
            "amount": float(Decimal(str(contract.contract_payload.get("amount")))),
            "date": transaction.transaction_date.isoformat(),
            "paid_through_account_id": str(paid_through_account_id),
            "reference_number": transaction.bank_reference or str(idempotency_key),
            "description": f"books_recon sandbox execution {request_hash[:12]}",
            "bills": [
                {
                    "bill_id": bill.zoho_object_id,
                    "amount_applied": float(Decimal(str(amount_applied))),
                }
            ],
        }

    def _require_account_mapping(self, *, account_master_id: str, target_module: str) -> Any:
        if self.zoho_account_mapping_repository is None:
            raise ValueError("Zoho account mapping registry is not configured.")
        mapping = self.zoho_account_mapping_repository.find_active_mapping(
            account_master_id=account_master_id,
            environment="sandbox",
            target_system="zoho_books",
            target_module=target_module,
        )
        if mapping is None:
            raise ValueError(
                f"Account mapping for account_master_id {account_master_id} is missing from the sandbox Zoho registry."
            )
        return mapping

    def _require_tax_mapping(self, *, tax_code: str, account_master_id: str | None, target_module: str) -> Any:
        if self.zoho_tax_mapping_repository is None:
            raise ValueError("Zoho tax mapping registry is not configured.")
        mapping = self.zoho_tax_mapping_repository.find_active_mapping(
            tax_code=tax_code,
            environment="sandbox",
            target_system="zoho_books",
            target_module=target_module,
            account_master_id=account_master_id,
        )
        if mapping is None:
            raise ValueError(
                f"Tax mapping for tax_code {tax_code!r} is missing from the sandbox Zoho registry."
            )
        return mapping

    def _normalize_http_response(self, module: str, response: ZohoTransportResponse) -> ZohoNormalizedResponse:
        retryable = response.status_code >= 500
        payload = response.payload
        zoho_code = payload.get("code")
        correlation_ids = self._correlation_ids(response.headers, payload)
        if 200 <= response.status_code < 300 and (zoho_code in (0, "0", None)):
            return ZohoNormalizedResponse(
                status="success",
                external_id=self._extract_external_id(module, payload),
                raw_response={"http_status": response.status_code, "body": payload, "headers": response.headers},
                normalized_errors=[],
                retryable_flag=False,
                request_dispatched=True,
                external_correlation_ids=correlation_ids,
            )

        category = "server_error" if retryable else "validation_error"
        message = str(payload.get("message") or "Zoho API request failed.")
        errors = [asdict(NormalizedZohoError(code=str(zoho_code or response.status_code), message=message, category=category))]
        return ZohoNormalizedResponse(
            status="retryable_failure" if retryable else "failure",
            external_id=self._extract_external_id(module, payload),
            raw_response={"http_status": response.status_code, "body": payload, "headers": response.headers},
            normalized_errors=errors,
            retryable_flag=retryable,
            request_dispatched=True,
            external_correlation_ids=correlation_ids,
        )

    def _normalize_exception(
        self,
        exc: Exception,
        *,
        category: str,
        retryable: bool,
        request_dispatched: bool,
    ) -> ZohoNormalizedResponse:
        return ZohoNormalizedResponse(
            status="retryable_failure" if retryable else "failure",
            external_id=None,
            raw_response={"exception_type": exc.__class__.__name__, "message": str(exc)},
            normalized_errors=[asdict(NormalizedZohoError(code=exc.__class__.__name__, message=str(exc), category=category))],
            retryable_flag=retryable,
            request_dispatched=request_dispatched,
            external_correlation_ids={},
        )

    def _normalize_unknown_outcome(self, exc: ZohoUnknownOutcomeError) -> ZohoNormalizedResponse:
        return ZohoNormalizedResponse(
            status="unknown_outcome",
            external_id=None,
            raw_response={
                "exception_type": exc.__class__.__name__,
                "message": str(exc),
                "raw_response": exc.raw_response,
            },
            normalized_errors=[
                asdict(
                    NormalizedZohoError(
                        code="unknown_outcome",
                        message=str(exc),
                        category="unknown_outcome",
                    )
                )
            ],
            retryable_flag=False,
            request_dispatched=True,
            external_correlation_ids=exc.external_correlation_ids,
        )

    def _extract_external_id(self, module: str, payload: dict[str, Any]) -> str | None:
        if module == "bills":
            bill = payload.get("bill") or {}
            return bill.get("bill_id")
        if module == "vendorpayments":
            return payload.get("payment_id") or (payload.get("vendorpayment") or {}).get("payment_id")
        return None

    def _correlation_ids(self, headers: dict[str, str], payload: dict[str, Any]) -> dict[str, Any]:
        correlation_ids: dict[str, Any] = {}
        for header_name in ("x-request-id", "x-correlation-id"):
            if header_name in headers:
                correlation_ids[header_name] = headers[header_name]
        if "request_id" in payload:
            correlation_ids["request_id"] = payload["request_id"]
        return correlation_ids

    def _extract_lookup_records(self, module: str, payload: dict[str, Any]) -> list[dict[str, Any]]:
        if module == "bills":
            bills = payload.get("bills")
            if isinstance(bills, list):
                return [item for item in bills if isinstance(item, dict)]
            bill = payload.get("bill")
            if isinstance(bill, dict):
                return [bill]
            return []
        if module == "vendorpayments":
            payments = payload.get("vendorpayments")
            if isinstance(payments, list):
                return [item for item in payments if isinstance(item, dict)]
            payment = payload.get("vendorpayment")
            if isinstance(payment, dict):
                return [payment]
            if payload.get("payment_id"):
                return [payload]
            return []
        return []

    def _lookup_external_id(self, module: str, record: dict[str, Any]) -> str | None:
        if module == "bills":
            return record.get("bill_id")
        if module == "vendorpayments":
            return record.get("payment_id")
        return None

    def _lookup_external_number(self, module: str, record: dict[str, Any]) -> str | None:
        if module == "bills":
            return record.get("bill_number") or record.get("reference_number")
        if module == "vendorpayments":
            return record.get("payment_number") or record.get("reference_number")
        return None

    def _coerce_uuid(self, value):
        try:
            return UUID(str(value))
        except (TypeError, ValueError, AttributeError):
            return value

    def _fallback_request(self, contract: ZohoContractMapResult, idempotency_key: str, request_hash: str) -> ZohoPreparedRequest:
        return ZohoPreparedRequest(
            module=contract.target_module,
            method="POST",
            url="",
            headers={
                "X-Books-Recon-Idempotency-Key": idempotency_key,
                "X-Books-Recon-Request-Hash": request_hash,
            },
            body={},
        )
