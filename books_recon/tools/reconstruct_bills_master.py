from __future__ import annotations

import argparse
import csv
import re
from dataclasses import dataclass
from datetime import datetime, date
from decimal import Decimal, InvalidOperation
from pathlib import Path


INPUT_DATE_FORMATS = ("%d/%m/%Y", "%Y-%m-%d", "%d-%m-%Y", "%m/%d/%Y")
FY_CUTOFF = date(2025, 12, 31)

INTERCHANGEABLE_PARTIES = (
    "FACEBOOK",
    "ZOHO",
    "MOONSTONE VENTURES",
    "SUPERWELL COMTRADE",
    "SSO SOLUTIONS",
    "KAPPAL",
    "ANTHROPIC",
)
INTERCHANGEABLE_KEYWORDS = (
    "GSTR",
    "GST",
    "INCOME TAX",
)
KOTAK_KEYWORD = "KOTAK MULTILINK"


def normalize_header(value: str) -> str:
    text = (value or "").strip().replace("#", " number ")
    text = re.sub(r"[^A-Za-z0-9]+", "_", text)
    text = re.sub(r"_+", "_", text).strip("_")
    return text.lower()


def normalize_party_name(value: str) -> str:
    text = re.sub(r"\s+", " ", (value or "").strip().upper())
    return text


def clean_currency(value: str) -> Decimal | None:
    text = (value or "").strip()
    if not text:
        return None
    text = text.replace("₹", "").replace("â‚¹", "").replace(",", "").strip()
    text = re.sub(r"[^\d.\-]", "", text)
    if not text:
        return None
    try:
        return Decimal(text)
    except InvalidOperation:
        return None


def parse_document_date(value: str) -> date | None:
    text = (value or "").strip()
    if not text:
        return None
    for fmt in INPUT_DATE_FORMATS:
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            continue
    return None


def decimal_to_str(value: Decimal | None) -> str:
    if value is None:
        return ""
    return f"{value.quantize(Decimal('0.01'))}"


def date_to_str(value: date | None) -> str:
    if value is None:
        return ""
    return value.isoformat()


def fiscal_year_for(value: date | None) -> str:
    if value is None:
        return ""
    if value.month >= 4:
        return f"FY {value.year}-{str(value.year + 1)[-2:]}"
    return f"FY {value.year - 1}-{str(value.year)[-2:]}"


def is_interchangeable_party(party_name: str) -> bool:
    return any(keyword in party_name for keyword in INTERCHANGEABLE_PARTIES)


def has_interchangeable_keyword(*values: str) -> bool:
    haystack = " ".join(values)
    return any(keyword in haystack for keyword in INTERCHANGEABLE_KEYWORDS)


@dataclass
class ReconstructionRow:
    source_row: dict[str, str]
    party_name_normalized: str
    document_type: str
    document_date: date | None
    clean_total_amount: Decimal | None
    clean_balance_due: Decimal | None
    fiscal_year: str
    pre_dec2025_flag: str
    interchangeable_party_flag: str
    kotak_exception_flag: str
    expected_status_by_management_rule: str
    reconstructed_status: str
    proof_status: str
    assumption_flag: str
    exception_level: str
    recommended_zoho_action: str
    notes: str

    def to_output_row(self, output_headers: list[str]) -> dict[str, str]:
        base = dict(self.source_row)
        base.update(
            {
                "Party_Name_Normalized": self.party_name_normalized,
                "Document_Type": self.document_type,
                "Document_Date": date_to_str(self.document_date),
                "Clean_Total_Amount": decimal_to_str(self.clean_total_amount),
                "Clean_Balance_Due": decimal_to_str(self.clean_balance_due),
                "Fiscal_Year": self.fiscal_year,
                "Pre_Dec2025_Flag": self.pre_dec2025_flag,
                "Interchangeable_Party_Flag": self.interchangeable_party_flag,
                "Kotak_Exception_Flag": self.kotak_exception_flag,
                "Expected_Status_By_Management_Rule": self.expected_status_by_management_rule,
                "Reconstructed_Status": self.reconstructed_status,
                "Proof_Status": self.proof_status,
                "Assumption_Flag": self.assumption_flag,
                "Exception_Level": self.exception_level,
                "Recommended_Zoho_Action": self.recommended_zoho_action,
                "Notes": self.notes,
            }
        )
        return {header: base.get(header, "") for header in output_headers}


def classify_document_type(row: dict[str, str], party_name_normalized: str) -> str:
    normalized_keys = {normalize_header(key) for key in row}
    if "bill_id" in normalized_keys or "bill_number" in normalized_keys or "vendor_name" in normalized_keys:
        if party_name_normalized:
            return "VENDOR_BILL"
    if "invoice_id" in normalized_keys or "customer_name" in normalized_keys:
        return "CUSTOMER_INVOICE"
    return "UNKNOWN"


