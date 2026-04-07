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

function classifyResidualUnknown(row) {
  const text = normalizeText(`${row.Bank_Counterparty_Hint} ${row.Bank_Narration}`);

  if (text.includes("RTN") || text.includes("REVERSAL") || text.includes("ANY OTHER RESONS")) {
    return {
      bucket: "RETURN_REVERSAL_UNKNOWN",
      reason: "Statement narration is a return/reversal style movement and does not support revenue or expense posting.",
      suggested: "HOLD_PENDING_EVIDENCE",
    };
  }

  if (
    text.includes("NBFCIIFL") ||
    text.includes("MONEYVIEW") ||
    text.includes("KRAZYBEE") ||
    text.includes("SIMPL") ||
    text.includes("SAYYAM")
  ) {
    return {
      bucket: "POSSIBLE_OWNER_LIABILITY_UNKNOWN",
      reason: "Counterparty looks like a personal credit, loan, or individual-style obligation rather than a proven business vendor.",
      suggested: "HOLD_PENDING_EVIDENCE",
    };
  }

  return {
    bucket: "HARD_PERSONAL_OR_CONSUMER_UNKNOWN",
    reason: "ATM/POS or consumer-style merchant wording is present, but there is no defensible evidence of business purpose.",
    suggested: "HOLD_PENDING_EVIDENCE",
  };
}

function main() {
  const matchedPath = path.join(ROOT, "sattva_fy23_24_matched_master_v3.csv");
  const actionPath = path.join(ROOT, "sattva_fy23_24_zoho_action_queue_v3.csv");
  const ownerPath = path.join(ROOT, "sattva_fy23_24_owner_flow_queue_v2.csv");
  const statutoryPath = path.join(ROOT, "sattva_fy23_24_statutory_payment_queue_v2.csv");

  const matchedRows = parseCsv(fs.readFileSync(matchedPath, "utf8"));
  const actionRows = parseCsv(fs.readFileSync(actionPath, "utf8"));
  const ownerRows = fs.existsSync(ownerPath) ? parseCsv(fs.readFileSync(ownerPath, "utf8")) : [];
  const statutoryRows = fs.existsSync(statutoryPath) ? parseCsv(fs.readFileSync(statutoryPath, "utf8")) : [];

  const unknownQueue = [];
  const bucketCounts = new Map();

  for (const row of matchedRows) {
    row.Residual_Unknown_Bucket = row.Residual_Unknown_Bucket || "";
    row.Residual_Unknown_Reason = row.Residual_Unknown_Reason || "";
    row.Residual_Suggested_Treatment = row.Residual_Suggested_Treatment || "";

    if (row.Audit_Class !== "UNKNOWN") continue;
    const residual = classifyResidualUnknown(row);
    row.Residual_Unknown_Bucket = residual.bucket;
    row.Residual_Unknown_Reason = residual.reason;
    row.Residual_Suggested_Treatment = residual.suggested;
    row.Confidence_Note = `${row.Confidence_Note} | Residual bucket: ${residual.bucket}.`.trim();
    row.Notes = `${row.Notes} | Residual split: ${residual.reason}`.trim();

    bucketCounts.set(residual.bucket, (bucketCounts.get(residual.bucket) || 0) + 1);
    unknownQueue.push({
      Statement_Date: row.Statement_Date,
      Statement_Amount: row.Statement_Amount,
      Direction: row.Direction,
      Payee: row.Bank_Counterparty_Hint || row.Payee || "",
      Reference_Number: row.Bank_Reference || row.Reference_Number || "",
      Residual_Unknown_Bucket: residual.bucket,
      Current_Audit_Class: row.Audit_Class,
      Proof_Status: row.Proof_Status,
      Suggested_Final_Treatment: residual.suggested,
      Reason_For_Bucket: residual.reason,
      Bank_Narration: row.Bank_Narration || "",
    });
  }

  for (const row of actionRows) {
    if (row.Revised_Audit_Class !== "UNKNOWN") continue;
    const matched = matchedRows.find(
      (candidate) =>
        candidate.Statement_Date === row.Statement_Date &&
        candidate.Statement_Amount === row.Statement_Amount &&
        (candidate.Bank_Counterparty_Hint || candidate.Payee || "") === row.Payee,
    );
    if (!matched) continue;
    row.Residual_Unknown_Bucket = matched.Residual_Unknown_Bucket;
    row.Notes = `${row.Notes} | Residual bucket: ${matched.Residual_Unknown_Bucket}`.trim();
  }

  const matchedHeaders = Array.from(
    matchedRows.reduce((headers, row) => {
      for (const header of Object.keys(row)) headers.add(header);
      return headers;
    }, new Set()),
  );
  const actionHeaders = Array.from(
    actionRows.reduce((headers, row) => {
      for (const header of Object.keys(row)) headers.add(header);
      return headers;
    }, new Set()),
  );
  const unknownHeaders = [
    "Statement_Date",
    "Statement_Amount",
    "Direction",
    "Payee",
    "Reference_Number",
    "Residual_Unknown_Bucket",
    "Current_Audit_Class",
    "Proof_Status",
    "Suggested_Final_Treatment",
    "Reason_For_Bucket",
    "Bank_Narration",
  ];

  const summaryRows = [];
  for (const [bucket, count] of Array.from(bucketCounts.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
    summaryRows.push({ Metric: `residual_${bucket}`, Value: String(count) });
  }
  summaryRows.push({ Metric: "residual_unknown_total_v4", Value: String(unknownQueue.length) });

  writeCsv(path.join(ROOT, "sattva_fy23_24_matched_master_v4.csv"), matchedHeaders, matchedRows);
  writeCsv(path.join(ROOT, "sattva_fy23_24_zoho_action_queue_v4.csv"), actionHeaders, actionRows);
  writeCsv(path.join(ROOT, "sattva_fy23_24_unknown_micro_queue_v1.csv"), unknownHeaders, unknownQueue);
  writeCsv(path.join(ROOT, "sattva_fy23_24_unclear_reduction_summary_v3.csv"), ["Metric", "Value"], summaryRows);

  if (ownerRows.length) {
    writeCsv(path.join(ROOT, "sattva_fy23_24_owner_flow_queue_v3.csv"), Object.keys(ownerRows[0]), ownerRows);
  }
  if (statutoryRows.length) {
    writeCsv(path.join(ROOT, "sattva_fy23_24_statutory_payment_queue_v3.csv"), Object.keys(statutoryRows[0]), statutoryRows);
  }

  for (const [bucket, count] of Array.from(bucketCounts.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
    console.log(`${bucket},${count}`);
  }
  console.log(`residual_unknown_total_v4,${unknownQueue.length}`);
}

main();
