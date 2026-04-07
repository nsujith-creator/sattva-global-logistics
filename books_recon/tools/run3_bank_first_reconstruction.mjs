import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";

const POWERSHELL = "C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe";
const FY_START = new Date("2023-04-01T00:00:00Z");
const FY_END = new Date("2024-03-31T00:00:00Z");
const BANK_CLASSIFICATIONS = new Set([
  "CUSTOMER_RECEIPT",
  "VENDOR_PAYMENT",
  "GST_PAYMENT",
  "INCOME_TAX_PAYMENT",
  "BANK_CHARGES",
  "INTEREST",
  "OWNER_FUNDING",
  "OWNER_DRAWING",
  "TRANSFER_INTERNAL",
  "UNKNOWN",
]);

const COMPANY_NOISE = new Set([
  "PRIVATE",
  "PVT",
  "LIMITED",
  "LTD",
  "LLP",
  "INDIA",
  "SERVICES",
  "SERVICE",
  "COMPANY",
  "CO",
  "CORPORATION",
  "CORP",
  "PTE",
  "SHIPPING",
  "LOGISTICS",
  "LOGISTIX",
  "AGENCIES",
  "AGENCY",
  "ONLINE",
  "SOLUTIONS",
  "GLOBAL",
  "LINE",
  "LINES",
  "INTERNATIONAL",
  "PVT",
  "SA",
  "INDICO",
  "CAS",
]);

const OWNER_PATTERNS = [
  "SUJITH",
  "NSUJITH",
  "13590100051909",
  " 51909 ",
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
];

const INTEREST_PATTERNS = [
  "INTEREST",
  "INT CR",
  "INT.CR",
  "INT CREDIT",
  "INT PD",
  "INTEREST CREDIT",
];

const INTERNAL_TRANSFER_PATTERNS = [
  "SWEEP",
  "REVERSAL",
  "RVSL",
  "TRANSFER BETWEEN",
  "OWN ACCOUNT",
];

const GENERIC_COUNTERPARTY_PATTERNS = [
  "BILL NO",
  "BILL NOS",
  "PAYMENT",
  "CHARGE",
  "MAINTENANCE",
  "GST",
  "CGST",
  "SGST",
  "IGST",
  "TAX",
  "GOOGLE PLAY",
  "AMAZON",
  "REFUND",
  "RVSL",
];

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

function vendorTokenize(value) {
  return normalizeText(value)
    .split(" ")
    .filter((token) => token && token.length >= 3 && !COMPANY_NOISE.has(token));
}

function toNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function round(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function decimalToString(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return "";
  return round(value).toFixed(2);
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

function formatDate(value) {
  return value ? value.toISOString().slice(0, 10) : "";
}

function daysBetween(a, b) {
  return Math.abs(Math.round((a.getTime() - b.getTime()) / 86400000));
}

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

function tokenSimilarity(a, b) {
  const left = new Set(vendorTokenize(a));
  const right = new Set(vendorTokenize(b));
  if (!left.size || !right.size) return 0;
  let intersection = 0;
  for (const token of left) {
    if (right.has(token)) intersection += 1;
  }
  return intersection / Math.max(left.size, right.size);
}

function containsPattern(normalizedPadded, patterns) {
  return patterns.some((pattern) => normalizedPadded.includes(pattern));
}

function isOwnerPattern(txn) {
  const padded = normalizeTextPadded(`${txn.narration} ${txn.counterparty_hint || ""}`);
  return OWNER_PATTERNS.some((pattern) => padded.includes(pattern));
}

function isLikelyCharge(txn) {
  const padded = normalizeTextPadded(`${txn.narration} ${txn.counterparty_hint || ""}`);
  return containsPattern(padded, BANK_CHARGE_PATTERNS);
}

function isInterest(txn) {
  const padded = normalizeTextPadded(`${txn.narration} ${txn.counterparty_hint || ""}`);
  return containsPattern(padded, INTEREST_PATTERNS);
}

function isGst(txn) {
  const padded = normalizeTextPadded(`${txn.narration} ${txn.counterparty_hint || ""}`);
  return containsPattern(padded, GST_PATTERNS);
}

function isIncomeTax(txn) {
  const padded = normalizeTextPadded(`${txn.narration} ${txn.counterparty_hint || ""}`);
  return containsPattern(padded, INCOME_TAX_PATTERNS);
}

function isInternalTransfer(txn) {
  const padded = normalizeTextPadded(`${txn.narration} ${txn.counterparty_hint || ""}`);
  return containsPattern(padded, INTERNAL_TRANSFER_PATTERNS);
}

function hasUsableVendorCue(txn) {
  const hint = normalizeText(txn.counterparty_hint || "");
  const narration = normalizeText(txn.narration || "");
  if (!hint && !narration) return false;
  const padded = normalizeTextPadded(`${hint} ${narration}`);
  if (GENERIC_COUNTERPARTY_PATTERNS.some((pattern) => padded.includes(` ${pattern} `))) {
    return false;
  }
  const hintTokens = vendorTokenize(hint);
  if (hintTokens.length >= 1) return true;
  if (/FN SHP|NFT|NEFT|RTGS|IMPS/.test(narration) && narration.split(" ").length >= 3) {
    return true;
  }
  return false;
}

function runBankSeedParser(bankXlsxPath, repoRoot, seedPrefix) {
  const scriptPath = path.join(repoRoot, "tools", "reconstruct_bank_3326_fy2023_24.ps1");
  execFileSync(
    POWERSHELL,
    [
      "-File",
      scriptPath,
      "-StatementPath",
      bankXlsxPath,
      "-RepoRoot",
      repoRoot,
      "-OutputPrefix",
      seedPrefix,
    ],
    { stdio: "pipe", encoding: "utf8", maxBuffer: 20 * 1024 * 1024 },
  );
  return path.join(repoRoot, "data", "exports", `${seedPrefix}.transactions.json`);
}

function buildBillIndex(bills) {
  return bills.map((bill) => ({
    ...bill,
    billDateObj: parseDate(bill.Document_Date || bill.Date),
    totalAmount: toNumber(bill.Clean_Total_Amount),
    balanceDue: toNumber(bill.Clean_Balance_Due),
    vendorNormalized: bill.Party_Name_Normalized || normalizeText(bill["Vendor Name"] || ""),
    billNumberNormalized: normalizeText(bill["Bill#"] || ""),
    referenceNormalized: normalizeText(bill["Reference Number"] || ""),
  }));
}

function buildMatchCandidates(txn, bills) {
  if (txn.Direction !== "OUTFLOW") return [];
  const txnDate = parseDate(txn.transaction_date);
  if (!txnDate) return [];
  const narrationNorm = normalizeText(txn.narration);
  const hintNorm = normalizeText(txn.counterparty_hint || "");
  const searchText = `${narrationNorm} ${hintNorm}`.trim();
  const results = [];

  for (const bill of bills) {
    if (!bill.billDateObj) continue;
    const dateDelta = daysBetween(txnDate, bill.billDateObj);
    if (dateDelta > 60) continue;

    const nameSimilarity = Math.max(
      tokenSimilarity(searchText, bill.vendorNormalized),
      tokenSimilarity(hintNorm, bill.vendorNormalized),
    );
    const billNumberHit = bill.billNumberNormalized && narrationNorm.includes(bill.billNumberNormalized);
    const referenceHit = bill.referenceNormalized && narrationNorm.includes(bill.referenceNormalized);
    const amountTargets = [bill.totalAmount, bill.balanceDue].filter((value) => value !== null && value > 0);
    if (!amountTargets.length) continue;
    const bestAmountTarget = amountTargets
      .map((target) => ({
        target,
        deltaPct: Math.abs(txn.Clean_Amount - target) / target,
      }))
      .sort((a, b) => a.deltaPct - b.deltaPct)[0];

    const amountWithin3 = bestAmountTarget.deltaPct <= 0.03;
    const amountWithin10 = bestAmountTarget.deltaPct <= 0.1;
    const hasNameEvidence = nameSimilarity >= 0.35 || billNumberHit || referenceHit;
    if (!hasNameEvidence) continue;
    if (!amountWithin10 && !billNumberHit && !referenceHit) continue;

    let score = 0;
    if (billNumberHit) score += 0.45;
    if (referenceHit) score += 0.25;
    score += Math.min(0.4, nameSimilarity * 0.4);
    if (amountWithin3) score += 0.25;
    else if (amountWithin10) score += 0.1;
    score += Math.max(0, 0.1 - dateDelta / 1000);
    score = Math.min(0.99, round(score));

    let confidence = "LOW";
    if ((billNumberHit || referenceHit || nameSimilarity >= 0.65) && amountWithin3 && dateDelta <= 45) {
      confidence = "HIGH";
    } else if (nameSimilarity >= 0.45 && amountWithin3) {
      confidence = "MEDIUM";
    } else if ((billNumberHit || referenceHit || nameSimilarity >= 0.35) && amountWithin10) {
      confidence = "LOW";
    }

    const flags = [];
    if (!amountWithin3) flags.push("AMOUNT_MISMATCH");

    results.push({
      bill,
      score,
      confidence,
      partySimilarity: round(nameSimilarity),
      amountDeltaPct: round(bestAmountTarget.deltaPct * 100),
      dateDeltaDays: dateDelta,
      amountTarget: bestAmountTarget.target,
      billNumberHit,
      referenceHit,
      flags,
    });
  }

  return results.sort((a, b) => {
    const confidenceRank = { HIGH: 3, MEDIUM: 2, LOW: 1, NONE: 0 };
    if (confidenceRank[b.confidence] !== confidenceRank[a.confidence]) {
      return confidenceRank[b.confidence] - confidenceRank[a.confidence];
    }
    if (b.score !== a.score) return b.score - a.score;
    return a.dateDeltaDays - b.dateDeltaDays;
  });
}

function classifyTransaction(txn, candidates) {
  const direction = txn.direction === "credit" ? "INFLOW" : "OUTFLOW";
  const owner = isOwnerPattern(txn);
  const charge = isLikelyCharge(txn);
  const interest = isInterest(txn);
  const gst = isGst(txn);
  const incomeTax = isIncomeTax(txn);
  const internalTransfer = isInternalTransfer(txn);

  let classification = "UNKNOWN";
  let confidence = "LOW";
  let basis = "No rule reached audit-safe confidence.";

  if (direction === "INFLOW") {
    if (owner) {
      classification = "OWNER_FUNDING";
      confidence = "HIGH";
      basis = "Narration matches owner/personal account patterns.";
    } else if (charge) {
      classification = "BANK_CHARGES";
      confidence = "HIGH";
      basis = "Charge or charge-reversal narration.";
    } else if (interest) {
      classification = "INTEREST";
      confidence = "HIGH";
      basis = "Interest keyword in narration.";
    } else if (internalTransfer) {
      classification = "TRANSFER_INTERNAL";
      confidence = "MEDIUM";
      basis = "Internal transfer / reversal style narration.";
    } else if (
      (txn.customer_contact_match && toNumber(txn.customer_contact_match.score) >= 0.55) ||
      (txn.classification_tag === "client receipt candidate" &&
        txn.counterparty_hint &&
        !/REFUND|RVSL|REVERSAL|CASHBACK/i.test(txn.narration))
    ) {
      classification = "CUSTOMER_RECEIPT";
      confidence = txn.customer_contact_match && toNumber(txn.customer_contact_match.score) >= 0.55 ? "HIGH" : "MEDIUM";
      basis = "Bank inflow suggests customer counterparty.";
    }
  } else {
    if (owner) {
      classification = "OWNER_DRAWING";
      confidence = "HIGH";
      basis = "Narration matches owner/personal account patterns.";
    } else if (gst) {
      classification = "GST_PAYMENT";
      confidence = "HIGH";
      basis = "GST keyword in narration.";
    } else if (incomeTax) {
      classification = "INCOME_TAX_PAYMENT";
      confidence = "HIGH";
      basis = "Income-tax keyword in narration.";
    } else if (charge) {
      classification = "BANK_CHARGES";
      confidence = "HIGH";
      basis = "Charge narration.";
    } else if (interest) {
      classification = "INTEREST";
      confidence = "HIGH";
      basis = "Interest narration.";
    } else if (internalTransfer) {
      classification = "TRANSFER_INTERNAL";
      confidence = "MEDIUM";
      basis = "Internal transfer / reversal style narration.";
    } else if (candidates.length) {
      classification = "VENDOR_PAYMENT";
      confidence = candidates[0].confidence;
      basis = candidates[0].billNumberHit || candidates[0].referenceHit
        ? "Narration contains bill/reference and date/amount window fits."
        : "Debit aligns to vendor bill by party/date/amount.";
    } else if (txn.vendor_contact_match && toNumber(txn.vendor_contact_match.score) >= 0.6) {
      classification = "VENDOR_PAYMENT";
      confidence = "MEDIUM";
      basis = "Vendor contact match from bank narration.";
    } else if (txn.classification_tag === "vendor payment candidate" && hasUsableVendorCue(txn)) {
      classification = "VENDOR_PAYMENT";
      confidence = "LOW";
      basis = "Debit-side bank narration suggests an external vendor payment, but no safe bill match was proven.";
    }
  }

  if (!BANK_CLASSIFICATIONS.has(classification)) {
    throw new Error(`Unexpected classification ${classification}`);
  }

  return { classification, confidence, basis, direction };
}

function main() {
  const args = process.argv.slice(2);
  const getArg = (name, fallback = null) => {
    const index = args.indexOf(name);
    return index >= 0 ? args[index + 1] : fallback;
  };

  const repoRoot = getArg("--repo-root", "C:\\sattva\\books_recon");
  const bankXlsxPath = getArg("--bank-xlsx");
  const bankJsonPathArg = getArg("--bank-json");
  const billsCsvPath = getArg("--bills-csv");
  const exceptionCsvPath = getArg("--exception-csv");
  const outputDir = getArg("--output-dir");
  const seedPrefix = getArg("--seed-prefix", "3326_fy2023_24_run3_seed");

  if ((!bankXlsxPath && !bankJsonPathArg) || !billsCsvPath || !exceptionCsvPath || !outputDir) {
    throw new Error("Usage: node run3_bank_first_reconstruction.mjs --bank-xlsx <xlsx>|--bank-json <json> --bills-csv <csv> --exception-csv <csv> --output-dir <dir> [--repo-root <dir>] [--seed-prefix <prefix>]");
  }

  const bankJsonPath = bankJsonPathArg || runBankSeedParser(bankXlsxPath, repoRoot, seedPrefix);
  const transactions = JSON.parse(fs.readFileSync(bankJsonPath, "utf8").replace(/^\uFEFF/, ""));
  const bills = parseCsv(fs.readFileSync(billsCsvPath, "utf8"));
  const exceptionRows = parseCsv(fs.readFileSync(exceptionCsvPath, "utf8"));
  const exceptionBillIds = new Set(exceptionRows.map((row) => row.BILL_ID).filter(Boolean));
  const billIndex = buildBillIndex(bills.filter((row) => row.Document_Type === "VENDOR_BILL"));

  const bankClassifiedRows = [];
  const bankBillMatchRows = [];
  const reconciliationGaps = [];
  const cleanPostingBase = [];
  const matchedBillIdsHigh = new Set();
  let ownerFundingTotal = 0;
  let ownerDrawingTotal = 0;
  let classifiedCount = 0;
  let vendorPaymentsMatched = 0;
  let unmatchedBankPayments = 0;

  for (const txn of transactions) {
    const transactionId = `TXN-${String(txn.statement_row).padStart(4, "0")}-${txn.transaction_date}-${decimalToString(txn.amount)}`;
    const candidates = buildMatchCandidates(
      {
        ...txn,
        Direction: txn.direction === "credit" ? "INFLOW" : "OUTFLOW",
        Clean_Amount: round(toNumber(txn.amount)),
      },
      billIndex,
    );
    const classification = classifyTransaction(txn, candidates);
    const cleanAmount = round(toNumber(txn.amount));
    const signedAmount = classification.direction === "INFLOW" ? cleanAmount : -cleanAmount;
    if (classification.classification !== "UNKNOWN") classifiedCount += 1;
    if (classification.classification === "OWNER_FUNDING") ownerFundingTotal += cleanAmount;
    if (classification.classification === "OWNER_DRAWING") ownerDrawingTotal += cleanAmount;

    let topCandidate = candidates[0] || null;
    const highCandidates = candidates.filter((candidate) => candidate.confidence === "HIGH");
    const multipleConflict = highCandidates.length > 1;
    if (multipleConflict) {
      topCandidate = null;
    }

    const gapFlags = [];
    if (classification.classification === "VENDOR_PAYMENT") {
      if (!topCandidate) {
        gapFlags.push("BANK_PAYMENT_WITH_NO_BILL");
        unmatchedBankPayments += 1;
      } else if (topCandidate.flags.includes("AMOUNT_MISMATCH")) {
        gapFlags.push("AMOUNT_MISMATCH");
      }
      if (multipleConflict) gapFlags.push("MULTIPLE_MATCH_CONFLICT");
    }

    const matchedBill = topCandidate ? topCandidate.bill : null;
    if (classification.classification === "VENDOR_PAYMENT" && topCandidate) {
      vendorPaymentsMatched += 1;
      if (topCandidate.confidence === "HIGH") {
        matchedBillIdsHigh.add(matchedBill.BILL_ID);
      }
    }

    bankClassifiedRows.push({
      Transaction_ID: transactionId,
      statement_row: String(txn.statement_row),
      transaction_date: txn.transaction_date,
      value_date: txn.value_date || "",
      narration: txn.narration,
      narration_normalized: normalizeText(txn.narration),
      counterparty_hint: txn.counterparty_hint || "",
      reference: txn.reference || "",
      transaction_type: txn.transaction_type || "",
      Direction: classification.direction,
      Clean_Amount: decimalToString(cleanAmount),
      Signed_Amount: decimalToString(signedAmount),
      debit: txn.debit === null ? "" : decimalToString(txn.debit),
      credit: txn.credit === null ? "" : decimalToString(txn.credit),
      balance: decimalToString(txn.balance),
      Bank_Classification: classification.classification,
      Classification_Confidence: classification.confidence,
      Classification_Basis: classification.basis,
      Matched_Bill_ID: matchedBill ? matchedBill.BILL_ID : "",
      Match_Confidence: topCandidate ? topCandidate.confidence : "NONE",
      Gap_Flags: gapFlags.join("|"),
    });

    if (classification.classification === "VENDOR_PAYMENT") {
      bankBillMatchRows.push({
        Transaction_ID: transactionId,
        transaction_date: txn.transaction_date,
        Clean_Amount: decimalToString(cleanAmount),
        counterparty_hint: txn.counterparty_hint || "",
        narration: txn.narration,
        Bank_Classification: classification.classification,
        Matched_Bill_ID: matchedBill ? matchedBill.BILL_ID : "",
        Bill_Number: matchedBill ? matchedBill["Bill#"] || "" : "",
        Reference_Number: matchedBill ? matchedBill["Reference Number"] || "" : "",
        Vendor_Name: matchedBill ? matchedBill["Vendor Name"] || "" : "",
        Bill_Date: matchedBill ? matchedBill.Document_Date || "" : "",
        Bill_Total_Amount: matchedBill ? decimalToString(matchedBill.totalAmount) : "",
        Bill_Balance_Due: matchedBill ? decimalToString(matchedBill.balanceDue) : "",
        Match_Confidence: topCandidate ? topCandidate.confidence : "NONE",
        Party_Similarity: topCandidate ? String(topCandidate.partySimilarity) : "",
        Amount_Delta_Pct: topCandidate ? decimalToString(topCandidate.amountDeltaPct) : "",
        Date_Delta_Days: topCandidate ? String(topCandidate.dateDeltaDays) : "",
        Candidate_Count: String(candidates.length),
        Gap_Flags: gapFlags.join("|"),
        Notes: topCandidate
          ? `Best amount target ${decimalToString(topCandidate.amountTarget)}; bill exception source=${exceptionBillIds.has(matchedBill.BILL_ID) ? "YES" : "NO"}`
          : "No audit-safe bill match in supplied bill dataset.",
      });
    }

    if (gapFlags.length) {
      reconciliationGaps.push({
        Source_Type: "BANK_TRANSACTION",
        Source_ID: transactionId,
        transaction_date: txn.transaction_date,
        Party_Name: txn.counterparty_hint || "",
        Clean_Amount: decimalToString(cleanAmount),
        Gap_Type: gapFlags.join("|"),
        Bank_Classification: classification.classification,
        Related_Bill_ID: matchedBill ? matchedBill.BILL_ID : "",
        Notes: classification.classification === "VENDOR_PAYMENT"
          ? "Vendor payment could not be matched safely against the supplied bill set."
          : classification.basis,
      });
    }

    const auditSafeNonVendor = new Set(["GST_PAYMENT", "INCOME_TAX_PAYMENT", "BANK_CHARGES", "INTEREST", "OWNER_FUNDING", "OWNER_DRAWING"]);
    const isAuditSafe =
      (auditSafeNonVendor.has(classification.classification) && classification.confidence === "HIGH") ||
      (classification.classification === "VENDOR_PAYMENT" && topCandidate && topCandidate.confidence === "HIGH" && gapFlags.length === 0);
    if (isAuditSafe) {
      cleanPostingBase.push({
        Transaction_ID: transactionId,
        transaction_date: txn.transaction_date,
        Direction: classification.direction,
        Clean_Amount: decimalToString(cleanAmount),
        Bank_Classification: classification.classification,
        Classification_Confidence: classification.confidence,
        Matched_Bill_ID: matchedBill ? matchedBill.BILL_ID : "",
        Counterparty: txn.counterparty_hint || "",
        Narration: txn.narration,
        Notes: classification.basis,
      });
    }
  }

  const fyBillUniverse = billIndex.filter((bill) => bill.billDateObj && bill.billDateObj >= FY_START && bill.billDateObj <= FY_END);
  const unmatchedBills = fyBillUniverse.filter((bill) => !matchedBillIdsHigh.has(bill.BILL_ID));
  for (const bill of unmatchedBills) {
    reconciliationGaps.push({
      Source_Type: "BILL",
      Source_ID: bill.BILL_ID,
      transaction_date: bill.Document_Date || "",
      Party_Name: bill["Vendor Name"] || "",
      Clean_Amount: decimalToString(bill.totalAmount),
      Gap_Type: "BILL_WITH_NO_BANK_MATCH",
      Bank_Classification: "",
      Related_Bill_ID: bill.BILL_ID,
      Notes: "No HIGH-confidence FY23-24 bank match found within the supplied bank statement and bill dataset.",
    });
  }

  const classifiedPct = transactions.length ? round((classifiedCount / transactions.length) * 100) : 0;
  const outputFiles = {
    bankClassified: path.join(outputDir, "sattva_bank_classified_v1.csv"),
    bankBillMatch: path.join(outputDir, "sattva_bank_bill_match_v1.csv"),
    reconciliationGaps: path.join(outputDir, "sattva_reconciliation_gaps_v1.csv"),
    cleanPostingBase: path.join(outputDir, "sattva_clean_posting_base_v1.csv"),
  };

  writeCsv(outputFiles.bankClassified, Object.keys(bankClassifiedRows[0] || {}), bankClassifiedRows);
  writeCsv(outputFiles.bankBillMatch, Object.keys(bankBillMatchRows[0] || {}), bankBillMatchRows);
  writeCsv(outputFiles.reconciliationGaps, Object.keys(reconciliationGaps[0] || {}), reconciliationGaps);
  writeCsv(outputFiles.cleanPostingBase, Object.keys(cleanPostingBase[0] || {}), cleanPostingBase);

  console.log("Run 3 Bank-First Summary");
  console.log(`total_bank_transactions,${transactions.length}`);
  console.log(`classified_vs_unknown_pct,${decimalToString(classifiedPct)}`);
  console.log(`total_vendor_payments_matched,${vendorPaymentsMatched}`);
  console.log(`unmatched_bank_payments,${unmatchedBankPayments}`);
  console.log(`unmatched_bills,${unmatchedBills.length}`);
  console.log(`owner_funding_total,${decimalToString(ownerFundingTotal)}`);
  console.log(`drawings_total,${decimalToString(ownerDrawingTotal)}`);
  console.log(`bill_dataset_fy23_24_scope,${fyBillUniverse.length}`);
}

main();