def reconstruct_row(row: dict[str, str]) -> ReconstructionRow:
    source = {key.strip(): (value or "").strip() for key, value in row.items()}
    party_name = source.get("Vendor Name") or source.get("Customer Name") or ""
    bill_number = source.get("Bill#", "")
    reference_number = source.get("Reference Number", "")
    status = normalize_party_name(source.get("Status", ""))
    party_name_normalized = normalize_party_name(party_name)
    document_date = parse_document_date(source.get("Date", ""))
    clean_total_amount = clean_currency(source.get("Amount", ""))
    parsed_balance_due = clean_currency(source.get("Balance Due", ""))
    clean_balance_due = parsed_balance_due if parsed_balance_due is not None else Decimal("0")

    document_type = classify_document_type(source, party_name_normalized)
    fiscal_year = fiscal_year_for(document_date)
    pre_dec2025_flag = "YES" if document_date and document_date <= FY_CUTOFF else "NO"
    interchangeable_party_flag = "YES" if (
        is_interchangeable_party(party_name_normalized)
        or has_interchangeable_keyword(party_name_normalized, bill_number.upper(), reference_number.upper())
    ) else "NO"
    kotak_exception_flag = "YES" if KOTAK_KEYWORD in party_name_normalized else "NO"
    is_open = clean_balance_due > Decimal("0")

    expected_status = "MANUAL_REVIEW"
    reconstructed_status = "OPEN_IN_BOOKS"
    proof_status = "NOT_PROVEN"
    assumption_flag = "NO"
    exception_level = "NONE"
    recommended_action = "NO_ACTION"
    notes: list[str] = []

    if document_type == "UNKNOWN":
        expected_status = "MANUAL_REVIEW"
        reconstructed_status = "UNKNOWN_DOCUMENT_TYPE"
        proof_status = "NOT_PROVEN"
        assumption_flag = "NO"
        exception_level = "CRITICAL_REVIEW"
        recommended_action = "MANUAL_REVIEW_REQUIRED"
        notes.append("Document type not reliably derivable from source columns.")
    elif document_type == "CUSTOMER_INVOICE":
        expected_status = "FULLY_RECEIVED" if pre_dec2025_flag == "YES" else "STATUS_BY_EVIDENCE"
        if is_open and pre_dec2025_flag == "YES":
            reconstructed_status = "BOOKKEEPING_MISMATCH_RECEIVABLE"
            proof_status = "NOT_PROVEN"
            exception_level = "MAJOR_EXCEPTION"
            recommended_action = "CLEAR_RECEIVABLE_AGAINST_BANK_RECEIPT"
            notes.append("Management rule says all client invoices up to 2025-12-31 are fully collected.")
        elif is_open:
            reconstructed_status = "OPEN_RECEIVABLE_POST_CUTOFF"
            proof_status = "NOT_PROVEN"
            exception_level = "MINOR_VARIANCE"
            recommended_action = "VERIFY_BANK_MATCH_3326"
            notes.append("Open customer invoice falls after management cutoff.")
        else:
            reconstructed_status = "FULLY_RECEIVED"
            proof_status = "PROVEN_BY_BOOKS"
            exception_level = "NONE"
            recommended_action = "NO_ACTION"
    else:
        if pre_dec2025_flag == "YES" and kotak_exception_flag == "YES":
            expected_status = "PAYABLE_ALLOWED_EXCEPTION"
        elif pre_dec2025_flag == "YES":
            expected_status = "FULLY_PAID"
        else:
            expected_status = "STATUS_BY_EVIDENCE"

        if not is_open:
            reconstructed_status = "FULLY_PAID"
            proof_status = "PROVEN_BY_BOOKS"
            exception_level = "NONE"
            recommended_action = "NO_ACTION"
        elif pre_dec2025_flag == "YES" and kotak_exception_flag == "YES":
            reconstructed_status = "OPEN_KOTAK_EXCEPTION"
            proof_status = "NOT_PROVEN"
            exception_level = "NONE"
            recommended_action = "RETAIN_AS_GENUINE_PAYABLE"
            notes.append("Kotak Multilink is the only allowed unpaid vendor exception per management rule.")
        elif pre_dec2025_flag == "YES" and interchangeable_party_flag == "YES":
            reconstructed_status = "ASSUMED_PAID_PERSONAL"
            proof_status = "ASSUMED_BY_RULE"
            assumption_flag = "YES"
            exception_level = "MAJOR_EXCEPTION"
            recommended_action = "CLEAR_VENDOR_BY_OWNER_FUNDING_OR_DRAWINGS_ENTRY"
            notes.append("Open interchangeable-party bill assumed cleared from personal account under management rule.")
            notes.append("Assumption only; no bank proof in this file.")
        elif pre_dec2025_flag == "YES":
            reconstructed_status = "BOOKKEEPING_MISMATCH_PAYABLE"
            proof_status = "NOT_PROVEN"
            exception_level = "MAJOR_EXCEPTION"
            recommended_action = "VERIFY_BANK_MATCH_3326"
            notes.append("Management rule says all vendor bills up to 2025-12-31 are fully cleared except Kotak Multilink.")
        else:
            reconstructed_status = "OPEN_VENDOR_POST_CUTOFF"
            proof_status = "NOT_PROVEN"
            exception_level = "MINOR_VARIANCE"
            recommended_action = "MANUAL_REVIEW_REQUIRED"
            notes.append("Open vendor bill falls after management cutoff.")

    if clean_total_amount is None:
        exception_level = "CRITICAL_REVIEW"
        recommended_action = "MANUAL_REVIEW_REQUIRED"
        proof_status = "NOT_PROVEN"
        notes.append("Total amount could not be parsed safely.")
    if document_date is None:
        exception_level = "CRITICAL_REVIEW"
        recommended_action = "MANUAL_REVIEW_REQUIRED"
        proof_status = "NOT_PROVEN"
        notes.append("Document date could not be parsed safely.")
    if parsed_balance_due is None:
        exception_level = "CRITICAL_REVIEW"
        recommended_action = "MANUAL_REVIEW_REQUIRED"
        proof_status = "NOT_PROVEN"
        notes.append("Balance due could not be parsed safely.")
    if status == "PARTIALLY PAID" and exception_level == "NONE":
        exception_level = "MINOR_VARIANCE"
        notes.append("Books show partially paid status.")

    return ReconstructionRow(
        source_row=source,
        party_name_normalized=party_name_normalized,
        document_type=document_type,
        document_date=document_date,
        clean_total_amount=clean_total_amount,
        clean_balance_due=clean_balance_due,
        fiscal_year=fiscal_year,
        pre_dec2025_flag=pre_dec2025_flag,
        interchangeable_party_flag=interchangeable_party_flag,
        kotak_exception_flag=kotak_exception_flag,
        expected_status_by_management_rule=expected_status,
        reconstructed_status=reconstructed_status,
        proof_status=proof_status,
        assumption_flag=assumption_flag,
        exception_level=exception_level,
        recommended_zoho_action=recommended_action,
        notes=" | ".join(dict.fromkeys(note for note in notes if note)),
    )


