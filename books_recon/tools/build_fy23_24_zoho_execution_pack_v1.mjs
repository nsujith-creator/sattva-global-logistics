import fs from "fs";
import path from "path";

const ROOT = "C:\\sattva\\books_recon\\data\\exports\\reconciliation_status_fy23_24";

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
  if (field.length || current.length) {
    current.push(field);
    rows.push(current);
  }
  const cleaned = rows.filter((row) => row.some((cell) => String(cell || "").trim() !== ""));
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
  fs.writeFileSync(filePath, `\uFEFF${lines.join("\r\n")}\r\n`, "utf8");
}

function normalizeText(value) {
  return String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildKey(dateText, amountText, payee) {
  return [dateText || "", amountText || "", normalizeText(payee)].join("|");
}

function indexByKey(rows, payeeField = "Payee") {
  const map = new Map();
  for (const row of rows) {
    const key = buildKey(row.Statement_Date, row.Statement_Amount, row[payeeField] || row.Bank_Counterparty_Hint || row.Payee);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(row);
  }
  return map;
}

function takeIndexed(index, dateText, amountText, payee) {
  const key = buildKey(dateText, amountText, payee);
  const list = index.get(key) || [];
  if (!list.length) return null;
  return list.shift();
}

function targetAccountForClearExpense(payee) {
  const text = normalizeText(payee);
  if (text.includes("ZOHO") || text.includes("MICROSOFT") || text.includes("CANVA") || text.includes("GOOGLE CLOUD") || text.includes("MCAFEE")) {
    return "Software & SaaS Expense";
  }
  if (text.includes("AIRTEL")) {
    return "Telephone & Internet Expense";
  }
  return "Operating Expense - Clear";
}

function executionFields(row, ownerRow, statutoryRow, unknownRow) {
  const cls = row.Revised_Audit_Class;
  const proof = row.Proof_Status;
  const notes = row.Notes || "";

  if (row.Legacy_Flag === "YES" || cls === "LEGACY_OPENING_MISMATCH") {
    return {
      Execution_Bucket: "LEGACY_HOLD",
      Execution_Priority: "P4",
      Execution_Status: "HOLD_PENDING_REVIEW",
      Zoho_Module: "NO_ACTION_YET",
      Target_Account: "Legacy Opening Suspense",
      Preferred_Action_Type: "KEEP_UNCHANGED_PENDING_REVIEW",
      Journal_Allowed: "NO",
      Why_Not_Ready: "Legacy/opening contamination should not be posted through the FY23-24 execution pack.",
    };
  }

  if (cls === "BANK_CHARGES" && proof !== "NOT_PROVEN") {
    return {
      Execution_Bucket: "BANK_CHARGES_READY",
      Execution_Priority: "P1",
      Execution_Status: "READY_TO_EXECUTE",
      Zoho_Module: "BANKING",
      Target_Account: "Bank Charges & Fees",
      Preferred_Action_Type: "RECATEGORIZE_BANK_TRANSACTION",
      Journal_Allowed: "NO",
      Why_Not_Ready: "",
    };
  }

  if (cls === "INTEREST" && proof !== "NOT_PROVEN") {
    return {
      Execution_Bucket: "INTEREST_READY",
      Execution_Priority: "P1",
      Execution_Status: "READY_TO_EXECUTE",
      Zoho_Module: "BANKING",
      Target_Account: "Interest Income",
      Preferred_Action_Type: "RECATEGORIZE_BANK_TRANSACTION",
      Journal_Allowed: "NO",
      Why_Not_Ready: "",
    };
  }

  if (cls === "GST_PAYMENT" && proof !== "NOT_PROVEN") {
    return {
      Execution_Bucket: "GST_PAYMENT_READY",
      Execution_Priority: "P1",
      Execution_Status: "READY_TO_EXECUTE",
      Zoho_Module: "TAXES",
      Target_Account: "GST Payment Clearing",
      Preferred_Action_Type: "TAG_STATUTORY_PAYMENT",
      Journal_Allowed: "NO",
      Why_Not_Ready: "",
    };
  }

  if (cls === "VENDOR_PAYMENT") {
    return {
      Execution_Bucket: "VENDOR_RELINK_READY",
      Execution_Priority: "P2",
      Execution_Status: "HOLD_NEEDS_RELINK",
      Zoho_Module: "PURCHASES",
      Target_Account: "Vendor Bill / Bill Payment Link",
      Preferred_Action_Type: "RELINK_VENDOR_PAYMENT",
      Journal_Allowed: "NO",
      Why_Not_Ready: "Vendor-side route is correct, but the exact Zoho bill/payment object relink is not proven in the supplied pack.",
    };
  }

  if (cls === "OPERATING_EXPENSE_CLEAR" && proof !== "NOT_PROVEN") {
    return {
      Execution_Bucket: "OPERATING_EXPENSE_CLEAR_READY",
      Execution_Priority: "P1",
      Execution_Status: "READY_TO_EXECUTE",
      Zoho_Module: "BANKING",
      Target_Account: targetAccountForClearExpense(row.Payee),
      Preferred_Action_Type: "RECATEGORIZE_BANK_TRANSACTION",
      Journal_Allowed: "NO",
      Why_Not_Ready: "",
    };
  }

  if (cls === "OWNER_DRAWING" && proof !== "NOT_PROVEN" && ownerRow?.Suggested_Final_Treatment === "POST_AS_OWNER_DRAWING") {
    return {
      Execution_Bucket: "OWNER_DRAWING_READY",
      Execution_Priority: "P1",
      Execution_Status: "READY_TO_EXECUTE",
      Zoho_Module: "ACCOUNTANT_JOURNAL",
      Target_Account: "Owner Drawings / Due from Proprietor",
      Preferred_Action_Type: "POST_OWNER_DRAWING",
      Journal_Allowed: "YES",
      Why_Not_Ready: "",
    };
  }

  if (cls === "OWNER_FUNDING" || cls === "OWNER_DRAWING") {
    return {
      Execution_Bucket: "OWNER_FLOW_HOLD",
      Execution_Priority: "P2",
      Execution_Status: "HOLD_OWNER_CLASSIFICATION",
      Zoho_Module: "NO_ACTION_YET",
      Target_Account: "Owner Clearing / Capital Review",
      Preferred_Action_Type: cls === "OWNER_FUNDING" ? "POST_OWNER_LOAN" : "POST_OWNER_DRAWING",
      Journal_Allowed: "YES",
      Why_Not_Ready: ownerRow?.Reason_For_Classification || "Owner route is indicated, but execution should wait until owner classification is signed off.",
    };
  }

  if (cls === "OPERATING_EXPENSE_REVIEW") {
    return {
      Execution_Bucket: "EXPENSE_REVIEW_HOLD",
      Execution_Priority: "P3",
      Execution_Status: proof === "NOT_PROVEN" ? "HOLD_NOT_PROVEN" : "HOLD_PENDING_REVIEW",
      Zoho_Module: "NO_ACTION_YET",
      Target_Account: "Expense Review Hold",
      Preferred_Action_Type: "KEEP_UNCHANGED_PENDING_REVIEW",
      Journal_Allowed: "NO",
      Why_Not_Ready: notes || "Expense looks business-related but is not provable enough for execution.",
    };
  }

  if (cls === "UNKNOWN") {
    return {
      Execution_Bucket: "UNKNOWN_HOLD",
      Execution_Priority: "P4",
      Execution_Status: "HOLD_NOT_PROVEN",
      Zoho_Module: "NO_ACTION_YET",
      Target_Account: "Unclassified Bank Suspense",
      Preferred_Action_Type: "KEEP_UNCHANGED_PENDING_REVIEW",
      Journal_Allowed: "NO",
      Why_Not_Ready: unknownRow?.Reason_For_Bucket || notes || "Unknown items must remain on hold until new evidence appears.",
    };
  }

  return {
    Execution_Bucket: "UNKNOWN_HOLD",
    Execution_Priority: "P4",
    Execution_Status: "HOLD_PENDING_REVIEW",
    Zoho_Module: "NO_ACTION_YET",
    Target_Account: "Unclassified Bank Suspense",
    Preferred_Action_Type: "KEEP_UNCHANGED_PENDING_REVIEW",
    Journal_Allowed: "NO",
    Why_Not_Ready: "Row did not meet a posting-ready rule in the execution pack builder.",
  };
}

function main() {
  const matchedRows = parseCsv(fs.readFileSync(path.join(ROOT, "sattva_fy23_24_matched_master_v4.csv"), "utf8"));
  const actionRows = parseCsv(fs.readFileSync(path.join(ROOT, "sattva_fy23_24_zoho_action_queue_v4.csv"), "utf8"));
  const ownerRows = parseCsv(fs.readFileSync(path.join(ROOT, "sattva_fy23_24_owner_flow_queue_v2.csv"), "utf8"));
  const statutoryRows = parseCsv(fs.readFileSync(path.join(ROOT, "sattva_fy23_24_statutory_payment_queue_v2.csv"), "utf8"));
  const unknownRows = parseCsv(fs.readFileSync(path.join(ROOT, "sattva_fy23_24_unknown_micro_queue_v1.csv"), "utf8"));

  const matchedIndex = indexByKey(matchedRows, "Bank_Counterparty_Hint");
  const ownerIndex = indexByKey(ownerRows);
  const statutoryIndex = indexByKey(statutoryRows);
  const unknownIndex = indexByKey(unknownRows);

  const executionPack = [];
  for (const actionRow of actionRows) {
    const matchedRow =
      takeIndexed(matchedIndex, actionRow.Statement_Date, actionRow.Statement_Amount, actionRow.Payee) ||
      takeIndexed(matchedIndex, actionRow.Statement_Date, actionRow.Statement_Amount, "");
    const ownerRow = takeIndexed(ownerIndex, actionRow.Statement_Date, actionRow.Statement_Amount, actionRow.Payee);
    const statutoryRow = takeIndexed(statutoryIndex, actionRow.Statement_Date, actionRow.Statement_Amount, actionRow.Payee);
    const unknownRow = takeIndexed(unknownIndex, actionRow.Statement_Date, actionRow.Statement_Amount, actionRow.Payee);
    const execution = executionFields(actionRow, ownerRow, statutoryRow, unknownRow);

    executionPack.push({
      Statement_ID: matchedRow?.Statement_ID || "",
      Statement_Date: actionRow.Statement_Date,
      Statement_Amount: actionRow.Statement_Amount,
      Direction: matchedRow?.Direction || "",
      Payee: actionRow.Payee,
      Reference_Number: matchedRow?.Bank_Reference || matchedRow?.Reference_Number || ownerRow?.Reference_Number || statutoryRow?.Reference_Number || unknownRow?.Reference_Number || "",
      Transaction_Type: actionRow.Transaction_Type,
      Old_Audit_Class: actionRow.Old_Audit_Class,
      Revised_Audit_Class: actionRow.Revised_Audit_Class,
      Proof_Status: actionRow.Proof_Status,
      Residual_Unknown_Bucket: unknownRow?.Residual_Unknown_Bucket || actionRow.Residual_Unknown_Bucket || "",
      Bank_Narration: matchedRow?.Bank_Narration || "",
      Notes: actionRow.Notes,
      Execution_Bucket: execution.Execution_Bucket,
      Execution_Priority: execution.Execution_Priority,
      Execution_Status: execution.Execution_Status,
      Zoho_Module: execution.Zoho_Module,
      Target_Account: execution.Target_Account,
      Preferred_Action_Type: execution.Preferred_Action_Type,
      Journal_Allowed: execution.Journal_Allowed,
      Why_Not_Ready: execution.Why_Not_Ready,
      Recommended_Zoho_Action: actionRow.Recommended_Zoho_Action,
      Suggested_Final_Treatment: actionRow.Suggested_Final_Treatment,
      Statutory_Period: statutoryRow?.Likely_Month_or_Period || "",
      Statutory_Link: statutoryRow?.Suggested_Link || "",
      Owner_Reason: ownerRow?.Reason_For_Classification || "",
    });
  }

  const readyRows = executionPack.filter((row) => row.Execution_Status === "READY_TO_EXECUTE");
  const holdRows = executionPack.filter((row) => row.Execution_Status !== "READY_TO_EXECUTE");
  const vendorRelinkRows = executionPack.filter((row) => row.Execution_Bucket === "VENDOR_RELINK_READY");
  const ownerPostingRows = executionPack.filter((row) => row.Execution_Bucket === "OWNER_DRAWING_READY" || row.Execution_Bucket === "OWNER_FLOW_HOLD");
  const statutoryTagRows = executionPack.filter((row) => row.Execution_Bucket === "GST_PAYMENT_READY");

  const headers = Array.from(
    executionPack.reduce((set, row) => {
      for (const header of Object.keys(row)) set.add(header);
      return set;
    }, new Set()),
  );

  writeCsv(path.join(ROOT, "sattva_fy23_24_zoho_execution_pack_v1.csv"), headers, executionPack);
  writeCsv(path.join(ROOT, "sattva_fy23_24_ready_to_execute_v1.csv"), headers, readyRows);
  writeCsv(path.join(ROOT, "sattva_fy23_24_hold_queue_v1.csv"), headers, holdRows);
  writeCsv(path.join(ROOT, "sattva_fy23_24_vendor_relink_queue_v1.csv"), headers, vendorRelinkRows);
  writeCsv(path.join(ROOT, "sattva_fy23_24_owner_posting_queue_v1.csv"), headers, ownerPostingRows);
  writeCsv(path.join(ROOT, "sattva_fy23_24_statutory_tag_queue_v1.csv"), headers, statutoryTagRows);

  const bucketCounts = new Map();
  let journalYes = 0;
  let journalNo = 0;
  for (const row of executionPack) {
    bucketCounts.set(row.Execution_Bucket, (bucketCounts.get(row.Execution_Bucket) || 0) + 1);
    if (row.Journal_Allowed === "YES") journalYes += 1;
    if (row.Journal_Allowed === "NO") journalNo += 1;
  }

  console.log(`READY_TO_EXECUTE_count,${readyRows.length}`);
  console.log(`HOLD_count,${holdRows.length}`);
  for (const [bucket, count] of Array.from(bucketCounts.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
    console.log(`${bucket},${count}`);
  }
  console.log(`Journal_Allowed_YES,${journalYes}`);
  console.log(`Journal_Allowed_NO,${journalNo}`);
}

main();
