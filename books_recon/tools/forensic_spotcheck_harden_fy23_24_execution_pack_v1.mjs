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

function buildKey(row) {
  return [row.Statement_Date || "", row.Statement_Amount || "", normalizeText(row.Payee || "")].join("|");
}

function buildCountMap(rows, selector) {
  const map = new Map();
  for (const row of rows) {
    const key = selector(row);
    map.set(key, (map.get(key) || 0) + 1);
  }
  return map;
}

function ownerPatternFamily(row) {
  const narration = normalizeText(row.Bank_Narration);
  if (narration.startsWith("FN SUJITH GOPAKUMARAN NAIR ")) return "FULLNAME_FN";
  if (narration.startsWith("FN IMPS IFO ") && narration.includes("SBIN0070665") && narration.includes("SUJITH NAIR")) return "IMPS_SBI_NAME";
  if (narration.startsWith("RTG SUJITH ")) return "RTGS_GENERIC_SUJITH";
  return "OTHER_OWNER_PATTERN";
}

function ownerAssessment(row, familyCounts) {
  const payee = normalizeText(row.Payee);
  const narration = normalizeText(row.Bank_Narration);
  const family = ownerPatternFamily(row);
  const repeated = familyCounts.get(family) || 1;

  let Proof_Quality = "INSUFFICIENT";
  let Proof_Stack = "";
  let Beneficiary_Strength = "NONE";
  let Fingerprint_Strength = "NONE";
  let Narration_Strength = "NONE";
  let Counterparty_Risk = "HIGH";
  let Misclassification_Risk = "HIGH";
  let Likely_Alt_Treatment = "NEEDS_MANUAL_REVIEW";
  let Forensic_Reviewer_Decision = "ESCALATE_REVIEW";
  let Forensic_Why = "";

  if (family === "FULLNAME_FN") {
    Proof_Quality = "STRONG";
    Proof_Stack = "FULL_BENEFICIARY_NAME|REPEATED_PERSONAL_PATTERN|REFERENCE_TOKEN";
    Beneficiary_Strength = "STRONG";
    Fingerprint_Strength = "NONE";
    Narration_Strength = "STRONG";
    Counterparty_Risk = "LOW";
    Misclassification_Risk = "LOW";
    Likely_Alt_Treatment = "KEEP_AS_OWNER_DRAWING";
    Forensic_Reviewer_Decision = "KEEP_GO";
    Forensic_Why = `Exact full-name beneficiary appears in narration and repeats ${repeated} times in the same personal-transfer pattern; that is strong owner-drawing proof without relying on threshold logic.`;
  } else if (family === "IMPS_SBI_NAME") {
    Proof_Quality = "STRONG";
    Proof_Stack = "BENEFICIARY_NAME|BANK_FINGERPRINT_SBIN0070665|REPEATED_PERSONAL_PATTERN";
    Beneficiary_Strength = "STRONG";
    Fingerprint_Strength = "STRONG";
    Narration_Strength = "STRONG";
    Counterparty_Risk = "LOW";
    Misclassification_Risk = "LOW";
    Likely_Alt_Treatment = "KEEP_AS_OWNER_DRAWING";
    Forensic_Reviewer_Decision = "KEEP_GO";
    Forensic_Why = `Beneficiary name and the recurring SBIN0070665 fingerprint jointly support owner-drawing treatment across ${repeated} repeated transfers.`;
  } else if (family === "RTGS_GENERIC_SUJITH") {
    Proof_Quality = "INSUFFICIENT";
    Proof_Stack = "GENERIC_FIRST_NAME_ONLY|RTGS_TRANSFER_PATTERN";
    Beneficiary_Strength = "WEAK";
    Fingerprint_Strength = "NONE";
    Narration_Strength = "MODERATE";
    Counterparty_Risk = "HIGH";
    Misclassification_Risk = "HIGH";
    Likely_Alt_Treatment = "POSSIBLE_TRANSFER_UNCLEAR";
    Forensic_Reviewer_Decision = "ESCALATE_REVIEW";
    Forensic_Why = "Large RTGS transfer shows only the generic beneficiary text 'SUJITH' and no stable owner account fingerprint; that is not strong enough to preserve GO as owner drawing.";
  } else {
    Proof_Quality = "WEAK";
    Proof_Stack = "UNCLASSIFIED_OWNER_PATTERN";
    Beneficiary_Strength = payee ? "MODERATE" : "NONE";
    Fingerprint_Strength = narration.includes("SBIN0070665") ? "MODERATE" : "NONE";
    Narration_Strength = narration ? "MODERATE" : "NONE";
    Counterparty_Risk = "MEDIUM";
    Misclassification_Risk = "MEDIUM";
    Likely_Alt_Treatment = "NEEDS_MANUAL_REVIEW";
    Forensic_Reviewer_Decision = "DOWNGRADE_TO_HOLD";
    Forensic_Why = "Owner pattern is not one of the repeated strong stacks and should not remain GO without manual review.";
  }

  return {
    Proof_Quality,
    Proof_Stack,
    Beneficiary_Strength,
    Fingerprint_Strength,
    Narration_Strength,
    Counterparty_Risk,
    Misclassification_Risk,
    Likely_Alt_Treatment,
    Forensic_Reviewer_Decision,
    Forensic_Why,
  };
}

