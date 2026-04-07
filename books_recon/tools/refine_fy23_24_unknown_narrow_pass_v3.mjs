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

function narrowReclass(row) {
  if (row.Audit_Class !== "UNKNOWN") return null;
  const evidence = normalizeText(`${row.Bank_Counterparty_Hint} ${row.Bank_Narration}`);

  if (evidence.includes("ZOMATO MEDIA")) {
    return {
      Audit_Class: "OPERATING_EXPENSE_REVIEW",
      note: "Named food/digital-service merchant appears on statement; business nexus is plausible but still not invoice-proven.",
    };
  }
  if (evidence.includes(" ZOMATO ")) {
    return {
      Audit_Class: "OPERATING_EXPENSE_REVIEW",
      note: "Named food-service merchant appears on statement; could be business meal spend but remains unproven.",
    };
  }
  if (evidence.includes("MSEB") || evidence.includes("ELECTRIC")) {
    return {
      Audit_Class: "OPERATING_EXPENSE_REVIEW",
      note: "Utility-style statement wording suggests a business operating outflow, but underlying bill support is absent.",
    };
  }
  if (evidence.includes("PETROLEUM") || evidence.includes("FUEL")) {
    return {
      Audit_Class: "OPERATING_EXPENSE_REVIEW",
      note: "Fuel-station wording suggests a business travel/vehicle outflow, but documentary support is still pending.",
    };
  }
  return null;
}

function recommendedAction(auditClass) {
  return auditClass === "OPERATING_EXPENSE_REVIEW" ? "MOVE_TO_OPERATING_EXPENSE" : "HOLD_FOR_MANUAL_REVIEW";
}

function main() {
  const matchedPath = path.join(ROOT, "sattva_fy23_24_matched_master_v2.csv");
  const actionPath = path.join(ROOT, "sattva_fy23_24_zoho_action_queue_v2.csv");
  const ownerPath = path.join(ROOT, "sattva_fy23_24_owner_flow_queue_v1.csv");
  const statutoryPath = path.join(ROOT, "sattva_fy23_24_statutory_payment_queue_v1.csv");

  const matchedRows = parseCsv(fs.readFileSync(matchedPath, "utf8"));
  const actionRows = parseCsv(fs.readFileSync(actionPath, "utf8"));
  const ownerRows = parseCsv(fs.readFileSync(ownerPath, "utf8"));
  const statutoryRows = parseCsv(fs.readFileSync(statutoryPath, "utf8"));

  let unknownBefore = 0;
  let unknownAfter = 0;
  let movedToReview = 0;

  const updatedMatched = matchedRows.map((row) => {
    if (row.Audit_Class === "UNKNOWN") unknownBefore += 1;
    const updated = narrowReclass(row);
    if (!updated) {
      if (row.Audit_Class === "UNKNOWN") unknownAfter += 1;
      return row;
    }
    movedToReview += 1;
    row.Audit_Class = updated.Audit_Class;
    row.Recommended_Zoho_Action = recommendedAction(updated.Audit_Class);
    row.Review_Flag = "YES";
    row.Confidence_Note = updated.note;
    row.Notes = `${updated.note} | Narrow pass upgraded from UNKNOWN on statement-side merchant wording only.`;
    return row;
  });

  const updatedAction = actionRows.map((row) => {
    if (row.Revised_Audit_Class !== "UNKNOWN") return row;
    const matched = updatedMatched.find(
      (candidate) =>
        candidate.Statement_Date === row.Statement_Date &&
        candidate.Statement_Amount === row.Statement_Amount &&
        (candidate.Bank_Counterparty_Hint || candidate.Payee) === row.Payee,
    );
    if (!matched || matched.Audit_Class === "UNKNOWN") return row;
    return {
      ...row,
      Revised_Audit_Class: matched.Audit_Class,
      Recommended_Zoho_Action: matched.Recommended_Zoho_Action,
      Notes: matched.Notes,
    };
  });

  const matchedHeaders = Array.from(
    updatedMatched.reduce((headers, row) => {
      for (const header of Object.keys(row)) headers.add(header);
      return headers;
    }, new Set()),
  );
  const actionHeaders = Array.from(
    updatedAction.reduce((headers, row) => {
      for (const header of Object.keys(row)) headers.add(header);
      return headers;
    }, new Set()),
  );

  const countClass = (auditClass) => updatedMatched.filter((row) => row.Audit_Class === auditClass).length;
  const proofCounts = new Map();
  for (const row of updatedMatched) {
    proofCounts.set(row.Proof_Status, (proofCounts.get(row.Proof_Status) || 0) + 1);
  }

  const summaryRows = [
    { Metric: "narrow_pass_unknown_before", Value: String(unknownBefore) },
    { Metric: "narrow_pass_rows_moved_to_operating_expense_review", Value: String(movedToReview) },
    { Metric: "narrow_pass_unknown_after", Value: String(unknownAfter) },
    { Metric: "total_OPERATING_EXPENSE_REVIEW_count_v3", Value: String(countClass("OPERATING_EXPENSE_REVIEW")) },
    { Metric: "total_UNKNOWN_count_v3", Value: String(countClass("UNKNOWN")) },
  ];
  for (const [proofStatus, count] of Array.from(proofCounts.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
    summaryRows.push({ Metric: `proof_status_${proofStatus}`, Value: String(count) });
  }

  writeCsv(path.join(ROOT, "sattva_fy23_24_matched_master_v3.csv"), matchedHeaders, updatedMatched);
  writeCsv(path.join(ROOT, "sattva_fy23_24_zoho_action_queue_v3.csv"), actionHeaders, updatedAction);
  writeCsv(path.join(ROOT, "sattva_fy23_24_unclear_reduction_summary_v2.csv"), ["Metric", "Value"], summaryRows);

  // Queues are unchanged in this narrow pass; emit v3 copies for a complete handoff set.
  if (ownerRows.length) {
    writeCsv(path.join(ROOT, "sattva_fy23_24_owner_flow_queue_v2.csv"), Object.keys(ownerRows[0]), ownerRows);
  }
  if (statutoryRows.length) {
    writeCsv(path.join(ROOT, "sattva_fy23_24_statutory_payment_queue_v2.csv"), Object.keys(statutoryRows[0]), statutoryRows);
  }

  console.log(`narrow_pass_unknown_before,${unknownBefore}`);
  console.log(`narrow_pass_rows_moved_to_operating_expense_review,${movedToReview}`);
  console.log(`narrow_pass_unknown_after,${unknownAfter}`);
  console.log(`OPERATING_EXPENSE_REVIEW_count_v3,${countClass("OPERATING_EXPENSE_REVIEW")}`);
  console.log(`UNKNOWN_count_v3,${countClass("UNKNOWN")}`);
  for (const [proofStatus, count] of Array.from(proofCounts.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
    console.log(`Proof_Status_${proofStatus},${count}`);
  }
}

main();
