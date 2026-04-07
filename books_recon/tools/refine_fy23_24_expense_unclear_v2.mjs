import fs from "fs";
import path from "path";

const REPO_ROOT = "C:\\sattva\\books_recon";
const EXPORTS_DIR = path.join(REPO_ROOT, "data", "exports");
const INPUT_DIR = path.join(EXPORTS_DIR, "reconciliation_status_fy23_24");
const OUTPUT_DIR = INPUT_DIR;
const BANK_CLASSIFIED_PATH = path.join(EXPORTS_DIR, "run3_bank_first", "sattva_bank_classified_v1.csv");
const GST_RAW_DIR = path.join(REPO_ROOT, "data", "raw", "gst");
const BILLS_PATH = path.join(EXPORTS_DIR, "bills_reconstruction", "sattva_bills_reconstructed_v1.csv");
const FY_START = new Date("2023-04-01T00:00:00Z");
const FY_END = new Date("2024-03-31T00:00:00Z");

const FOCUS_CLASSES = new Set([
  "EXPENSE_UNCLEAR",
  "UNKNOWN",
  "REVIEW_OWNER_FUNDING",
  "REVIEW_OWNER_DRAWING",
  "REVIEW_TAX_ENTRY",
]);

const OWNER_PATTERNS = [
  "SUJITH",
  "NSUJITH",
  "GOPAKUMARAN",
  "51909",
  " 217 ",
  "OKSBI",
  "OKHDFCBANK",
  "SBIN0070665",
];

const GST_PATTERNS = [
  " GST ",
  "CGST",
  "SGST",
  "IGST",
  "GST PAYMENT",
  "GST DIFFERENC",
];

const INCOME_TAX_PATTERNS = [
  "INCOME TAX",
  "ADVANCE TAX",
  "SELF ASSESSMENT",
  "TDS PAYMENT",
  "OLTAS",
  "NSDL",
];

const BANK_CHARGE_PATTERNS = [
  "CHRG",
  "BANK CHARGE",
  "ACCOUNTMAINTENANCE",
  "A C MAINTENANCE",
  "A/C MAINTENANCE",
  "MAINTENANCE",
  "JOIN FEE",
  "MIN BAL CHARGES",
  "SMS CHARGE",
  "NEFT FEE",
  "IMPS FEE",
];

const INTEREST_PATTERNS = [
  "INTEREST",
  "INT CR",
  "INT.CR",
  "INT CREDIT",
  "INT PD",
  "INTEREST CREDIT",
];

const RETURN_PATTERNS = [
  " RTN ",
  " RETURN ",
  " REVERSAL ",
  " RVSL ",
  " ANY OTHER RESONS ",
  " ANY OTHER REASONS ",
];

const PLATFORM_FAMILIES = new Set(["GOOGLE PLAY", "AMAZON", "GPAY UTILITIES", "GPAY RECHARGE"]);
const BUSINESS_VENDOR_FAMILIES = new Set(["AIRTEL", "CANVA", "CIBIL", "GOOGLE CLOUD", "MCAFEE", "MICROSOFT", "WEFAST", "ZOHO"]);
const CLEAR_EXPENSE_FAMILIES = new Set(["ZOHO"]);

const HIGH_RISK_UNKNOWN_PATTERNS = [
  " TO ATM ",
  " POS ",
  " WINE ",
  " MED CARE ",
  " MONEYVIEW ",
  " KRAZYBEE ",
  " NBFCIIFL ",
  " SWASTIK ",
  " ULWE ",
  " SHOP 101112GROUND FLOO ",
  " BELAPUR ",
  " SAYYAM ",
  " TOP TEN ELECTRONIC ",
];

function parseCsv(content) {
  const rows = [];
  let current = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < content.length; i += 1) {
    const ch = content[i];
    const next = content[i + 1];
    if (ch === '"') {
      if (inQuotes && next === '"') {
        field += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === "," && !inQuotes) {
      current.push(field);
      field = "";
      continue;
    }
    if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (ch === "\r" && next === "\n") i += 1;
      current.push(field);
      rows.push(current);
      current = [];
      field = "";
      continue;
    }
    field += ch;
  }

  if (field.length > 0 || current.length > 0) {
    current.push(field);
    rows.push(current);
  }

  const cleaned = rows.filter((row) => row.some((cell) => String(cell || "").trim() !== ""));
  if (!cleaned.length) return [];
  const headers = cleaned[0].map((header) => String(header || "").replace(/^\uFEFF/, "").trim());
  return cleaned.slice(1).map((values) =>
    Object.fromEntries(headers.map((header, index) => [header, String(values[index] || "").trim()])),
  );
}