function genericAssessment(row) {
  if (row.Execution_Bucket === "BANK_CHARGES_READY") {
    return {
      Proof_Quality: "STRONG",
      Proof_Stack: "CHARGE_NARRATION|DIRECT_RULE",
      Beneficiary_Strength: "NONE",
      Fingerprint_Strength: "NONE",
      Narration_Strength: "STRONG",
      Counterparty_Risk: "LOW",
      Misclassification_Risk: "LOW",
      Likely_Alt_Treatment: "NEEDS_MANUAL_REVIEW",
      Forensic_Reviewer_Decision: row.Final_Go_NoGo === "GO" ? "KEEP_GO" : "DOWNGRADE_TO_HOLD",
      Forensic_Why: "Bank charge narration is direct and specific.",
    };
  }
  if (row.Execution_Bucket === "GST_PAYMENT_READY") {
    const weak = normalizeText(row.Payee).includes("GST DIFFERENC");
    return {
      Proof_Quality: weak ? "WEAK" : "MODERATE",
      Proof_Stack: weak ? "GST_KEYWORD_ONLY" : "GST_KEYWORD|STATUTORY_PERIOD",
      Beneficiary_Strength: weak ? "WEAK" : "MODERATE",
      Fingerprint_Strength: "NONE",
      Narration_Strength: weak ? "MODERATE" : "STRONG",
      Counterparty_Risk: weak ? "HIGH" : "MEDIUM",
      Misclassification_Risk: weak ? "HIGH" : "MEDIUM",
      Likely_Alt_Treatment: "NEEDS_MANUAL_REVIEW",
      Forensic_Reviewer_Decision: row.Final_Go_NoGo === "GO" ? "KEEP_GO" : "DOWNGRADE_TO_HOLD",
      Forensic_Why: weak ? "GST difference wording is weaker than a direct challan/tax payment label." : "Direct GST wording plus period support remains acceptable subject to statutory spotcheck.",
    };
  }
  if (row.Execution_Bucket === "OPERATING_EXPENSE_CLEAR_READY") {
    return {
      Proof_Quality: "MODERATE",
      Proof_Stack: "NAMED_VENDOR|REPEATED_PATTERN|ACCOUNT_HEAD_RULE",
      Beneficiary_Strength: "MODERATE",
      Fingerprint_Strength: "NONE",
      Narration_Strength: "STRONG",
      Counterparty_Risk: "MEDIUM",
      Misclassification_Risk: "MEDIUM",
      Likely_Alt_Treatment: "POSSIBLE_BUSINESS_EXPENSE",
      Forensic_Reviewer_Decision: row.Final_Go_NoGo === "GO" ? "KEEP_GO" : "DOWNGRADE_TO_HOLD",
      Forensic_Why: "Named recurring SaaS spend supports business-expense treatment, but account-head logic still depends on the rule layer.",
    };
  }
  if (row.Execution_Bucket === "VENDOR_RELINK_READY") {
    return {
      Proof_Quality: "INSUFFICIENT",
      Proof_Stack: "COUNTERPARTY_MATCH_WITHOUT_UNIQUE_LINK",
      Beneficiary_Strength: "MODERATE",
      Fingerprint_Strength: "NONE",
      Narration_Strength: "MODERATE",
      Counterparty_Risk: "MEDIUM",
      Misclassification_Risk: "HIGH",
      Likely_Alt_Treatment: "POSSIBLE_VENDOR_SETTLEMENT",
      Forensic_Reviewer_Decision: "DOWNGRADE_TO_HOLD",
      Forensic_Why: "Vendor relink remains unfit for GO until the exact target bill/payment link is explicit and unique.",
    };
  }
  if (row.Execution_Bucket === "EXPENSE_REVIEW_HOLD") {
    return {
      Proof_Quality: "WEAK",
      Proof_Stack: "BUSINESS_LIKE_MERCHANT_WITHOUT_STRONG_SUPPORT",
      Beneficiary_Strength: "WEAK",
      Fingerprint_Strength: "NONE",
      Narration_Strength: "MODERATE",
      Counterparty_Risk: "MEDIUM",
      Misclassification_Risk: "HIGH",
      Likely_Alt_Treatment: "POSSIBLE_BUSINESS_EXPENSE",
      Forensic_Reviewer_Decision: "DOWNGRADE_TO_HOLD",
      Forensic_Why: "Expense review items do not have enough proof to move out of hold.",
    };
  }
  if (row.Execution_Bucket === "UNKNOWN_HOLD") {
    const alt = normalizeText(row.Residual_Unknown_Bucket).includes("TRANSFER") ? "POSSIBLE_TRANSFER_UNCLEAR" : "NEEDS_MANUAL_REVIEW";
    return {
      Proof_Quality: "INSUFFICIENT",
      Proof_Stack: "UNPROVEN_RESIDUAL_UNKNOWN",
      Beneficiary_Strength: "NONE",
      Fingerprint_Strength: "NONE",
      Narration_Strength: "WEAK",
      Counterparty_Risk: "HIGH",
      Misclassification_Risk: "HIGH",
      Likely_Alt_Treatment: alt,
      Forensic_Reviewer_Decision: "DOWNGRADE_TO_HOLD",
      Forensic_Why: "Residual unknowns remain unproven and cannot be carried into GO.",
    };
  }
  return {
    Proof_Quality: "MODERATE",
    Proof_Stack: "PRIOR_QA_REVIEW",
    Beneficiary_Strength: "NONE",
    Fingerprint_Strength: "NONE",
    Narration_Strength: "MODERATE",
    Counterparty_Risk: "MEDIUM",
    Misclassification_Risk: "MEDIUM",
    Likely_Alt_Treatment: "NEEDS_MANUAL_REVIEW",
    Forensic_Reviewer_Decision: row.Final_Go_NoGo === "GO" ? "KEEP_GO" : "DOWNGRADE_TO_HOLD",
    Forensic_Why: "No extra forensic override was needed beyond the current QA layer.",
  };
}

