import fs from "fs";
import path from "path";

const FY_CUTOFF = new Date("2025-12-31T00:00:00");
const INPUT_DATE_FORMATS = ["DMY_SLASH", "YMD_DASH", "DMY_DASH", "MDY_SLASH"];
const INTERCHANGEABLE_PARTIES = [
  "FACEBOOK",
  "ZOHO",
  "MOONSTONE VENTURES",
  "SUPERWELL COMTRADE",
  "SSO SOLUTIONS",
  "KAPPAL",
  "ANTHROPIC",
];
const INTERCHANGEABLE_KEYWORDS = ["GSTR", "GST", "INCOME TAX"];
const KOTAK_KEYWORD = "KOTAK MULTILINK";

function normalizePartyName(value) {
  return String(value || "").trim().replace(/\s+/g, " ").toUpperCase();
}

function normalizeHeader(value) {
  return String(value || "")
    .trim()
    .replace(/#/g, " number ")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .toLowerCase();
}

function cleanCurrency(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const cleaned = raw.replaceAll("₹", "").replaceAll("â‚¹", "").replaceAll(",", "").replace(/[^\d.-]/g, "");
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? round(parsed) : null;
}

function round(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function parseDocumentDate(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;

  for (const format of INPUT_DATE_FORMATS) {
    let year;
    let month;
    let day;
    if (format === "DMY_SLASH") {
      const match = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (!match) continue;
      [, day, month, year] = match.map(Number);
    } else if (format === "YMD_DASH") {
      const match = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
      if (!match) continue;
      [, year, month, day] = match.map(Number);
    } else if (format === "DMY_DASH") {
      const match = raw.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
      if (!match) continue;
      [, day, month, year] = match.map(Number);
    } else if (format === "MDY_SLASH") {
      const match = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (!match) continue;
      [, month, day, year] = match.map(Number);
    }

    const parsed = new Date(Date.UTC(year, month - 1, day));
    if (
      parsed.getUTCFullYear() === year &&
      parsed.getUTCMonth() === month - 1 &&
      parsed.getUTCDate() === day
    ) {
      return parsed;
    }
  }

  return null;
}

function dateToString(value) {
  if (!value) return "";
  return value.toISOString().slice(0, 10);
}

function decimalToString(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return "";
  return round(value).toFixed(2);
}

function fiscalYearFor(value) {
  if (!value) return "";
  const year = value.getUTCFullYear();
  const month = value.getUTCMonth() + 1;
  if (month >= 4) {
    return `FY ${year}-${String(year + 1).slice(-2)}`;
  }
  return `FY ${year - 1}-${String(year).slice(-2)}`;
}

function isInterchangeableParty(name) {
  return INTERCHANGEABLE_PARTIES.some((keyword) => name.includes(keyword));
}

function hasInterchangeableKeyword(...values) {
  const haystack = values.join(" ");
  return INTERCHANGEABLE_KEYWORDS.some((keyword) => haystack.includes(keyword));
}

function classifyDocumentType(row, partyNameNormalized) {
  const normalizedKeys = new Set(Object.keys(row).map(normalizeHeader));
  if (
    normalizedKeys.has("bill_id") ||
    normalizedKeys.has("bill_number") ||
    normalizedKeys.has("vendor_name")
  ) {
    if (partyNameNormalized) return "VENDOR_BILL";
  }
  if (normalizedKeys.has("invoice_id") || normalizedKeys.has("customer_name")) {
    return "CUSTOMER_INVOICE";
  }
  return "UNKNOWN";
}

function parseCsv(content) {
  const rows = [];
  let current = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < content.length; i += 1) {
    const char = content[i];
    const next = content[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        field += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      current.push(field);
      field = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i += 1;
      current.push(field);
      rows.push(current);
      current = [];
      field = "";
      continue;
    }

    field += char;
  }

  if (field.length > 0 || current.length > 0) {
    current.push(field);
    rows.push(current);
  }

  const cleanedRows = rows.filter((row) => row.some((cell) => String(cell || "").trim() !== ""));
  if (cleanedRows.length === 0) return [];

  const headers = cleanedRows[0].map((header) => String(header || "").trim().replace(/^\uFEFF/, ""));
  return cleanedRows.slice(1).map((values) => {
    const obj = {};
    headers.forEach((header, index) => {
      obj[header] = String(values[index] || "").trim();
    });
    return obj;
  });
}

function escapeCsv(value) {
  const text = String(value ?? "");
  if (/[",\r\n]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

function writeCsv(filePath, headers, rows) {
  const lines = [headers.map(escapeCsv).join(",")];
  for (const row of rows) {
    lines.push(headers.map((header) => escapeCsv(row[header] ?? "")).join(","));
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `\uFEFF${lines.join("\r\n")}\r\n`, "utf8");
}

function reconstructRow(row) {
  const source = Object.fromEntries(
    Object.entries(row).map(([key, value]) => [String(key || "").trim(), String(value || "").trim()]),
  );
  const partyName = source["Vendor Name"] || source["Customer Name"] || "";
  const billNumber = source["Bill#"] || "";
  const referenceNumber = source["Reference Number"] || "";
  const status = normalizePartyName(source["Status"] || "");
  const partyNameNormalized = normalizePartyName(partyName);
  const documentDate = parseDocumentDate(source["Date"] || "");
  const cleanTotalAmount = cleanCurrency(source["Amount"] || "");
  const parsedBalanceDue = cleanCurrency(source["Balance Due"] || "");
  const cleanBalanceDue = parsedBalanceDue ?? 0;
  const documentType = classifyDocumentType(source, partyNameNormalized);
  const fiscalYear = fiscalYearFor(documentDate);
  const preDec2025Flag = documentDate && documentDate <= FY_CUTOFF ? "YES" : "NO";
  const interchangeablePartyFlag =
    isInterchangeableParty(partyNameNormalized) ||
    hasInterchangeableKeyword(partyNameNormalized, billNumber.toUpperCase(), referenceNumber.toUpperCase())
      ? "YES"
      : "NO";
  const kotakExceptionFlag = partyNameNormalized.includes(KOTAK_KEYWORD) ? "YES" : "NO";
  const isOpen = cleanBalanceDue > 0;

  let expectedStatusByManagementRule = "MANUAL_REVIEW";
  let reconstructedStatus = "OPEN_IN_BOOKS";
  let proofStatus = "NOT_PROVEN";
  let assumptionFlag = "NO";
  let exceptionLevel = "NONE";
  let recommendedZohoAction = "NO_ACTION";
  const notes = [];

  if (documentType === "UNKNOWN") {
    expectedStatusByManagementRule = "MANUAL_REVIEW";
    reconstructedStatus = "UNKNOWN_DOCUMENT_TYPE";
    proofStatus = "NOT_PROVEN";
    exceptionLevel = "CRITICAL_REVIEW";
    recommendedZohoAction = "MANUAL_REVIEW_REQUIRED";
    notes.push("Document type not reliably derivable from source columns.");
  } else if (documentType === "CUSTOMER_INVOICE") {
    expectedStatusByManagementRule = preDec2025Flag === "YES" ? "FULLY_RECEIVED" : "STATUS_BY_EVIDENCE";
    if (isOpen && preDec2025Flag === "YES") {
      reconstructedStatus = "BOOKKEEPING_MISMATCH_RECEIVABLE";
      proofStatus = "NOT_PROVEN";
      exceptionLevel = "MAJOR_EXCEPTION";
      recommendedZohoAction = "CLEAR_RECEIVABLE_AGAINST_BANK_RECEIPT";
      notes.push("Management rule says all client invoices up to 2025-12-31 are fully collected.");
    } else if (isOpen) {
      reconstructedStatus = "OPEN_RECEIVABLE_POST_CUTOFF";
      proofStatus = "NOT_PROVEN";
      exceptionLevel = "MINOR_VARIANCE";
      recommendedZohoAction = "VERIFY_BANK_MATCH_3326";
      notes.push("Open customer invoice falls after management cutoff.");
    } else {
      reconstructedStatus = "FULLY_RECEIVED";
      proofStatus = "PROVEN_BY_BOOKS";
      exceptionLevel = "NONE";
      recommendedZohoAction = "NO_ACTION";
    }
  } else {
    if (preDec2025Flag === "YES" && kotakExceptionFlag === "YES") {
      expectedStatusByManagementRule = "PAYABLE_ALLOWED_EXCEPTION";
    } else if (preDec2025Flag === "YES") {
      expectedStatusByManagementRule = "FULLY_PAID";
    } else {
      expectedStatusByManagementRule = "STATUS_BY_EVIDENCE";
    }

    if (!isOpen) {
      reconstructedStatus = "FULLY_PAID";
      proofStatus = "PROVEN_BY_BOOKS";
      exceptionLevel = "NONE";
      recommendedZohoAction = "NO_ACTION";
    } else if (preDec2025Flag === "YES" && kotakExceptionFlag === "YES") {
      reconstructedStatus = "OPEN_KOTAK_EXCEPTION";
      proofStatus = "NOT_PROVEN";
      exceptionLevel = "NONE";
      recommendedZohoAction = "RETAIN_AS_GENUINE_PAYABLE";
      notes.push("Kotak Multilink is the only allowed unpaid vendor exception per management rule.");
    } else if (preDec2025Flag === "YES" && interchangeablePartyFlag === "YES") {
      reconstructedStatus = "ASSUMED_PAID_PERSONAL";
      proofStatus = "ASSUMED_BY_RULE";
      assumptionFlag = "YES";
      exceptionLevel = "MAJOR_EXCEPTION";
      recommendedZohoAction = "CLEAR_VENDOR_BY_OWNER_FUNDING_OR_DRAWINGS_ENTRY";
      notes.push("Open interchangeable-party bill assumed cleared from personal account under management rule.");
      notes.push("Assumption only; no bank proof in this file.");
    } else if (preDec2025Flag === "YES") {
      reconstructedStatus = "BOOKKEEPING_MISMATCH_PAYABLE";
      proofStatus = "NOT_PROVEN";
      exceptionLevel = "MAJOR_EXCEPTION";
      recommendedZohoAction = "VERIFY_BANK_MATCH_3326";
      notes.push("Management rule says all vendor bills up to 2025-12-31 are fully cleared except Kotak Multilink.");
    } else {
      reconstructedStatus = "OPEN_VENDOR_POST_CUTOFF";
      proofStatus = "NOT_PROVEN";
      exceptionLevel = "MINOR_VARIANCE";
      recommendedZohoAction = "MANUAL_REVIEW_REQUIRED";
      notes.push("Open vendor bill falls after management cutoff.");
    }
  }

  if (cleanTotalAmount === null) {
    exceptionLevel = "CRITICAL_REVIEW";
    recommendedZohoAction = "MANUAL_REVIEW_REQUIRED";
    proofStatus = "NOT_PROVEN";
    notes.push("Total amount could not be parsed safely.");
  }
  if (!documentDate) {
    exceptionLevel = "CRITICAL_REVIEW";
    recommendedZohoAction = "MANUAL_REVIEW_REQUIRED";
    proofStatus = "NOT_PROVEN";
    notes.push("Document date could not be parsed safely.");
  }
  if (parsedBalanceDue === null) {
    exceptionLevel = "CRITICAL_REVIEW";
    recommendedZohoAction = "MANUAL_REVIEW_REQUIRED";
    proofStatus = "NOT_PROVEN";
    notes.push("Balance due could not be parsed safely.");
  }
  if (status === "PARTIALLY PAID" && exceptionLevel === "NONE") {
    exceptionLevel = "MINOR_VARIANCE";
    notes.push("Books show partially paid status.");
  }

  return {
    sourceRow: source,
    partyNameNormalized,
    documentType,
    documentDate,
    cleanTotalAmount,
    cleanBalanceDue,
    fiscalYear,
    preDec2025Flag,
    interchangeablePartyFlag,
    kotakExceptionFlag,
    expectedStatusByManagementRule,
    reconstructedStatus,
    proofStatus,
    assumptionFlag,
    exceptionLevel,
    recommendedZohoAction,
    notes: [...new Set(notes)].join(" | "),
  };
}

function toOutputRow(reconstructed, headers) {
  const base = { ...reconstructed.sourceRow };
  base["Party_Name_Normalized"] = reconstructed.partyNameNormalized;
  base["Document_Type"] = reconstructed.documentType;
  base["Document_Date"] = dateToString(reconstructed.documentDate);
  base["Clean_Total_Amount"] = decimalToString(reconstructed.cleanTotalAmount);
  base["Clean_Balance_Due"] = decimalToString(reconstructed.cleanBalanceDue);
  base["Fiscal_Year"] = reconstructed.fiscalYear;
  base["Pre_Dec2025_Flag"] = reconstructed.preDec2025Flag;
  base["Interchangeable_Party_Flag"] = reconstructed.interchangeablePartyFlag;
  base["Kotak_Exception_Flag"] = reconstructed.kotakExceptionFlag;
  base["Expected_Status_By_Management_Rule"] = reconstructed.expectedStatusByManagementRule;
  base["Reconstructed_Status"] = reconstructed.reconstructedStatus;
  base["Proof_Status"] = reconstructed.proofStatus;
  base["Assumption_Flag"] = reconstructed.assumptionFlag;
  base["Exception_Level"] = reconstructed.exceptionLevel;
  base["Recommended_Zoho_Action"] = reconstructed.recommendedZohoAction;
  base["Notes"] = reconstructed.notes;
  return Object.fromEntries(headers.map((header) => [header, base[header] ?? ""]));
}

function buildSummary(rows) {
  const vendorRows = rows.filter((row) => row.documentType === "VENDOR_BILL");
  const customerRows = rows.filter((row) => row.documentType === "CUSTOMER_INVOICE");
  const openVendorRows = vendorRows.filter((row) => row.cleanBalanceDue > 0);
  const openCustomerRows = customerRows.filter((row) => row.cleanBalanceDue > 0);
  const preCutoffOpenVendorRows = openVendorRows.filter((row) => row.preDec2025Flag === "YES");
  const preCutoffOpenCustomerRows = openCustomerRows.filter((row) => row.preDec2025Flag === "YES");
  const assumedPaidPersonalRows = rows.filter((row) => row.reconstructedStatus === "ASSUMED_PAID_PERSONAL");
  const kotakOpenRows = rows.filter((row) => row.reconstructedStatus === "OPEN_KOTAK_EXCEPTION");
  const majorExceptionRows = rows.filter((row) => row.exceptionLevel === "MAJOR_EXCEPTION");
  const criticalReviewRows = rows.filter((row) => row.exceptionLevel === "CRITICAL_REVIEW");

  return [
    { Metric: "total_documents", Value: String(rows.length) },
    { Metric: "total_vendor_bills", Value: String(vendorRows.length) },
    { Metric: "total_customer_invoices", Value: String(customerRows.length) },
    { Metric: "total_open_vendor_bills", Value: String(openVendorRows.length) },
    { Metric: "total_open_customer_invoices", Value: String(openCustomerRows.length) },
    { Metric: "total_pre_dec2025_open_vendor_bills", Value: String(preCutoffOpenVendorRows.length) },
    { Metric: "total_pre_dec2025_open_customer_invoices", Value: String(preCutoffOpenCustomerRows.length) },
    { Metric: "total_assumed_paid_personal", Value: String(assumedPaidPersonalRows.length) },
    { Metric: "total_kotak_multilink_open_items", Value: String(kotakOpenRows.length) },
    { Metric: "total_major_exceptions", Value: String(majorExceptionRows.length) },
    { Metric: "total_critical_review_items", Value: String(criticalReviewRows.length) },
  ];
}

function printConsoleSummary(rows) {
  const preCutoffOpenViolations = rows.filter(
    (row) =>
      row.preDec2025Flag === "YES" &&
      ["MAJOR_EXCEPTION", "CRITICAL_REVIEW"].includes(row.exceptionLevel) &&
      row.reconstructedStatus !== "OPEN_KOTAK_EXCEPTION",
  );
  const interchangeableAssumed = rows.filter((row) => row.reconstructedStatus === "ASSUMED_PAID_PERSONAL");
  const kotakExceptions = rows.filter((row) => row.reconstructedStatus === "OPEN_KOTAK_EXCEPTION");
  const openCustomerExpectedCollected = rows.filter(
    (row) => row.documentType === "CUSTOMER_INVOICE" && row.reconstructedStatus === "BOOKKEEPING_MISMATCH_RECEIVABLE",
  );
  const unresolvedNotProven = rows.filter((row) => row.proofStatus === "NOT_PROVEN");

  console.log("Reconstruction Summary");
  console.log(`documents_processed,${rows.length}`);
  console.log(`pre_dec2025_open_items_violating_management_rule,${preCutoffOpenViolations.length}`);
  console.log(`interchangeable_party_unpaid_items_assumed_paid_personally,${interchangeableAssumed.length}`);
  console.log(`kotak_multilink_exceptions,${kotakExceptions.length}`);
  console.log(`customer_invoices_open_but_expected_collected,${openCustomerExpectedCollected.length}`);
  console.log(`unresolved_not_proven_items,${unresolvedNotProven.length}`);
}

function main() {
  const args = process.argv.slice(2);
  const inputIndex = args.indexOf("--input");
  const outputDirIndex = args.indexOf("--output-dir");
  if (inputIndex === -1 || outputDirIndex === -1 || !args[inputIndex + 1] || !args[outputDirIndex + 1]) {
    throw new Error("Usage: node reconstruct_bills_master.mjs --input <path> --output-dir <path>");
  }

  const inputPath = args[inputIndex + 1];
  const outputDir = args[outputDirIndex + 1];
  const content = fs.readFileSync(inputPath, "utf8");
  const rawRows = parseCsv(content);
  const reconstructedRows = rawRows.map(reconstructRow);

  const derivedHeaders = [
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
  ];
  const baseHeaders = rawRows.length ? Object.keys(rawRows[0]) : [];
  const fullHeaders = [...baseHeaders, ...derivedHeaders];
  const fullOutputRows = reconstructedRows.map((row) => toOutputRow(row, fullHeaders));

  const exceptionRows = reconstructedRows
    .filter(
      (row) =>
        row.cleanBalanceDue > 0 ||
        row.assumptionFlag === "YES" ||
        row.exceptionLevel !== "NONE" ||
        ["NOT_PROVEN", "ASSUMED_BY_RULE"].includes(row.proofStatus),
    )
    .map((row) => toOutputRow(row, fullHeaders));

  const summaryRows = buildSummary(reconstructedRows);
  const actionHeaders = [
    "Party_Name_Normalized",
    "Document_Date",
    "Clean_Total_Amount",
    "Clean_Balance_Due",
    "Reconstructed_Status",
    "Proof_Status",
    "Recommended_Zoho_Action",
    "Notes",
  ];
  const actionRows = reconstructedRows.map((row) => ({
    Party_Name_Normalized: row.partyNameNormalized,
    Document_Date: dateToString(row.documentDate),
    Clean_Total_Amount: decimalToString(row.cleanTotalAmount),
    Clean_Balance_Due: decimalToString(row.cleanBalanceDue),
    Reconstructed_Status: row.reconstructedStatus,
    Proof_Status: row.proofStatus,
    Recommended_Zoho_Action: row.recommendedZohoAction,
    Notes: row.notes,
  }));

  writeCsv(path.join(outputDir, "sattva_bills_reconstructed_v1.csv"), fullHeaders, fullOutputRows);
  writeCsv(path.join(outputDir, "sattva_bills_exception_report_v1.csv"), fullHeaders, exceptionRows);
  writeCsv(path.join(outputDir, "sattva_bills_summary_v1.csv"), ["Metric", "Value"], summaryRows);
  writeCsv(path.join(outputDir, "sattva_zoho_action_queue_v1.csv"), actionHeaders, actionRows);

  printConsoleSummary(reconstructedRows);
}

main();