function writeCsv(filePath, headers, rows) {
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(
      headers
        .map((header) => {
          const text = String(row[header] ?? "");
          if (/[",\r\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
          return text;
        })
        .join(","),
    );
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `\uFEFF${lines.join("\r\n")}\r\n`, "utf8");
}

function normalizeText(value) {
  return String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeTextPadded(value) {
  const text = normalizeText(value);
  return text ? ` ${text} ` : " ";
}

function toNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(String(value).replace(/,/g, "").replace(/[₹â‚¹Ã¢â€šÂ¹]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function round(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function decimalToString(value) {
  const num = toNumber(value);
  if (num === null) return "";
  return round(num).toFixed(2);
}

function parseDate(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return new Date(`${raw}T00:00:00Z`);
  const dmy = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) {
    const [, dd, mm, yyyy] = dmy.map(Number);
    return new Date(Date.UTC(yyyy, mm - 1, dd));
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatMonthPeriod(dateText) {
  const parsed = parseDate(dateText);
  return parsed ? parsed.toISOString().slice(0, 7) : "";
}

function amountBand(value) {
  const amount = Math.abs(toNumber(value) || 0);
  if (amount <= 100) return "LE_100";
  if (amount <= 500) return "101_500";
  if (amount <= 1000) return "501_1000";
  if (amount <= 5000) return "1001_5000";
  if (amount <= 20000) return "5001_20000";
  return "20001_PLUS";
}

function containsAny(paddedText, patterns) {
  return patterns.some((pattern) => paddedText.includes(pattern));
}

function extractTradeNames(node, sink) {
  if (Array.isArray(node)) {
    for (const item of node) extractTradeNames(item, sink);
    return;
  }
  if (!node || typeof node !== "object") return;
  for (const [key, value] of Object.entries(node)) {
    if ((key === "trdnm" || key === "lgnm") && value) {
      sink.add(normalizeText(value));
    } else {
      extractTradeNames(value, sink);
    }
  }
}

function loadSupportVendorNames() {
  const names = new Set();

  if (fs.existsSync(GST_RAW_DIR)) {
    for (const fileName of fs.readdirSync(GST_RAW_DIR)) {
      if (!/^gstr2b_.*\.json$/i.test(fileName)) continue;
      const filePath = path.join(GST_RAW_DIR, fileName);
      try {
        const parsed = JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
        extractTradeNames(parsed, names);
      } catch {
        // Ignore malformed support files and continue the refinement pass.
      }
    }
  }

  if (fs.existsSync(BILLS_PATH)) {
    const bills = parseCsv(fs.readFileSync(BILLS_PATH, "utf8"));
    for (const bill of bills) {
      const billDate = parseDate(bill.Document_Date || bill.Date);
      if (!billDate || billDate < FY_START || billDate > FY_END) continue;
      names.add(normalizeText(bill.Party_Name_Normalized || bill["Vendor Name"] || ""));
    }
  }

  return names;
}

function canonicalFamily(value) {
  const text = normalizeText(value);
  if (!text) return "";
  if (text.includes("GOOGLE PLAY") || text.includes("GOOGLEPLAY")) return "GOOGLE PLAY";
  if (text.includes("AMAZON")) return "AMAZON";
  if (text.includes("GPAY UTILITIES")) return "GPAY UTILITIES";
  if (text.includes("GPAY RECHARGE")) return "GPAY RECHARGE";
  if (text.includes("ZOHO")) return "ZOHO";
  if (text.includes("WEFAST")) return "WEFAST";
  if (text.includes("AIRTEL")) return "AIRTEL";
  if (text.includes("MICROSOFT")) return "MICROSOFT";
  if (text.includes("GOOGLE CLOUD")) return "GOOGLE CLOUD";
  if (text.includes("CANVA")) return "CANVA";
  if (text.includes("CIBIL")) return "CIBIL";
  if (text.includes("MCAFEE")) return "MCAFEE";
  if (text.includes("KRAZYBEE")) return "KRAZYBEE";
  if (text.includes("MONEYVIEW")) return "MONEYVIEW";
  if (text.includes("NBFCIIFL")) return "NBFCIIFL";
  if (text.includes("MED CARE")) return "MED CARE";
  if (text.includes("WINE")) return "KUNAL FINE WINE";
  if (text.includes("SAYYAM")) return "SAYYAM";
  return text.split(" ").slice(0, 4).join(" ");
}

function hasSupportVendor(normalizedPayee, family, supportVendorNames) {
  if (!normalizedPayee && !family) return false;
  if (family === "ZOHO") {
    for (const name of supportVendorNames) {
      if (name.includes("ZOHO")) return true;
    }
  }
  if (normalizedPayee && supportVendorNames.has(normalizedPayee)) return true;
  for (const name of supportVendorNames) {
    if (!name) continue;
    if (normalizedPayee && (name.includes(normalizedPayee) || normalizedPayee.includes(name))) return true;
    if (family && name.includes(family)) return true;
  }
  return false;
}

function buildKey(dateText, amountText, direction) {
  return [dateText || "", decimalToString(amountText), direction || ""].join("|");
}

function buildBankMap(bankRows) {
  const grouped = new Map();
  for (const row of bankRows) {
    const key = buildKey(row.transaction_date, row.Clean_Amount, row.Direction);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(row);
  }
  for (const rows of grouped.values()) {
    rows.sort((left, right) =>
      (left.Transaction_ID || "").localeCompare(right.Transaction_ID || "") ||
      (left.narration || "").localeCompare(right.narration || ""),
    );
  }
  return grouped;
}

function recommendZohoAction(auditClass) {
  switch (auditClass) {
    case "CUSTOMER_RECEIPT":
      return "RELINK_TO_CUSTOMER_RECEIPT";
    case "VENDOR_PAYMENT":
      return "RELINK_TO_VENDOR_PAYMENT";
    case "GST_PAYMENT":
      return "TAG_AS_GST_PAYMENT";
    case "INCOME_TAX_PAYMENT":
      return "TAG_AS_INCOME_TAX_PAYMENT";
    case "BANK_CHARGES":
      return "POST_TO_BANK_CHARGES";
    case "INTEREST":
      return "POST_TO_INTEREST";
    case "OWNER_FUNDING":
      return "REVIEW_OWNER_FUNDING";
    case "OWNER_DRAWING":
      return "REVIEW_OWNER_DRAWING";
    case "OPERATING_EXPENSE_CLEAR":
    case "OPERATING_EXPENSE_REVIEW":
      return "MOVE_TO_OPERATING_EXPENSE";
    case "LEGACY_OPENING_MISMATCH":
      return "MARK_AS_LEGACY_OPENING_ITEM";
    default:
      return "HOLD_FOR_MANUAL_REVIEW";
  }
}

function suggestedFinalTreatment(auditClass, proofStatus) {
  if (auditClass === "OWNER_FUNDING") {
    return proofStatus === "PROVEN_BY_STATEMENT_PATTERN" ? "POST_AS_UNSECURED_LOAN_FROM_OWNER" : "HOLD_PENDING_EVIDENCE";
  }
  if (auditClass === "OWNER_DRAWING") {
    return proofStatus === "PROVEN_BY_STATEMENT_PATTERN" ? "POST_AS_OWNER_DRAWING" : "HOLD_PENDING_EVIDENCE";
  }
  return "";
}

function reviewFlagFor(row) {
  if (row.Audit_Class === "UNKNOWN" || row.Audit_Class === "OPERATING_EXPENSE_REVIEW") return "YES";
  if (row.Audit_Class === "OWNER_FUNDING" || row.Audit_Class === "OWNER_DRAWING") return "YES";
  if (row.Proof_Status === "NOT_PROVEN") return "YES";
  return "NO";
}

function truncate(value, maxLength = 120) {
  const text = String(value || "").trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 3)}...`;
}

function classifyFocusRow(row, bankRow, recurrenceByFamily, supportVendorNames) {
  const bankNarration = bankRow?.narration || "";
  const bankCounterparty = bankRow?.counterparty_hint || "";
  const bankReference = bankRow?.reference || "";
  const bankClass = bankRow?.Bank_Classification || "";
  const evidenceText = `${row.Payee} ${row.Reference_Number} ${bankCounterparty} ${bankReference} ${bankNarration}`;
  const padded = normalizeTextPadded(evidenceText);
  const normalizedPayee = normalizeText(bankCounterparty || row.Payee || bankNarration);
  const normalizedReference = normalizeText(bankReference || row.Reference_Number);
  const family = canonicalFamily(`${normalizedPayee} ${bankNarration}`);
  const recurrence = recurrenceByFamily.get(family) || 1;
  const supportHit = hasSupportVendor(normalizedPayee, family, supportVendorNames);
  const likelyTax = containsAny(padded, GST_PATTERNS) || containsAny(padded, INCOME_TAX_PATTERNS);
  const likelyGst = containsAny(padded, GST_PATTERNS);
  const likelyIncomeTax = containsAny(padded, INCOME_TAX_PATTERNS);
  const likelyBankCharge = containsAny(padded, BANK_CHARGE_PATTERNS);
  const likelyInterest = containsAny(padded, INTEREST_PATTERNS);
  const likelyOwnerFlow = OWNER_PATTERNS.some((pattern) => padded.includes(pattern));
  const likelyStatutory = likelyGst || likelyIncomeTax;
  const isPlatformSpend = PLATFORM_FAMILIES.has(family);
  const isNamedBusinessVendor = BUSINESS_VENDOR_FAMILIES.has(family);
  const isReturnStyleInflow = row.Direction === "INFLOW" && containsAny(padded, RETURN_PATTERNS);
  const isAtmOrPos = padded.includes(" TO ATM ") || padded.includes(" POS ");
  const isHighRiskUnknown = containsAny(padded, HIGH_RISK_UNKNOWN_PATTERNS);
  const hasGenericBusinessCue =
    padded.includes(" MSEB ") ||
    padded.includes(" ELECTRIC ") ||
    padded.includes(" UTILIT") ||
    padded.includes(" BROADBAND ") ||
    padded.includes(" INTERNET ") ||
    padded.includes(" MOBILE ") ||
    padded.includes(" TELECOM ");
  const likelyVendor = Boolean(
    isNamedBusinessVendor ||
      isPlatformSpend ||
      bankClass === "VENDOR_PAYMENT" ||
      supportHit ||
      (normalizedPayee && row.Direction === "OUTFLOW" && !likelyOwnerFlow && !likelyBankCharge && !likelyStatutory),
  );

  const result = {
    Normalized_Payee: normalizedPayee,
    Normalized_Reference: normalizedReference,
    Amount_Band: amountBand(row.Statement_Amount),
    Month_Period: formatMonthPeriod(row.Statement_Date),
    Likely_Tax_Keyword_Flag: likelyTax ? "YES" : "NO",
    Likely_BankCharge_Keyword_Flag: likelyBankCharge ? "YES" : "NO",
    Likely_Interest_Keyword_Flag: likelyInterest ? "YES" : "NO",
    Likely_Owner_Flow_Flag: likelyOwnerFlow ? "YES" : "NO",
    Likely_Vendor_Flag: likelyVendor ? "YES" : "NO",
    Likely_Statutory_Flag: likelyStatutory ? "YES" : "NO",
    Confidence_Note: "",
    Audit_Class: row.Audit_Class,
    Proof_Status: row.Proof_Status,
    Recommended_Zoho_Action: row.Recommended_Zoho_Action,
    Reason_For_Classification: row.Notes,
    Notes: row.Notes,
  };

  if (row.Legacy_Flag === "YES") {
    result.Audit_Class = "LEGACY_OPENING_MISMATCH";
    result.Proof_Status = "NOT_PROVEN";
    result.Confidence_Note = "Legacy flag already present in annual master.";
    result.Reason_For_Classification = "Legacy contamination flagged in annual consolidation.";
  } else if (likelyOwnerFlow) {
    result.Audit_Class = row.Direction === "INFLOW" ? "OWNER_FUNDING" : "OWNER_DRAWING";
    result.Proof_Status = "PROVEN_BY_STATEMENT_PATTERN";
    result.Confidence_Note = `Owner account markers found in narration/reference (${truncate(bankCounterparty || bankNarration, 50)}).`;
    result.Reason_For_Classification = "Statement narration matches known owner/personal account fragments.";
  } else if (likelyBankCharge || bankClass === "BANK_CHARGES") {
    result.Audit_Class = "BANK_CHARGES";
    result.Proof_Status = "PROVEN_BY_STATEMENT_PATTERN";
    result.Confidence_Note = `Charge-style wording found in statement narration (${truncate(bankNarration || bankCounterparty, 70)}).`;
    result.Reason_For_Classification = "Statement narration contains bank charge / maintenance / fee wording.";
  } else if (likelyInterest || bankClass === "INTEREST") {
    result.Audit_Class = "INTEREST";
    result.Proof_Status = "PROVEN_BY_STATEMENT_PATTERN";
    result.Confidence_Note = `Interest keyword found in narration (${truncate(bankNarration || bankCounterparty, 70)}).`;
    result.Reason_For_Classification = "Statement narration contains interest wording.";
  } else if (likelyIncomeTax || bankClass === "INCOME_TAX_PAYMENT") {
    result.Audit_Class = "INCOME_TAX_PAYMENT";
    result.Proof_Status = "PROVEN_BY_STATEMENT_PATTERN";
    result.Confidence_Note = `Income-tax wording found in statement text (${truncate(bankNarration || bankCounterparty, 70)}).`;
    result.Reason_For_Classification = "Statement narration contains income-tax / OLTAS / NSDL style wording.";
  } else if (likelyGst || bankClass === "GST_PAYMENT") {
    result.Audit_Class = "GST_PAYMENT";
    result.Proof_Status = "PROVEN_BY_STATEMENT_PATTERN";
    result.Confidence_Note = `GST wording found in statement text (${truncate(bankNarration || bankCounterparty, 70)}).`;
    result.Reason_For_Classification = "Statement narration contains GST / CGST / SGST / IGST wording.";
  } else if (row.Direction === "INFLOW") {
    if (isReturnStyleInflow) {
      result.Audit_Class = "UNKNOWN";
      result.Proof_Status = "NOT_PROVEN";
      result.Confidence_Note = `Inflow narration looks like a return/reversal, not a clean receipt (${truncate(bankNarration, 70)}).`;
      result.Reason_For_Classification = "Return-style inflow is not defensibly classifiable as customer receipt from supplied evidence.";
    } else if (bankClass === "CUSTOMER_RECEIPT" && normalizedPayee) {
      result.Audit_Class = "CUSTOMER_RECEIPT";
      result.Proof_Status = "PROVEN_BY_STATEMENT_PATTERN";
      result.Confidence_Note = `Named inflow counterparty found in statement narration (${truncate(bankCounterparty, 50)}).`;
      result.Reason_For_Classification = "Statement inflow pattern points to a customer-side receipt.";
    } else {
      result.Audit_Class = "UNKNOWN";
      result.Proof_Status = "NOT_PROVEN";
      result.Confidence_Note = "Inflow exists, but supplied evidence does not safely prove customer or owner nature.";
      result.Reason_For_Classification = "Inflow remains unproven after bank-side review.";
    }
  } else {
    if (CLEAR_EXPENSE_FAMILIES.has(family) && supportHit) {
      result.Audit_Class = "OPERATING_EXPENSE_CLEAR";
      result.Proof_Status = "PROVEN_BY_STATEMENT_PATTERN";
      result.Confidence_Note = `Recurring named vendor with GST support hit (${family}; repeats=${recurrence}).`;
      result.Reason_For_Classification = "Named software vendor recurs in bank narration and appears in available GST support data.";
    } else if (isNamedBusinessVendor && recurrence >= 2) {
      result.Audit_Class = "VENDOR_PAYMENT";
      result.Proof_Status = "PROVEN_BY_STATEMENT_PATTERN";
      result.Confidence_Note = `Named external payee recurs in statement pattern (${family}; repeats=${recurrence}).`;
      result.Reason_For_Classification = "Named counterparty repeats as a bank debit payee, which safely supports vendor-payment treatment.";
    } else if (isPlatformSpend) {
      result.Audit_Class = "OPERATING_EXPENSE_REVIEW";
      result.Proof_Status = "NOT_PROVEN";
      result.Confidence_Note = `Recurring platform/app-store spend looks business-related but invoice support is absent (${family}; repeats=${recurrence}).`;
      result.Reason_For_Classification = "Debit looks business-related, but underlying vendor/invoice is not proven from supplied records.";
    } else if (isNamedBusinessVendor) {
      result.Audit_Class = "OPERATING_EXPENSE_REVIEW";
      result.Proof_Status = "NOT_PROVEN";
      result.Confidence_Note = `Named business-style merchant found, but recurrence/support is limited (${family}; repeats=${recurrence}).`;
      result.Reason_For_Classification = "Named merchant suggests business spend, but evidence is not strong enough for direct vendor posting.";
    } else if (isAtmOrPos || isHighRiskUnknown) {
      result.Audit_Class = "UNKNOWN";
      result.Proof_Status = "NOT_PROVEN";
      result.Confidence_Note = `Merchant text exists, but ATM/POS or personal-risk wording makes business purpose non-defensible (${truncate(bankNarration, 70)}).`;
      result.Reason_For_Classification = "ATM/POS or consumer-style merchant wording is not enough to assert business treatment.";
    } else if (likelyVendor && hasGenericBusinessCue) {
      result.Audit_Class = "OPERATING_EXPENSE_REVIEW";
      result.Proof_Status = "NOT_PROVEN";
      result.Confidence_Note = `Debit-side merchant text suggests business spend, but proof remains weak (${truncate(bankCounterparty || bankNarration, 60)}).`;
      result.Reason_For_Classification = "Looks business-related on the statement, but invoice-level evidence is still missing.";
    } else {
      result.Audit_Class = "UNKNOWN";
      result.Proof_Status = "NOT_PROVEN";
      result.Confidence_Note = "No defensible statement pattern proved tax, charge, vendor, owner, or customer treatment.";
      result.Reason_For_Classification = "Still not provable from available evidence.";
    }
  }

  result.Recommended_Zoho_Action = recommendZohoAction(result.Audit_Class);
  result.Notes = `${result.Reason_For_Classification} | ${result.Confidence_Note}`;
  return result;
}

function main() {
  const matchedPath = path.join(INPUT_DIR, "sattva_fy23_24_matched_master_v1.csv");

  const matchedRows = parseCsv(fs.readFileSync(matchedPath, "utf8"));
  const bankRows = parseCsv(fs.readFileSync(BANK_CLASSIFIED_PATH, "utf8"));
  const supportVendorNames = loadSupportVendorNames();
  const bankMap = buildBankMap(bankRows);

  const recurrenceByFamily = new Map();
  const groupedMatched = new Map();
  for (const row of matchedRows) {
    const key = buildKey(row.Statement_Date, row.Statement_Amount, row.Direction);
    if (!groupedMatched.has(key)) groupedMatched.set(key, []);
    groupedMatched.get(key).push(row);
  }
  for (const rows of groupedMatched.values()) {
    rows.sort((left, right) =>
      (left.Statement_ID || "").localeCompare(right.Statement_ID || "") ||
      (left.Transaction_Type || "").localeCompare(right.Transaction_Type || "") ||
      (left.Payee || "").localeCompare(right.Payee || "") ||
      (left.Reference_Number || "").localeCompare(right.Reference_Number || ""),
    );
  }

  const assignedBankByStatementId = new Map();
  for (const [key, rows] of groupedMatched.entries()) {
    const bankCandidates = (bankMap.get(key) || []).slice();
    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      const bankRow = bankCandidates[index] || null;
      assignedBankByStatementId.set(row.Statement_ID, bankRow);
      if (FOCUS_CLASSES.has(row.Audit_Class)) {
        const family = canonicalFamily(`${bankRow?.counterparty_hint || row.Payee || ""} ${bankRow?.narration || ""}`);
        if (family) recurrenceByFamily.set(family, (recurrenceByFamily.get(family) || 0) + 1);
      }
    }
  }

  const refinedRows = [];
  const ownerQueue = [];
  const statutoryQueue = [];
  const actionQueue = [];
  const oldExpenseUnclearCount = matchedRows.filter((row) => row.Audit_Class === "EXPENSE_UNCLEAR").length;

  for (const row of matchedRows) {
    const bankRow = assignedBankByStatementId.get(row.Statement_ID) || null;
    const focus = FOCUS_CLASSES.has(row.Audit_Class);
    const evidenceText = `${row.Payee} ${row.Reference_Number} ${bankRow?.counterparty_hint || ""} ${bankRow?.reference || ""} ${bankRow?.narration || ""}`;
    const padded = normalizeTextPadded(evidenceText);
    const normalizedPayee = normalizeText(bankRow?.counterparty_hint || row.Payee || bankRow?.narration || "");
    const normalizedReference = normalizeText(bankRow?.reference || row.Reference_Number);
    const family = canonicalFamily(`${normalizedPayee} ${bankRow?.narration || ""}`);
    const likelyTax = containsAny(padded, GST_PATTERNS) || containsAny(padded, INCOME_TAX_PATTERNS);
    const likelyBankCharge = containsAny(padded, BANK_CHARGE_PATTERNS);
    const likelyInterest = containsAny(padded, INTEREST_PATTERNS);
    const likelyOwnerFlow = OWNER_PATTERNS.some((pattern) => padded.includes(pattern));
    const likelyVendor = Boolean(
      PLATFORM_FAMILIES.has(family) ||
        BUSINESS_VENDOR_FAMILIES.has(family) ||
        bankRow?.Bank_Classification === "VENDOR_PAYMENT" ||
        normalizedPayee,
    );

    const refined = focus
      ? classifyFocusRow(row, bankRow, recurrenceByFamily, supportVendorNames)
      : {
          Audit_Class: row.Audit_Class,
          Proof_Status: row.Proof_Status,
          Recommended_Zoho_Action: row.Recommended_Zoho_Action,
          Notes: row.Notes,
          Confidence_Note: row.Notes,
          Normalized_Payee: normalizedPayee || row.Payee_Normalized || "",
          Normalized_Reference: normalizedReference,
          Amount_Band: amountBand(row.Statement_Amount),
          Month_Period: formatMonthPeriod(row.Statement_Date),
          Likely_Tax_Keyword_Flag: likelyTax ? "YES" : "NO",
          Likely_BankCharge_Keyword_Flag: likelyBankCharge ? "YES" : "NO",
          Likely_Interest_Keyword_Flag: likelyInterest ? "YES" : "NO",
          Likely_Owner_Flow_Flag: likelyOwnerFlow ? "YES" : "NO",
          Likely_Vendor_Flag: likelyVendor ? "YES" : "NO",
          Likely_Statutory_Flag: likelyTax ? "YES" : "NO",
        };

    const revisedRow = {
      ...row,
      Old_Audit_Class: row.Audit_Class,
      Old_Proof_Status: row.Proof_Status,
      Old_Recommended_Zoho_Action: row.Recommended_Zoho_Action,
      Bank_Transaction_ID: bankRow?.Transaction_ID || "",
      Bank_Counterparty_Hint: bankRow?.counterparty_hint || "",
      Bank_Reference: bankRow?.reference || "",
      Bank_Narration: bankRow?.narration || "",
      Bank_Classification: bankRow?.Bank_Classification || "",
      Bank_Classification_Confidence: bankRow?.Classification_Confidence || "",
      Bank_Classification_Basis: bankRow?.Classification_Basis || "",
      Normalized_Payee: refined.Normalized_Payee,
      Normalized_Reference: refined.Normalized_Reference,
      Amount_Band: refined.Amount_Band,
      Month_Period: refined.Month_Period,
      Likely_Tax_Keyword_Flag: refined.Likely_Tax_Keyword_Flag,
      Likely_BankCharge_Keyword_Flag: refined.Likely_BankCharge_Keyword_Flag,
      Likely_Interest_Keyword_Flag: refined.Likely_Interest_Keyword_Flag,
      Likely_Owner_Flow_Flag: refined.Likely_Owner_Flow_Flag,
      Likely_Vendor_Flag: refined.Likely_Vendor_Flag,
      Likely_Statutory_Flag: refined.Likely_Statutory_Flag,
      Confidence_Note: refined.Confidence_Note,
      Audit_Class: refined.Audit_Class,
      Proof_Status: refined.Proof_Status,
      Recommended_Zoho_Action: refined.Recommended_Zoho_Action,
      Notes: refined.Notes,
      Review_Flag: focus ? reviewFlagFor(refined) : row.Review_Flag,
    };
    refinedRows.push(revisedRow);

    if (!focus) continue;

    const finalTreatment = suggestedFinalTreatment(refined.Audit_Class, refined.Proof_Status);
    actionQueue.push({
      Statement_Date: revisedRow.Statement_Date,
      Statement_Amount: decimalToString(revisedRow.Statement_Amount),
      Payee: bankRow?.counterparty_hint || revisedRow.Payee || "",
      Transaction_Type: revisedRow.Transaction_Type,
      Old_Audit_Class: row.Audit_Class,
      Revised_Audit_Class: refined.Audit_Class,
      Proof_Status: refined.Proof_Status,
      Recommended_Zoho_Action: refined.Recommended_Zoho_Action,
      Suggested_Final_Treatment: finalTreatment,
      Legacy_Flag: revisedRow.Legacy_Flag,
      Notes: refined.Notes,
    });

    if (refined.Audit_Class === "OWNER_FUNDING" || refined.Audit_Class === "OWNER_DRAWING") {
      ownerQueue.push({
        Statement_Date: revisedRow.Statement_Date,
        Statement_Amount: decimalToString(revisedRow.Statement_Amount),
        Direction: revisedRow.Direction,
        Payee: bankRow?.counterparty_hint || revisedRow.Payee || "",
        Reference_Number: bankRow?.reference || revisedRow.Reference_Number || "",
        Current_Audit_Class: row.Audit_Class,
        Revised_Audit_Class: refined.Audit_Class,
        Proof_Status: refined.Proof_Status,
        Reason_For_Classification: refined.Reason_For_Classification,
        Suggested_Final_Treatment: finalTreatment || "HOLD_PENDING_EVIDENCE",
        Notes: truncate(bankRow?.narration || refined.Notes, 160),
      });
    }

    if (refined.Audit_Class === "GST_PAYMENT" || refined.Audit_Class === "INCOME_TAX_PAYMENT") {
      const period = refined.Month_Period || revisedRow.Statement_Date;
      const suggestedLink = refined.Audit_Class === "GST_PAYMENT"
        ? `Check GST challan / GSTR-3B around ${period}${bankRow?.reference ? ` (ref ${bankRow.reference})` : ""}`
        : `Check OLTAS/NSDL challan around ${period}${bankRow?.reference ? ` (ref ${bankRow.reference})` : ""}`;
      statutoryQueue.push({
        Statement_Date: revisedRow.Statement_Date,
        Statement_Amount: decimalToString(revisedRow.Statement_Amount),
        Payee: bankRow?.counterparty_hint || revisedRow.Payee || "",
        Reference_Number: bankRow?.reference || revisedRow.Reference_Number || "",
        Revised_Audit_Class: refined.Audit_Class,
        Proof_Status: refined.Proof_Status,
        Likely_Month_or_Period: period,
        Suggested_Link: suggestedLink,
        Notes: truncate(refined.Notes, 160),
      });
    }
  }

  const countClass = (auditClass) => refinedRows.filter((currentRow) => currentRow.Audit_Class === auditClass).length;
  const summaryRows = [
    { Metric: "old_EXPENSE_UNCLEAR_count", Value: String(oldExpenseUnclearCount) },
    { Metric: "new_OPERATING_EXPENSE_CLEAR_count", Value: String(countClass("OPERATING_EXPENSE_CLEAR")) },
    { Metric: "new_OPERATING_EXPENSE_REVIEW_count", Value: String(countClass("OPERATING_EXPENSE_REVIEW")) },
    { Metric: "new_GST_PAYMENT_count", Value: String(countClass("GST_PAYMENT")) },
    { Metric: "new_INCOME_TAX_PAYMENT_count", Value: String(countClass("INCOME_TAX_PAYMENT")) },
    { Metric: "new_BANK_CHARGES_count", Value: String(countClass("BANK_CHARGES")) },
    { Metric: "new_INTEREST_count", Value: String(countClass("INTEREST")) },
    { Metric: "new_OWNER_FUNDING_count", Value: String(countClass("OWNER_FUNDING")) },
    { Metric: "new_OWNER_DRAWING_count", Value: String(countClass("OWNER_DRAWING")) },
    { Metric: "new_VENDOR_PAYMENT_count", Value: String(countClass("VENDOR_PAYMENT")) },
    { Metric: "new_CUSTOMER_RECEIPT_count", Value: String(countClass("CUSTOMER_RECEIPT")) },
    { Metric: "remaining_UNKNOWN_count", Value: String(countClass("UNKNOWN")) },
    {
      Metric: "focus_rows_reclassified",
      Value: String(refinedRows.filter((currentRow) => FOCUS_CLASSES.has(currentRow.Old_Audit_Class) && currentRow.Audit_Class !== currentRow.Old_Audit_Class).length),
    },
    { Metric: "owner_queue_rows", Value: String(ownerQueue.length) },
    { Metric: "statutory_queue_rows", Value: String(statutoryQueue.length) },
  ];

  const proofCounts = new Map();
  for (const currentRow of refinedRows) {
    proofCounts.set(currentRow.Proof_Status, (proofCounts.get(currentRow.Proof_Status) || 0) + 1);
  }
  for (const [proofStatus, count] of Array.from(proofCounts.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
    summaryRows.push({ Metric: `proof_status_${proofStatus}`, Value: String(count) });
  }

  const matchedHeaders = Array.from(
    refinedRows.reduce((headers, currentRow) => {
      for (const header of Object.keys(currentRow)) headers.add(header);
      return headers;
    }, new Set()),
  );

  writeCsv(path.join(OUTPUT_DIR, "sattva_fy23_24_matched_master_v2.csv"), matchedHeaders, refinedRows);
  writeCsv(path.join(OUTPUT_DIR, "sattva_fy23_24_owner_flow_queue_v1.csv"), [
    "Statement_Date",
    "Statement_Amount",
    "Direction",
    "Payee",
    "Reference_Number",
    "Current_Audit_Class",
    "Revised_Audit_Class",
    "Proof_Status",
    "Reason_For_Classification",
    "Suggested_Final_Treatment",
    "Notes",
  ], ownerQueue);
  writeCsv(path.join(OUTPUT_DIR, "sattva_fy23_24_statutory_payment_queue_v1.csv"), [
    "Statement_Date",
    "Statement_Amount",
    "Payee",
    "Reference_Number",
    "Revised_Audit_Class",
    "Proof_Status",
    "Likely_Month_or_Period",
    "Suggested_Link",
    "Notes",
  ], statutoryQueue);
  writeCsv(path.join(OUTPUT_DIR, "sattva_fy23_24_zoho_action_queue_v2.csv"), [
    "Statement_Date",
    "Statement_Amount",
    "Payee",
    "Transaction_Type",
    "Old_Audit_Class",
    "Revised_Audit_Class",
    "Proof_Status",
    "Recommended_Zoho_Action",
    "Suggested_Final_Treatment",
    "Legacy_Flag",
    "Notes",
  ], actionQueue);
  writeCsv(path.join(OUTPUT_DIR, "sattva_fy23_24_unclear_reduction_summary_v1.csv"), ["Metric", "Value"], summaryRows);

  console.log(`old_EXPENSE_UNCLEAR_count,${oldExpenseUnclearCount}`);
  console.log(`new_OPERATING_EXPENSE_CLEAR_count,${countClass("OPERATING_EXPENSE_CLEAR")}`);
  console.log(`new_OPERATING_EXPENSE_REVIEW_count,${countClass("OPERATING_EXPENSE_REVIEW")}`);
  console.log(`GST_PAYMENT_count,${countClass("GST_PAYMENT")}`);
  console.log(`INCOME_TAX_PAYMENT_count,${countClass("INCOME_TAX_PAYMENT")}`);
  console.log(`BANK_CHARGES_count,${countClass("BANK_CHARGES")}`);
  console.log(`INTEREST_count,${countClass("INTEREST")}`);
  console.log(`OWNER_FUNDING_count,${countClass("OWNER_FUNDING")}`);
  console.log(`OWNER_DRAWING_count,${countClass("OWNER_DRAWING")}`);
  console.log(`UNKNOWN_count_remaining,${countClass("UNKNOWN")}`);
  for (const [proofStatus, count] of Array.from(proofCounts.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
    console.log(`Proof_Status_${proofStatus},${count}`);
  }
}

main();
