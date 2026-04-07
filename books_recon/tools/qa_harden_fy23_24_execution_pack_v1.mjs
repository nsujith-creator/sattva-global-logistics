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

function toAmount(value) {
  const parsed = Number(String(value || "").replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function buildKey(row, payeeField = "Payee") {
  return [row.Statement_Date || "", row.Statement_Amount || "", normalizeText(row[payeeField] || "")].join("|");
}

function buildIndex(rows, payeeField = "Payee") {
  const map = new Map();
  for (const row of rows) {
    const key = buildKey(row, payeeField);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(row);
  }
  return map;
}

function takeMatch(index, row, payeeField = "Payee") {
  const key = [row.Statement_Date || "", row.Statement_Amount || "", normalizeText(row[payeeField] || "")].join("|");
  const list = index.get(key) || [];
  if (!list.length) return null;
  return list.shift();
}

function hasOwnerName(text) {
  return /SUJITH|GOPAKUMARAN|NSUJITH/.test(text);
}

function hasOwnerFingerprint(text) {
  return /SBIN0070665|51909| 217 |OKSBI|OKHDFCBANK/.test(` ${text} `);
}

function qaForRow(row) {
  const text = normalizeText(`${row.Payee} ${row.Reference_Number} ${row.Bank_Narration} ${row.Owner_Reason}`);
  const notes = normalizeText(row.Notes);
  const proofStrongCounterparty = Boolean(row.Payee && row.Payee.trim());
  const proofStrongNarration = Boolean(row.Bank_Narration && row.Bank_Narration.trim());
  const result = {
    Ready_Confidence: "LOW",
    Ready_Basis: "MANUAL_REVIEW_REQUIRED",
    Evidence_Gap: "MULTIPLE_GAPS",
    Risk_Flag: "HIGH",
    Needs_Human_Spotcheck: "NO",
    Spotcheck_Reason: "",
    Owner_Logic_Basis: "NOT_OWNER_FLOW",
    Threshold_Only_Flag: "NO",
    Counterparty_Proof_Flag: proofStrongCounterparty ? "YES" : "NO",
    Narration_Proof_Flag: proofStrongNarration ? "YES" : "NO",
    Review_Sample_Priority: "NONE",
    Final_Go_NoGo: row.Execution_Status === "READY_TO_EXECUTE" ? "GO" : "HOLD",
  };

  if (row.Revised_Audit_Class === "OWNER_DRAWING") {
    if (hasOwnerName(text)) result.Owner_Logic_Basis = "BENEFICIARY_MATCH";
    else if (hasOwnerFingerprint(text)) result.Owner_Logic_Basis = "ACCOUNT_FINGERPRINT";
    else if (proofStrongNarration) result.Owner_Logic_Basis = "NARRATION_PATTERN";
    else result.Owner_Logic_Basis = "THRESHOLD_ONLY";

    const thresholdOnly =
      result.Owner_Logic_Basis === "THRESHOLD_ONLY" ||
      /THRESHOLD/.test(text) ||
      (!hasOwnerName(text) && !hasOwnerFingerprint(text) && !proofStrongNarration);

    result.Threshold_Only_Flag = thresholdOnly ? "YES" : "NO";
    if (thresholdOnly) {
      result.Ready_Confidence = "LOW";
      result.Ready_Basis = "THRESHOLD_ONLY";
      result.Evidence_Gap = "MULTIPLE_GAPS";
      result.Risk_Flag = "HIGH";
      result.Needs_Human_Spotcheck = "YES";
      result.Spotcheck_Reason = "Owner drawing appears to rely on threshold-only logic without strong beneficiary/narration proof.";
      result.Review_Sample_Priority = "P1";
      result.Final_Go_NoGo = "HOLD";
    } else {
      result.Ready_Confidence = hasOwnerName(text) && proofStrongNarration ? "HIGH" : "MEDIUM";
      result.Ready_Basis = hasOwnerName(text)
        ? "DIRECT_RULE_AND_COUNTERPARTY_PROOF"
        : "DIRECT_RULE_AND_REFERENCE_PROOF";
      result.Evidence_Gap = "NONE";
      result.Risk_Flag = "MEDIUM";
      result.Final_Go_NoGo = row.Execution_Status === "READY_TO_EXECUTE" ? "GO" : "HOLD";
    }
    return result;
  }

  if (row.Execution_Bucket === "BANK_CHARGES_READY") {
    result.Ready_Confidence = "HIGH";
    result.Ready_Basis = proofStrongCounterparty
      ? "DIRECT_RULE_AND_COUNTERPARTY_PROOF"
      : "DIRECT_RULE_AND_REFERENCE_PROOF";
    result.Evidence_Gap = "NONE";
    result.Risk_Flag = "LOW";
    result.Final_Go_NoGo = row.Execution_Status === "READY_TO_EXECUTE" ? "GO" : "HOLD";
    return result;
  }

  if (row.Execution_Bucket === "GST_PAYMENT_READY") {
    const strongTaxBasis =
      /GST PAYMENT| CGST | SGST | IGST |^CGST$|^SGST$/.test(` ${text} `) &&
      Boolean(row.Statutory_Period);
    const weakTaxBasis = /GST DIFFERENC/.test(text) || !row.Statutory_Link;

    result.Ready_Confidence = strongTaxBasis && !weakTaxBasis ? "HIGH" : "MEDIUM";
    result.Ready_Basis = strongTaxBasis ? "DIRECT_RULE_AND_COUNTERPARTY_PROOF" : "MANUAL_REVIEW_REQUIRED";
    result.Evidence_Gap = strongTaxBasis && !weakTaxBasis ? "NONE" : "TAX_BASIS_NOT_STRONG";
    result.Risk_Flag = strongTaxBasis && !weakTaxBasis ? "MEDIUM" : "HIGH";
    result.Needs_Human_Spotcheck = "YES";
    result.Spotcheck_Reason = strongTaxBasis && !weakTaxBasis
      ? "Statutory payments are tax-sensitive and should be spotchecked before execution."
      : "Tax basis is not strong enough for unattended execution.";
    result.Review_Sample_Priority = strongTaxBasis && !weakTaxBasis ? "P2" : "P1";
    result.Final_Go_NoGo = strongTaxBasis && !weakTaxBasis && row.Execution_Status === "READY_TO_EXECUTE" ? "GO" : "HOLD";
    return result;
  }

  if (row.Execution_Bucket === "OPERATING_EXPENSE_CLEAR_READY") {
    const strongAccountHead = /SOFTWARE|SAAS/.test(normalizeText(row.Target_Account)) && /ZOHO/.test(text);
    result.Ready_Confidence = strongAccountHead ? "MEDIUM" : "LOW";
    result.Ready_Basis = strongAccountHead ? "DIRECT_RULE_AND_COUNTERPARTY_PROOF" : "MANUAL_REVIEW_REQUIRED";
    result.Evidence_Gap = strongAccountHead ? "NONE" : "ACCOUNT_HEAD_NOT_STRONG";
    result.Risk_Flag = strongAccountHead ? "MEDIUM" : "HIGH";
    result.Needs_Human_Spotcheck = "YES";
    result.Spotcheck_Reason = "Operating expense clear rows should be checked for final account-head accuracy.";
    result.Review_Sample_Priority = "P2";
    result.Final_Go_NoGo = strongAccountHead && row.Execution_Status === "READY_TO_EXECUTE" ? "GO" : "HOLD";
    return result;
  }

  if (row.Execution_Bucket === "VENDOR_RELINK_READY") {
    result.Ready_Confidence = "LOW";
    result.Ready_Basis = "MANUAL_REVIEW_REQUIRED";
    result.Evidence_Gap = "LINK_TARGET_NOT_STRONG";
    result.Risk_Flag = "HIGH";
    result.Final_Go_NoGo = "HOLD";
    return result;
  }

  if (row.Execution_Bucket === "EXPENSE_REVIEW_HOLD") {
    result.Ready_Confidence = "LOW";
    result.Ready_Basis = "NOT_PROVEN";
    result.Evidence_Gap = "ACCOUNT_HEAD_NOT_STRONG";
    result.Risk_Flag = "MEDIUM";
    result.Final_Go_NoGo = "HOLD";
    return result;
  }

  if (row.Execution_Bucket === "UNKNOWN_HOLD") {
    result.Ready_Confidence = "LOW";
    result.Ready_Basis = "NOT_PROVEN";
    result.Evidence_Gap = "MULTIPLE_GAPS";
    result.Risk_Flag = "HIGH";
    result.Final_Go_NoGo = "HOLD";
    return result;
  }

  if (row.Execution_Bucket === "LEGACY_HOLD") {
    result.Ready_Confidence = "LOW";
    result.Ready_Basis = "MANUAL_REVIEW_REQUIRED";
    result.Evidence_Gap = "MULTIPLE_GAPS";
    result.Risk_Flag = "HIGH";
    result.Final_Go_NoGo = "HOLD";
    return result;
  }

  return result;
}

function addOwnerSampling(rows) {
  const ownerRows = rows.filter((row) => row.Execution_Bucket === "OWNER_DRAWING_READY");
  const ownerP1 = ownerRows.filter((row) => row.Review_Sample_Priority === "P1");
  const ownerGoPool = ownerRows
    .filter((row) => row.Final_Go_NoGo === "GO" && row.Review_Sample_Priority === "NONE")
    .sort((left, right) => toAmount(right.Statement_Amount) - toAmount(left.Statement_Amount));
  const extraSample = ownerGoPool.slice(0, ownerGoPool.length > 15 ? 15 : ownerGoPool.length);
  const sampleIds = new Set(extraSample.map((row) => row.Statement_ID));

  for (const row of rows) {
    if (row.Execution_Bucket !== "OWNER_DRAWING_READY") continue;
    if (row.Review_Sample_Priority === "P1") {
      row.Needs_Human_Spotcheck = "YES";
      if (!row.Spotcheck_Reason) row.Spotcheck_Reason = "P1 owner review required before execution.";
      continue;
    }
    if (sampleIds.has(row.Statement_ID)) {
      row.Needs_Human_Spotcheck = "YES";
      row.Review_Sample_Priority = "P3";
      row.Spotcheck_Reason = "Sampled GO owner drawing for QA review before execution.";
    }
  }

  return ownerP1.concat(extraSample);
}

function summaryMarkdown({
  originalReadyCount,
  rows,
  goRows,
  holdRows,
  thresholdOnlyOwnerCount,
  spotcheckCount,
  journalYesGoCount,
  ownerStillGo,
  ownerSpotcheckRows,
  statutoryRows,
  operatingExpenseRows,
  finalRecommendation,
}) {
  const lines = [];
  lines.push("# FY23-24 Execution Pack QA Summary");
  lines.push("");
  lines.push(`- Original ready count: ${originalReadyCount}`);
  lines.push(`- Revised GO count: ${goRows.length}`);
  lines.push(`- Revised HOLD count: ${holdRows.length}`);
  lines.push(`- Owner rows downgraded due to threshold-only logic: ${thresholdOnlyOwnerCount}`);
  lines.push(`- Rows requiring human spotcheck: ${spotcheckCount}`);
  lines.push(`- Journal_Allowed = YES rows that remain GO: ${journalYesGoCount}`);
  lines.push(`- Owner rows still GO: ${ownerStillGo}`);
  lines.push(`- Manual Zoho execution recommendation: ${finalRecommendation === "START" ? "START on GO queue only" : "DO NOT START"}`);
  lines.push("");
  lines.push("## GO/HOLD By Execution Bucket");
  lines.push("");
  const bucketMap = new Map();
  for (const row of rows) {
    if (!bucketMap.has(row.Execution_Bucket)) bucketMap.set(row.Execution_Bucket, { GO: 0, HOLD: 0 });
    bucketMap.get(row.Execution_Bucket)[row.Final_Go_NoGo] += 1;
  }
  for (const [bucket, counts] of Array.from(bucketMap.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
    lines.push(`- ${bucket}: GO ${counts.GO} | HOLD ${counts.HOLD}`);
  }
  lines.push("");
  lines.push("## Spotcheck Queues");
  lines.push("");
  lines.push(`- Owner drawings spotcheck rows: ${ownerSpotcheckRows.length}`);
  lines.push(`- Statutory spotcheck rows: ${statutoryRows.length}`);
  lines.push(`- Operating expense spotcheck rows: ${operatingExpenseRows.length}`);
  lines.push("");
  lines.push("## Top 10 Highest-Risk Rows Or Patterns");
  lines.push("");
  const topRisk = [...rows]
    .filter((row) => row.Risk_Flag === "HIGH")
    .sort((left, right) =>
      toAmount(right.Statement_Amount) - toAmount(left.Statement_Amount) ||
      (left.Execution_Bucket || "").localeCompare(right.Execution_Bucket || ""),
    )
    .slice(0, 10);
  if (!topRisk.length) {
    lines.push("- No HIGH risk rows were produced by the QA pass.");
  } else {
    for (const row of topRisk) {
      lines.push(`- ${row.Statement_Date} | ${row.Statement_Amount} | ${row.Payee} | ${row.Execution_Bucket} | ${row.Evidence_Gap} | ${row.Why_Not_Ready || row.Notes}`);
    }
  }
  lines.push("");
  lines.push("## Conclusion");
  lines.push("");
  if (finalRecommendation === "START") {
    lines.push("- Manual Zoho execution may begin only on `master_go_queue_v2`, and only after completing the listed spotchecks.");
  } else {
    lines.push("- Manual Zoho execution should not begin yet. Resolve the P1/P2 spotchecks and HOLD items first, then re-run this QA pass.");
  }
  lines.push("");
  return `${lines.join("\r\n")}\r\n`;
}

function main() {
  const executionPack = parseCsv(fs.readFileSync(path.join(ROOT, "sattva_fy23_24_zoho_execution_pack_v1.csv"), "utf8"));
  const readyRows = parseCsv(fs.readFileSync(path.join(ROOT, "sattva_fy23_24_ready_to_execute_v1.csv"), "utf8"));
  const holdRowsV1 = parseCsv(fs.readFileSync(path.join(ROOT, "sattva_fy23_24_hold_queue_v1.csv"), "utf8"));
  const vendorRelinkRows = parseCsv(fs.readFileSync(path.join(ROOT, "sattva_fy23_24_vendor_relink_queue_v1.csv"), "utf8"));
  const ownerPostingRows = parseCsv(fs.readFileSync(path.join(ROOT, "sattva_fy23_24_owner_posting_queue_v1.csv"), "utf8"));
  const statutoryTagRows = parseCsv(fs.readFileSync(path.join(ROOT, "sattva_fy23_24_statutory_tag_queue_v1.csv"), "utf8"));
  const operatorChecklist = parseCsv(fs.readFileSync(path.join(ROOT, "sattva_fy23_24_zoho_operator_checklist_v1.csv"), "utf8"));

  const readyIndex = buildIndex(readyRows, "Payee");
  const holdIndex = buildIndex(holdRowsV1, "Payee");
  const vendorRelinkIndex = buildIndex(vendorRelinkRows, "Payee");
  const ownerPostingIndex = buildIndex(ownerPostingRows, "Payee");
  const statutoryIndex = buildIndex(statutoryTagRows, "Payee");
  const checklistIndex = buildIndex(operatorChecklist, "Payee");

  const hardenedRows = executionPack.map((row) => {
    const readyRow = takeMatch(readyIndex, row, "Payee");
    const holdRow = takeMatch(holdIndex, row, "Payee");
    const vendorRow = takeMatch(vendorRelinkIndex, row, "Payee");
    const ownerRow = takeMatch(ownerPostingIndex, row, "Payee");
    const statutoryRow = takeMatch(statutoryIndex, row, "Payee");
    const checklistRow = takeMatch(checklistIndex, row, "Payee");
    const qa = qaForRow(row);

    return {
      ...row,
      Ready_Confidence: qa.Ready_Confidence,
      Ready_Basis: qa.Ready_Basis,
      Evidence_Gap: qa.Evidence_Gap,
      Risk_Flag: qa.Risk_Flag,
      Needs_Human_Spotcheck: qa.Needs_Human_Spotcheck,
      Spotcheck_Reason: qa.Spotcheck_Reason,
      Owner_Logic_Basis: qa.Owner_Logic_Basis,
      Threshold_Only_Flag: qa.Threshold_Only_Flag,
      Counterparty_Proof_Flag: qa.Counterparty_Proof_Flag,
      Narration_Proof_Flag: qa.Narration_Proof_Flag,
      Review_Sample_Priority: qa.Review_Sample_Priority,
      Final_Go_NoGo: qa.Final_Go_NoGo,
      Checklist_Step_No: checklistRow?.Checklist_Step_No || "",
      QA_Source_Row: readyRow ? "READY_QUEUE_V1" : holdRow ? "HOLD_QUEUE_V1" : vendorRow ? "VENDOR_RELINK_V1" : ownerRow ? "OWNER_POSTING_V1" : statutoryRow ? "STATUTORY_TAG_V1" : "EXECUTION_PACK_V1",
    };
  });

  const ownerSpotcheckRows = addOwnerSampling(hardenedRows);

  const statutorySpotcheckRows = hardenedRows
    .filter((row) => row.Execution_Bucket === "GST_PAYMENT_READY")
    .map((row) => {
      row.Needs_Human_Spotcheck = "YES";
      if (row.Review_Sample_Priority === "NONE") row.Review_Sample_Priority = row.Final_Go_NoGo === "GO" ? "P2" : "P1";
      if (!row.Spotcheck_Reason) row.Spotcheck_Reason = "All statutory rows require human tax spotcheck.";
      return row;
    });

  const operatingExpenseSpotcheckRows = hardenedRows
    .filter((row) => row.Execution_Bucket === "OPERATING_EXPENSE_CLEAR_READY")
    .map((row) => {
      row.Needs_Human_Spotcheck = "YES";
      if (row.Review_Sample_Priority === "NONE") row.Review_Sample_Priority = "P2";
      if (!row.Spotcheck_Reason) row.Spotcheck_Reason = "All operating-expense-clear rows require account-head spotcheck.";
      return row;
    });

  const thresholdOnlyOwnerCount = hardenedRows.filter((row) => row.Threshold_Only_Flag === "YES" && row.Execution_Bucket === "OWNER_DRAWING_READY").length;
  const goRows = hardenedRows.filter((row) => row.Final_Go_NoGo === "GO");
  const holdRows = hardenedRows.filter((row) => row.Final_Go_NoGo === "HOLD");
  const ownerStillGo = hardenedRows.filter((row) => row.Execution_Bucket === "OWNER_DRAWING_READY" && row.Final_Go_NoGo === "GO").length;
  const spotcheckCount = hardenedRows.filter((row) => row.Needs_Human_Spotcheck === "YES").length;
  const journalYesGoCount = hardenedRows.filter((row) => row.Journal_Allowed === "YES" && row.Final_Go_NoGo === "GO").length;

  const finalRecommendation =
    hardenedRows.some((row) => row.Review_Sample_Priority === "P1" && row.Final_Go_NoGo === "HOLD") ? "DO NOT START" : "START";

  const headers = Array.from(
    hardenedRows.reduce((set, row) => {
      for (const header of Object.keys(row)) set.add(header);
      return set;
    }, new Set()),
  );

  writeCsv(path.join(ROOT, "sattva_fy23_24_zoho_execution_pack_v2.csv"), headers, hardenedRows);
  writeCsv(path.join(ROOT, "sattva_fy23_24_master_go_queue_v2.csv"), headers, goRows);
  writeCsv(path.join(ROOT, "sattva_fy23_24_master_hold_queue_v2.csv"), headers, holdRows);
  writeCsv(path.join(ROOT, "sattva_fy23_24_owner_drawings_spotcheck_v1.csv"), headers, ownerSpotcheckRows);
  writeCsv(path.join(ROOT, "sattva_fy23_24_statutory_spotcheck_v1.csv"), headers, statutorySpotcheckRows);
  writeCsv(path.join(ROOT, "sattva_fy23_24_operating_expense_spotcheck_v1.csv"), headers, operatingExpenseSpotcheckRows);

  fs.writeFileSync(
    path.join(ROOT, "execution_pack_qa_summary_v1.md"),
    summaryMarkdown({
      originalReadyCount: readyRows.length,
      rows: hardenedRows,
      goRows,
      holdRows,
      thresholdOnlyOwnerCount,
      spotcheckCount,
      journalYesGoCount,
      ownerStillGo,
      ownerSpotcheckRows,
      statutoryRows: statutorySpotcheckRows,
      operatingExpenseRows: operatingExpenseSpotcheckRows,
      finalRecommendation,
    }),
    "utf8",
  );

  console.log(`original_READY_TO_EXECUTE_count,${readyRows.length}`);
  console.log(`revised_GO_count,${goRows.length}`);
  console.log(`revised_HOLD_count,${holdRows.length}`);
  console.log(`owner_rows_marked_threshold_only,${thresholdOnlyOwnerCount}`);
  console.log(`owner_rows_still_GO,${ownerStillGo}`);
  console.log(`owner_drawings_spotcheck_v1_count,${ownerSpotcheckRows.length}`);
  console.log(`statutory_spotcheck_v1_count,${statutorySpotcheckRows.length}`);
  console.log(`operating_expense_spotcheck_v1_count,${operatingExpenseSpotcheckRows.length}`);
  console.log(`final_recommendation,${finalRecommendation}`);
}

main();
