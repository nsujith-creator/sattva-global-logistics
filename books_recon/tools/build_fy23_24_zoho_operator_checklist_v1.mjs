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

function toAmount(value) {
  const parsed = Number(String(value || "").replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function sortReadyRows(rows) {
  const phaseOrder = { BANKING: 1, TAXES: 2, ACCOUNTANT_JOURNAL: 3 };
  return [...rows].sort((left, right) =>
    (phaseOrder[left.Zoho_Module] || 99) - (phaseOrder[right.Zoho_Module] || 99) ||
    (left.Target_Account || "").localeCompare(right.Target_Account || "") ||
    (left.Statement_Date || "").localeCompare(right.Statement_Date || "") ||
    toAmount(left.Statement_Amount) - toAmount(right.Statement_Amount) ||
    (left.Payee || "").localeCompare(right.Payee || ""),
  );
}

function bankingInstruction(row) {
  return {
    Phase_Name: "BANKING",
    Zoho_Navigation: "Banking > Select bank account > Quick Categorize",
    Zoho_Click_Sequence:
      `Open Banking, select the bank account holding this feed, click Quick Categorize, filter Withdrawals and the FY23-24 date range, locate ${row.Statement_Date} / ${row.Statement_Amount} / ${row.Payee}, set Account = ${row.Target_Account}, verify narration/reference, then click Categorize.`,
    Operator_Action: `Recategorize the bank withdrawal to ${row.Target_Account}.`,
    Validation_Check: `Confirm the categorized row matches amount ${row.Statement_Amount}, payee ${row.Payee}, and reference ${row.Reference_Number || "(blank)"}.`,
  };
}

function taxInstruction(row) {
  return {
    Phase_Name: "TAXES",
    Zoho_Navigation: "Accountant > Tax Payments",
    Zoho_Click_Sequence:
      `Open Accountant, select Tax Payments, click Generate Tax Due, choose the GST authority, set From/To for ${row.Statutory_Period || row.Statement_Date}, click Generate, open the tax due entry, record the payment from the correct bank account for ${row.Statement_Amount}, enter reference ${row.Reference_Number || "(blank)"}, and save the tax payment.`,
    Operator_Action: `Tag and record the statutory payment against GST dues.`,
    Validation_Check: `Match the paid amount ${row.Statement_Amount} and the suggested statutory link note before saving.`,
  };
}

function journalInstruction(row) {
  return {
    Phase_Name: "OWNER_JOURNALS",
    Zoho_Navigation: "Accountant > Manual Journals, then Banking > Match",
    Zoho_Click_Sequence:
      `Open Accountant, select Manual Journals, click + New Journal, set Date = ${row.Statement_Date}, add Notes referencing ${row.Payee} / ${row.Reference_Number || row.Statement_ID}, debit ${row.Target_Account} for ${row.Statement_Amount}, credit the bank account used in Banking for ${row.Statement_Amount}, click Save and Publish, then go to Banking, open the matching uncategorized withdrawal, and click Match against the manually added journal.`,
    Operator_Action: `Post the owner drawing journal, then match the bank line to the published manual journal.`,
    Validation_Check: `Confirm debit = credit at ${row.Statement_Amount} and the Banking match is done on the same date/amount bank feed.`,
  };
}

function checklistRow(row, stepNumber) {
  let detail;
  if (row.Zoho_Module === "BANKING") detail = bankingInstruction(row);
  else if (row.Zoho_Module === "TAXES") detail = taxInstruction(row);
  else detail = journalInstruction(row);

  return {
    Checklist_Step_No: String(stepNumber),
    Phase_Name: detail.Phase_Name,
    Zoho_Module: row.Zoho_Module,
    Execution_Bucket: row.Execution_Bucket,
    Statement_Date: row.Statement_Date,
    Statement_Amount: row.Statement_Amount,
    Payee: row.Payee,
    Reference_Number: row.Reference_Number,
    Target_Account: row.Target_Account,
    Preferred_Action_Type: row.Preferred_Action_Type,
    Zoho_Navigation: detail.Zoho_Navigation,
    Zoho_Click_Sequence: detail.Zoho_Click_Sequence,
    Operator_Action: detail.Operator_Action,
    Validation_Check: detail.Validation_Check,
    Statement_ID: row.Statement_ID,
    Proof_Status: row.Proof_Status,
    Notes: row.Notes,
  };
}

function buildMarkdown(checklistRows) {
  const sections = [
    ["BANKING", "Banking"],
    ["TAXES", "Taxes"],
    ["OWNER_JOURNALS", "Owner Journals"],
  ];
  const lines = ["# FY23-24 Zoho Operator Checklist", ""];
  for (const [phaseKey, title] of sections) {
    const rows = checklistRows.filter((row) => row.Phase_Name === phaseKey);
    if (!rows.length) continue;
    lines.push(`## ${title}`);
    lines.push("");
    for (const row of rows) {
      lines.push(
        `${row.Checklist_Step_No}. ${row.Statement_Date} | ${row.Statement_Amount} | ${row.Payee} | ${row.Execution_Bucket}`,
      );
      lines.push(`Navigation: ${row.Zoho_Navigation}`);
      lines.push(`Click sequence: ${row.Zoho_Click_Sequence}`);
      lines.push(`Validation: ${row.Validation_Check}`);
      lines.push("");
    }
  }
  return `${lines.join("\r\n")}\r\n`;
}

function main() {
  const readyRows = parseCsv(fs.readFileSync(path.join(ROOT, "sattva_fy23_24_ready_to_execute_v1.csv"), "utf8"));
  const ordered = sortReadyRows(readyRows);
  const checklistRows = ordered.map((row, index) => checklistRow(row, index + 1));

  const headers = [
    "Checklist_Step_No",
    "Phase_Name",
    "Zoho_Module",
    "Execution_Bucket",
    "Statement_Date",
    "Statement_Amount",
    "Payee",
    "Reference_Number",
    "Target_Account",
    "Preferred_Action_Type",
    "Zoho_Navigation",
    "Zoho_Click_Sequence",
    "Operator_Action",
    "Validation_Check",
    "Statement_ID",
    "Proof_Status",
    "Notes",
  ];

  writeCsv(path.join(ROOT, "sattva_fy23_24_zoho_operator_checklist_v1.csv"), headers, checklistRows);
  fs.writeFileSync(path.join(ROOT, "sattva_fy23_24_zoho_operator_checklist_v1.md"), buildMarkdown(checklistRows), "utf8");

  const phaseCounts = new Map();
  for (const row of checklistRows) {
    phaseCounts.set(row.Phase_Name, (phaseCounts.get(row.Phase_Name) || 0) + 1);
  }
  console.log(`operator_checklist_rows,${checklistRows.length}`);
  for (const [phase, count] of Array.from(phaseCounts.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
    console.log(`${phase},${count}`);
  }
}

main();