function pickHeaders(rows) {
  return Array.from(
    rows.reduce((set, row) => {
      for (const header of Object.keys(row)) set.add(header);
      return set;
    }, new Set()),
  );
}

function renderSummary(data) {
  const {
    ownerRows,
    ownerKeepGo,
    ownerDowngraded,
    ownerEscalated,
    totalGo,
    totalHold,
    narrationOnlyRows,
    altTreatmentRows,
    finalRecommendation,
    downgradeRows,
  } = data;

  const reasonCounts = new Map();
  for (const row of downgradeRows) {
    reasonCounts.set(row.Forensic_Why, (reasonCounts.get(row.Forensic_Why) || 0) + 1);
  }

  const lines = [];
  lines.push("# FY23-24 Forensic Owner Review Summary");
  lines.push("");
  lines.push(`- Owner rows reviewed: ${ownerRows.length}`);
  lines.push(`- Owner rows kept GO: ${ownerKeepGo.length}`);
  lines.push(`- Owner rows downgraded: ${ownerDowngraded.length}`);
  lines.push(`- Owner rows escalated: ${ownerEscalated.length}`);
  lines.push(`- Rows where narration was the only meaningful support: ${narrationOnlyRows.length}`);
  lines.push(`- Rows with possible alternate treatment: ${altTreatmentRows.length}`);
  lines.push(`- Revised total GO count: ${totalGo}`);
  lines.push(`- Revised total HOLD count: ${totalHold}`);
  lines.push(`- Final recommendation: ${finalRecommendation}`);
  lines.push("");
  lines.push("## Top Downgrade Reasons");
  lines.push("");
  if (!reasonCounts.size) {
    lines.push("- No owner rows were downgraded; one or more may still have been escalated.");
  } else {
    for (const [reason, count] of Array.from(reasonCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10)) {
      lines.push(`- ${count} row(s): ${reason}`);
    }
  }
  lines.push("");
  lines.push("## Rows With Possible Alternate Treatment");
  lines.push("");
  if (!altTreatmentRows.length) {
    lines.push("- None.");
  } else {
    for (const row of altTreatmentRows.slice(0, 20)) {
      lines.push(`- ${row.Statement_Date} | ${row.Statement_Amount} | ${row.Payee} | ${row.Likely_Alt_Treatment} | ${row.Forensic_Why}`);
    }
  }
  lines.push("");
  lines.push("## Conclusion");
  lines.push("");
  lines.push(finalRecommendation === "START"
    ? "- Forensic owner review did not identify weak owner logic that blocks execution."
    : "- Do not start manual execution yet. Resolve the forensic owner escalation/downgrade items and then rerun this pass.");
  lines.push("");
  return `${lines.join("\r\n")}\r\n`;
}

