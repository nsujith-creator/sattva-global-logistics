"""Typed Zoho contract mapping for supported dry-run proposal types."""

from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any

from preflight.service import DryRunPayload, PreflightResult


@dataclass(frozen=True)
class ContractValidationResult:
    is_valid: bool
    required_fields: list[str]
    missing_fields: list[str]
    unresolved_placeholders: list[dict[str, Any]]
    validation_messages: list[str]


@dataclass(frozen=True)
class ZohoContractMapResult:
    proposal_id: str
    proposal_type: str
    target_system: str
    target_module: str
    contract_version: str
    mapper_input_schema: dict[str, Any]
    mapper_output_schema: dict[str, Any]
    required_fields: list[str]
    unresolved_placeholders: list[dict[str, Any]]
    validation_result: ContractValidationResult
    contract_payload: dict[str, Any]


class ZohoContractMapperService:
    CONTRACT_VERSION = "zoho.contract.v1"

    def map_dry_run_payload(self, payload: DryRunPayload) -> ZohoContractMapResult:
        if payload.proposal_type == "vendor_payment_apply":
            return self._map_vendor_payment_apply(payload)
        if payload.proposal_type == "vendor_bill_create":
            return self._map_vendor_bill_create(payload)
        validation = ContractValidationResult(
            is_valid=False,
            required_fields=[],
            missing_fields=["proposal_type"],
            unresolved_placeholders=[],
            validation_messages=[f"Unsupported proposal type: {payload.proposal_type}"],
        )
        return ZohoContractMapResult(
            proposal_id=payload.proposal_id,
            proposal_type=payload.proposal_type,
            target_system=payload.target_system,
            target_module=payload.target_module,
            contract_version=self.CONTRACT_VERSION,
            mapper_input_schema={"source": "preflight_dry_run_payload"},
            mapper_output_schema={"target": "zoho_unsupported"},
            required_fields=[],
            unresolved_placeholders=[],
            validation_result=validation,
            contract_payload={},
        )

    def _map_vendor_payment_apply(self, payload: DryRunPayload) -> ZohoContractMapResult:
        allocation = payload.payload_body["bill_allocation"]
        residual = payload.payload_body["residual_handling"]
        required_fields = ["bill_external_ref", "allocation_details.bill_number", "amount"]
        missing = []
        if not allocation.get("bill_external_ref"):
            missing.append("bill_external_ref")
        if not allocation.get("allocation_details", {}).get("bill_number"):
            missing.append("allocation_details.bill_number")
        if not allocation.get("amount"):
            missing.append("amount")
        unresolved = []
        if residual.get("present") and not residual.get("resolved"):
            unresolved.append({"placeholder": "residual_handling", "details": residual})

        validation = ContractValidationResult(
            is_valid=payload.preflight_status == "ready" and not missing and not unresolved,
            required_fields=required_fields,
            missing_fields=missing,
            unresolved_placeholders=unresolved,
            validation_messages=[] if not missing and not unresolved else ["Contract has unresolved required payment fields."],
        )
        contract_payload = {
            "module": "vendorpayments",
            "contract_type": "apply_existing_bill_payment",
            "payment_reference": allocation["allocation_details"].get("bank_transaction_id"),
            "bill_reference": allocation["bill_external_ref"],
            "amount": allocation["amount"],
            "allocations": [
                {
                    "bill_number": allocation["allocation_details"].get("bill_number"),
                    "settlement_amount": allocation["allocation_details"].get("settlement_amount"),
                }
            ],
            "residual_state": residual,
        }
        return ZohoContractMapResult(
            proposal_id=payload.proposal_id,
            proposal_type=payload.proposal_type,
            target_system=payload.target_system,
            target_module="vendorpayments",
            contract_version=self.CONTRACT_VERSION,
            mapper_input_schema={"payload_version": payload.payload_version, "proposal_type": payload.proposal_type},
            mapper_output_schema={"module": "vendorpayments", "fields": ["payment_reference", "bill_reference", "amount", "allocations"]},
            required_fields=required_fields,
            unresolved_placeholders=unresolved,
            validation_result=validation,
            contract_payload=contract_payload,
        )

    def _map_vendor_bill_create(self, payload: DryRunPayload) -> ZohoContractMapResult:
        bill_header = payload.payload_body["bill_header"]
        bill_lines = payload.payload_body["bill_lines"]
        placeholder_state = payload.payload_body["placeholder_state"]
        required_fields = ["bill_header.target_period_date", "bill_header.gross_amount", "vendor_master_id"]
        missing = []
        if not bill_header.get("target_period_date"):
            missing.append("bill_header.target_period_date")
        if not bill_header.get("gross_amount"):
            missing.append("bill_header.gross_amount")
        if not any(line.get("vendor_master_id") for line in bill_lines):
            missing.append("vendor_master_id")

        unresolved = [
            {
                "line_no": item["line_no"],
                "action_type": item["action_type"],
                "reason": item["review_reason_code"],
            }
            for item in placeholder_state["unresolved_placeholders"]
        ]
        validation = ContractValidationResult(
            is_valid=payload.preflight_status == "ready" and not missing and not unresolved,
            required_fields=required_fields,
            missing_fields=missing,
            unresolved_placeholders=unresolved,
            validation_messages=[] if not missing and not unresolved else ["Bill contract still contains unresolved placeholders."],
        )
        contract_payload = {
            "module": "bills",
            "contract_type": "create_vendor_bill",
            "bill_header": bill_header,
            "bill_lines": [
                {
                    "line_no": line["line_no"],
                    "description": line["description"],
                    "amount": line["amount"],
                    "vendor_master_id": line["vendor_master_id"],
                    "account_master_id": line["account_master_id"],
                    "tax_code": line["tax_code"],
                }
                for line in bill_lines
            ],
            "placeholder_state": placeholder_state,
        }
        return ZohoContractMapResult(
            proposal_id=payload.proposal_id,
            proposal_type=payload.proposal_type,
            target_system=payload.target_system,
            target_module="bills",
            contract_version=self.CONTRACT_VERSION,
            mapper_input_schema={"payload_version": payload.payload_version, "proposal_type": payload.proposal_type},
            mapper_output_schema={"module": "bills", "fields": ["bill_header", "bill_lines", "placeholder_state"]},
            required_fields=required_fields,
            unresolved_placeholders=unresolved,
            validation_result=validation,
            contract_payload=contract_payload,
        )

    def as_dict(self, result: ZohoContractMapResult) -> dict[str, Any]:
        return asdict(result)