def write_csv(path: Path, rows: list[dict[str, str]], headers: list[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8-sig") as handle:
        writer = csv.DictWriter(handle, fieldnames=headers)
        writer.writeheader()
        writer.writerows(rows)


def build_summary(rows: list[ReconstructionRow]) -> list[dict[str, str]]:
    vendor_rows = [row for row in rows if row.document_type == "VENDOR_BILL"]
    customer_rows = [row for row in rows if row.document_type == "CUSTOMER_INVOICE"]
    open_vendor_rows = [row for row in vendor_rows if (row.clean_balance_due or Decimal("0")) > 0]
    open_customer_rows = [row for row in customer_rows if (row.clean_balance_due or Decimal("0")) > 0]
    pre_cutoff_open_vendor_rows = [row for row in open_vendor_rows if row.pre_dec2025_flag == "YES"]
    pre_cutoff_open_customer_rows = [row for row in open_customer_rows if row.pre_dec2025_flag == "YES"]
    assumed_paid_personal_rows = [row for row in rows if row.reconstructed_status == "ASSUMED_PAID_PERSONAL"]
    kotak_open_rows = [row for row in rows if row.reconstructed_status == "OPEN_KOTAK_EXCEPTION"]
    major_exception_rows = [row for row in rows if row.exception_level == "MAJOR_EXCEPTION"]
    critical_review_rows = [row for row in rows if row.exception_level == "CRITICAL_REVIEW"]

    summary_pairs = [
        ("total_documents", len(rows)),
        ("total_vendor_bills", len(vendor_rows)),
        ("total_customer_invoices", len(customer_rows)),
        ("total_open_vendor_bills", len(open_vendor_rows)),
        ("total_open_customer_invoices", len(open_customer_rows)),
        ("total_pre_dec2025_open_vendor_bills", len(pre_cutoff_open_vendor_rows)),
        ("total_pre_dec2025_open_customer_invoices", len(pre_cutoff_open_customer_rows)),
        ("total_assumed_paid_personal", len(assumed_paid_personal_rows)),
        ("total_kotak_multilink_open_items", len(kotak_open_rows)),
        ("total_major_exceptions", len(major_exception_rows)),
        ("total_critical_review_items", len(critical_review_rows)),
    ]
    return [{"Metric": metric, "Value": str(value)} for metric, value in summary_pairs]


def print_console_summary(rows: list[ReconstructionRow]) -> None:
    pre_cutoff_open_violations = [
        row
        for row in rows
        if row.pre_dec2025_flag == "YES"
        and row.exception_level in {"MAJOR_EXCEPTION", "CRITICAL_REVIEW"}
        and row.reconstructed_status not in {"OPEN_KOTAK_EXCEPTION"}
    ]
    interchangeable_assumed = [row for row in rows if row.reconstructed_status == "ASSUMED_PAID_PERSONAL"]
    kotak_exceptions = [row for row in rows if row.reconstructed_status == "OPEN_KOTAK_EXCEPTION"]
    open_customer_expected_collected = [
        row for row in rows if row.document_type == "CUSTOMER_INVOICE" and row.reconstructed_status == "BOOKKEEPING_MISMATCH_RECEIVABLE"
    ]
    unresolved_not_proven = [row for row in rows if row.proof_status == "NOT_PROVEN"]

    print("Reconstruction Summary")
    print(f"documents_processed,{len(rows)}")
    print(f"pre_dec2025_open_items_violating_management_rule,{len(pre_cutoff_open_violations)}")
    print(f"interchangeable_party_unpaid_items_assumed_paid_personally,{len(interchangeable_assumed)}")
    print(f"kotak_multilink_exceptions,{len(kotak_exceptions)}")
    print(f"customer_invoices_open_but_expected_collected,{len(open_customer_expected_collected)}")
    print(f"unresolved_not_proven_items,{len(unresolved_not_proven)}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Reconstruct Sattva bills master into an audit-focused layer.")
    parser.add_argument("--input", required=True, help="Path to source CSV file.")
    parser.add_argument(
        "--output-dir",
        required=True,
        help="Directory where reconstructed outputs will be written.",
    )
    args = parser.parse_args()

    input_path = Path(args.input)
    output_dir = Path(args.output_dir)

    with input_path.open("r", newline="", encoding="utf-8-sig") as handle:
        reader = csv.DictReader(handle)
        raw_rows = list(reader)

    rows = [reconstruct_row(row) for row in raw_rows]

    derived_headers = [
        "Party_Name_Normalized",
        "Document_Type",
        "Document_Date",
        "Clean_Total_Amount",
        "Clean_Balance_Due",
        "Fiscal_Year",
        "Pre_Dec2025_Flag",
        "Interchangeable_Party_Flag",
        "Kotak_Exception_Flag",
        "Expected_Status_By_Management_Rule",
        "Reconstructed_Status",
        "Proof_Status",
        "Assumption_Flag",
        "Exception_Level",
        "Recommended_Zoho_Action",
        "Notes",
    ]
    base_headers = list(raw_rows[0].keys()) if raw_rows else []
    full_headers = base_headers + derived_headers
    full_output_rows = [row.to_output_row(full_headers) for row in rows]

    exception_rows = [
        row.to_output_row(full_headers)
        for row in rows
        if (row.clean_balance_due or Decimal("0")) > 0
        or row.assumption_flag == "YES"
        or row.exception_level != "NONE"
        or row.proof_status in {"NOT_PROVEN", "ASSUMED_BY_RULE"}
    ]

    action_headers = [
        "Party_Name_Normalized",
        "Document_Date",
        "Clean_Total_Amount",
        "Clean_Balance_Due",
        "Reconstructed_Status",
        "Proof_Status",
        "Recommended_Zoho_Action",
        "Notes",
    ]
    action_rows = [
        {
            "Party_Name_Normalized": row.party_name_normalized,
            "Document_Date": date_to_str(row.document_date),
            "Clean_Total_Amount": decimal_to_str(row.clean_total_amount),
            "Clean_Balance_Due": decimal_to_str(row.clean_balance_due),
            "Reconstructed_Status": row.reconstructed_status,
            "Proof_Status": row.proof_status,
            "Recommended_Zoho_Action": row.recommended_zoho_action,
            "Notes": row.notes,
        }
        for row in rows
    ]

    summary_rows = build_summary(rows)

    write_csv(output_dir / "sattva_bills_reconstructed_v1.csv", full_output_rows, full_headers)
    write_csv(output_dir / "sattva_bills_exception_report_v1.csv", exception_rows, full_headers)
    write_csv(output_dir / "sattva_bills_summary_v1.csv", summary_rows, ["Metric", "Value"])
    write_csv(output_dir / "sattva_zoho_action_queue_v1.csv", action_rows, action_headers)

    print_console_summary(rows)


if __name__ == "__main__":
    main()