function main() {
  const packRows = parseCsv(fs.readFileSync(path.join(ROOT, "sattva_fy23_24_zoho_execution_pack_v2.csv"), "utf8"));
  const goRowsV2 = parseCsv(fs.readFileSync(path.join(ROOT, "sattva_fy23_24_master_go_queue_v2.csv"), "utf8"));
  const holdRowsV2 = parseCsv(fs.readFileSync(path.join(ROOT, "sattva_fy23_24_master_hold_queue_v2.csv"), "utf8"));
  const ownerSpotcheckRows = parseCsv(fs.readFileSync(path.join(ROOT, "sattva_fy23_24_owner_drawings_spotcheck_v1.csv"), "utf8"));
  const statutorySpotcheckRows = parseCsv(fs.readFileSync(path.join(ROOT, "sattva_fy23_24_statutory_spotcheck_v1.csv"), "utf8"));
  const operatingExpenseSpotcheckRows = parseCsv(fs.readFileSync(path.join(ROOT, "sattva_fy23_24_operating_expense_spotcheck_v1.csv"), "utf8"));

  const ownerRows = packRows.filter((row) => row.Execution_Bucket === "OWNER_DRAWING_READY");
  const familyCounts = buildCountMap(ownerRows, ownerPatternFamily);
  const spotcheckIds = new Set(ownerSpotcheckRows.map((row) => row.Statement_ID));

  const reviewedPack = packRows.map((row) => {
    const assessment = row.Execution_Bucket === "OWNER_DRAWING_READY"
      ? ownerAssessment(row, familyCounts)
      : genericAssessment(row);

    const updated = {
      ...row,
      Proof_Quality: assessment.Proof_Quality,
      Proof_Stack: assessment.Proof_Stack,
      Beneficiary_Strength: assessment.Beneficiary_Strength,
      Fingerprint_Strength: assessment.Fingerprint_Strength,
      Narration_Strength: assessment.Narration_Strength,
      Counterparty_Risk: assessment.Counterparty_Risk,
      Misclassification_Risk: assessment.Misclassification_Risk,
      Likely_Alt_Treatment: assessment.Likely_Alt_Treatment,
      Forensic_Reviewer_Decision: assessment.Forensic_Reviewer_Decision,
      Forensic_Why: assessment.Forensic_Why,
    };

    if (row.Execution_Bucket === "OWNER_DRAWING_READY") {
      const shouldHold = assessment.Forensic_Reviewer_Decision !== "KEEP_GO";
      updated.Final_Go_NoGo = shouldHold ? "HOLD" : "GO";
      updated.Execution_Status = shouldHold ? "HOLD_OWNER_CLASSIFICATION" : row.Execution_Status;
      updated.Needs_Human_Spotcheck = shouldHold || spotcheckIds.has(row.Statement_ID) ? "YES" : row.Needs_Human_Spotcheck;
      updated.Review_Sample_Priority = shouldHold ? "P1" : row.Review_Sample_Priority;
      updated.Spotcheck_Reason = shouldHold
        ? assessment.Forensic_Why
        : row.Spotcheck_Reason;
      if (shouldHold) {
        updated.Why_Not_Ready = assessment.Forensic_Why;
      }
    }

    return updated;
  });

  const reviewedOwnerRows = reviewedPack.filter((row) => row.Execution_Bucket === "OWNER_DRAWING_READY");
  const ownerKeepGo = reviewedOwnerRows.filter((row) => row.Forensic_Reviewer_Decision === "KEEP_GO");
  const ownerDowngraded = reviewedOwnerRows.filter((row) => row.Forensic_Reviewer_Decision === "DOWNGRADE_TO_HOLD");
  const ownerEscalated = reviewedOwnerRows.filter((row) => row.Forensic_Reviewer_Decision === "ESCALATE_REVIEW");
  const downgradeQueue = reviewedOwnerRows.filter((row) => row.Forensic_Reviewer_Decision !== "KEEP_GO");

  const goRowsV3 = reviewedPack.filter((row) => row.Final_Go_NoGo === "GO");
  const holdRowsV3 = reviewedPack.filter((row) => row.Final_Go_NoGo === "HOLD");

  const narrationOnlyRows = reviewedOwnerRows.filter(
    (row) =>
      (row.Beneficiary_Strength === "WEAK" || row.Beneficiary_Strength === "NONE") &&
      (row.Fingerprint_Strength === "WEAK" || row.Fingerprint_Strength === "NONE") &&
      (row.Narration_Strength === "MODERATE" || row.Narration_Strength === "STRONG"),
  );
  const altTreatmentRows = reviewedOwnerRows.filter((row) => row.Likely_Alt_Treatment !== "KEEP_AS_OWNER_DRAWING");
  const finalRecommendation =
    ownerEscalated.length || ownerDowngraded.length || holdRowsV2.length || statutorySpotcheckRows.length || operatingExpenseSpotcheckRows.length
      ? "DO NOT START"
      : "START";

  const ownerHeaders = pickHeaders(reviewedOwnerRows);
  const allHeaders = pickHeaders(reviewedPack);

  writeCsv(path.join(ROOT, "sattva_fy23_24_owner_forensic_review_v1.csv"), ownerHeaders, reviewedOwnerRows);
  writeCsv(path.join(ROOT, "sattva_fy23_24_owner_go_after_forensic_v1.csv"), ownerHeaders, ownerKeepGo);
  writeCsv(path.join(ROOT, "sattva_fy23_24_owner_hold_after_forensic_v1.csv"), ownerHeaders, reviewedOwnerRows.filter((row) => row.Final_Go_NoGo === "HOLD"));
  writeCsv(path.join(ROOT, "sattva_fy23_24_forensic_downgrade_queue_v1.csv"), ownerHeaders, downgradeQueue);
  writeCsv(path.join(ROOT, "sattva_fy23_24_go_queue_v3.csv"), allHeaders, goRowsV3);
  writeCsv(path.join(ROOT, "sattva_fy23_24_hold_queue_v3.csv"), allHeaders, holdRowsV3);
  fs.writeFileSync(
    path.join(ROOT, "sattva_fy23_24_forensic_summary_v1.md"),
    renderSummary({
      ownerRows: reviewedOwnerRows,
      ownerKeepGo,
      ownerDowngraded,
      ownerEscalated,
      totalGo: goRowsV3.length,
      totalHold: holdRowsV3.length,
      narrationOnlyRows,
      altTreatmentRows,
      finalRecommendation,
      downgradeRows: downgradeQueue,
    }),
    "utf8",
  );

  console.log(`original_owner_GO_count,${ownerRows.length}`);
  console.log(`forensic_owner_KEEP_GO_count,${ownerKeepGo.length}`);
  console.log(`forensic_owner_DOWNGRADE_count,${ownerDowngraded.length}`);
  console.log(`forensic_owner_ESCALATE_count,${ownerEscalated.length}`);
  console.log(`revised_total_GO_count,${goRowsV3.length}`);
  console.log(`revised_total_HOLD_count,${holdRowsV3.length}`);
  console.log(`final_recommendation,${finalRecommendation}`);
}

main();
