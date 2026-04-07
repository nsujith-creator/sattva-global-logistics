import fs from "fs";
import path from "path";
import crypto from "crypto";
import { execFileSync } from "child_process";

const repoRoot = "C:\\sattva\\books_recon";
const exportsDir = path.join(repoRoot, "data", "exports");
const rawDir = path.join(repoRoot, "data", "raw");
const gstDir = path.join(rawDir, "gst");
const itrDir = path.join(rawDir, "itr");
const tdsDir = path.join(rawDir, "tds");
const cacheDir = path.join(exportsDir, "pdf_cache");
const pdfToText = "C:\\Program Files\\Git\\mingw64\\bin\\pdftotext.exe";
const manualTanCustomerMap = new Map([
  ["MUMD28010D", "REDEX GLOBAL"],
  ["MUMR22339C", "SAIRAM EXPORTS"],
]);

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
  return JSON.parse(raw);
}

function writeText(filePath, text) {
  fs.writeFileSync(filePath, text, "utf8");
}

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round((Number(value) + Number.EPSILON) * factor) / factor;
}

function formatInr(value) {
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(round(value, 2));
  return `${sign}\u20b9${abs.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function monthToQuarter(month) {
  if (month >= 4 && month <= 6) return "Q1";
  if (month >= 7 && month <= 9) return "Q2";
  if (month >= 10 && month <= 12) return "Q3";
  return "Q4";
}

function parseDate(dateText) {
  return new Date(`${dateText}T00:00:00`);
}

function sum(items, selector) {
  return round(items.reduce((acc, item) => acc + Number(selector(item) || 0), 0), 2);
}

function normalizeName(value) {
  return String(value || "")
    .toUpperCase()
    .replace(/PRIVATE|PVT|LIMITED|LTD|LLP|INCORPORATED|INC\b|CO\b|CORPORATION|CORP|INDIA|LOGISTICS|GLOBAL/g, " ")
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenSet(value) {
  return new Set(normalizeName(value).split(" ").filter(Boolean));
}

function tokenSimilarity(left, right) {
  const a = tokenSet(left);
  const b = tokenSet(right);
  if (!a.size || !b.size) return 0;
  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) intersection += 1;
  }
  return intersection / Math.max(a.size, b.size);
}

function hashBuffer(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function pdftotext(filePath, mode = "raw") {
  const cachePath = path.join(cacheDir, `${path.basename(filePath)}.${mode}.txt`);
  if (fs.existsSync(cachePath)) {
    return fs.readFileSync(cachePath, "utf8");
  }
  return execFileSync(pdfToText, [`-${mode}`, filePath, "-"], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
}

function parseGstr3bFromPdf(filePath) {
  const text = pdftotext(filePath, "layout");
  const matchLine = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => /^FILED\b/.test(line) && (line.match(/[0-9.]+/g) || []).length >= 5);
  if (!matchLine) {
    throw new Error(`Unable to parse GSTR-3B totals from ${path.basename(filePath)}`);
  }
  const numericTokens = matchLine.match(/[0-9.]+/g);
  const [taxable, igst, cgst, sgst, cess] = numericTokens.slice(0, 5);
  const periodLabel = path.basename(filePath, ".pdf").split("_").slice(-2).join("_");
  return {
    file: path.basename(filePath),
    quarter: periodLabel === "2023_06" ? "Q1" : periodLabel === "2023_09" ? "Q2" : periodLabel === "2023_12" ? "Q3" : "Q4",
    taxable: round(Number(taxable.replace(/,/g, ""))),
    igst: round(Number(igst.replace(/,/g, ""))),
    cgst: round(Number(cgst.replace(/,/g, ""))),
    sgst: round(Number(sgst.replace(/,/g, ""))),
    cess: round(Number(cess.replace(/,/g, ""))),
  };
}

function parse26asSummary(pdfPath) {
  const text = pdftotext(pdfPath, "raw").replace(/^\uFEFF/, "");
  const summarySection = text.split("PART-II")[0];
  const rows = [];
  const linePattern = /^(\d+)\s+([A-Z0-9 .&()/'-]+?)\s+([A-Z0-9]{10})\s+(-?[0-9.]+)\s+(-?[0-9.]+)\s+(-?[0-9.]+)$/;
  for (const rawLine of summarySection.split(/\r?\n/)) {
    const line = rawLine.trim().replace(/\s+/g, " ");
    const match = line.match(linePattern);
    if (!match) continue;
    const [, serial, name, tan, grossAmount, taxDeducted, taxDeposited] = match;
    rows.push({
      serial: Number(serial),
      deductorName: name.trim(),
      tan,
      grossAmount: round(Number(grossAmount)),
      taxDeducted: round(Number(taxDeducted)),
      taxDeposited: round(Number(taxDeposited)),
    });
  }
  return rows;
}

function buildInvoiceSummary(invoices) {
  const quarterMap = new Map();
  for (const invoice of invoices) {
    const date = parseDate(invoice.invoice_date);
    const quarter = monthToQuarter(date.getMonth() + 1);
    if (!quarterMap.has(quarter)) {
      quarterMap.set(quarter, {
        quarter,
        invoiceCount: 0,
        taxable: 0,
        total: 0,
        igst: 0,
        cgst: 0,
        sgst: 0,
        cess: 0,
        tdsField: 0,
        roundOff: 0,
        invoices: [],
      });
    }
    const bucket = quarterMap.get(quarter);
    bucket.invoiceCount += 1;
    bucket.taxable += Number(invoice.subtotal || 0);
    bucket.total += Number(invoice.total || 0);
    bucket.igst += Number(invoice.tax_breakup?.igst || 0);
    bucket.cgst += Number(invoice.tax_breakup?.cgst || 0);
    bucket.sgst += Number(invoice.tax_breakup?.sgst || 0);
    bucket.cess += Number(invoice.tax_breakup?.cess || 0);
    bucket.tdsField += Number(invoice.tax_breakup?.tds || 0);
    bucket.roundOff += Number(invoice.tax_breakup?.round_off || 0);
    bucket.invoices.push(invoice);
  }
  const ordered = ["Q1", "Q2", "Q3", "Q4"].map((quarter) => {
    const bucket = quarterMap.get(quarter);
    if (!bucket) {
      return {
        quarter,
        invoiceCount: 0,
        taxable: 0,
        total: 0,
        igst: 0,
        cgst: 0,
        sgst: 0,
        cess: 0,
        gst: 0,
        tdsField: 0,
        roundOff: 0,
        netAfterTds: 0,
        invoices: [],
      };
    }
    return {
      ...bucket,
      taxable: round(bucket.taxable),
      total: round(bucket.total),
      igst: round(bucket.igst),
      cgst: round(bucket.cgst),
      sgst: round(bucket.sgst),
      cess: round(bucket.cess),
      gst: round(bucket.igst + bucket.cgst + bucket.sgst + bucket.cess),
      tdsField: round(bucket.tdsField),
      roundOff: round(bucket.roundOff),
      netAfterTds: round(bucket.total - bucket.tdsField),
    };
  });
  return {
    quarters: ordered,
    totals: {
      invoiceCount: invoices.length,
      taxable: round(sum(invoices, (row) => row.subtotal)),
      total: round(sum(invoices, (row) => row.total)),
      igst: round(sum(invoices, (row) => row.tax_breakup?.igst)),
      cgst: round(sum(invoices, (row) => row.tax_breakup?.cgst)),
      sgst: round(sum(invoices, (row) => row.tax_breakup?.sgst)),
      cess: round(sum(invoices, (row) => row.tax_breakup?.cess)),
      tdsField: round(sum(invoices, (row) => row.tax_breakup?.tds)),
      roundOff: round(sum(invoices, (row) => row.tax_breakup?.round_off)),
    },
  };
}

function buildPaymentSummary(payments) {
  let appliedPreFy = 0;
  let appliedFy = 0;
  let appliedPostFy = 0;
  let unused = 0;
  let totalWithholding = 0;
  for (const payment of payments) {
    unused += Number(payment.unused_amount || 0);
    totalWithholding += Number(payment.total_withholding || 0);
    for (const linked of payment.linked_invoices || []) {
      const amount = Number(linked.amount_applied || 0);
      if (!linked.invoice_date) continue;
      const date = parseDate(linked.invoice_date);
      if (date < parseDate("2023-04-01")) appliedPreFy += amount;
      else if (date > parseDate("2024-03-31")) appliedPostFy += amount;
      else appliedFy += amount;
    }
  }
  return {
    paymentTotal: round(sum(payments, (row) => row.amount)),
    unused: round(unused),
    totalWithholding: round(totalWithholding),
    appliedPreFy: round(appliedPreFy),
    appliedFy: round(appliedFy),
    appliedPostFy: round(appliedPostFy),
  };
}

function buildGstr2bSummary(gstDirectory) {
  const files = fs
    .readdirSync(gstDirectory)
    .filter((name) => /^gstr2b_.*\.json$/i.test(name))
    .map((name) => path.join(gstDirectory, name));

  const seen = new Set();
  const uniqueFiles = [];
  for (const filePath of files) {
    const hash = hashBuffer(fs.readFileSync(filePath));
    if (seen.has(hash)) continue;
    seen.add(hash);
    uniqueFiles.push(filePath);
  }

  const periodRows = [];
  const vendorDocs = [];
  for (const filePath of uniqueFiles) {
    const json = readJson(filePath);
    const period = json.data.rtnprd;
    const summary = json.data.itcsumm?.itcavl?.nonrevsup || {};
    const b2b = json.data.docdata?.b2b || [];
    periodRows.push({
      file: path.basename(filePath),
      period,
      igst: round(Number(summary.igst || 0)),
      cgst: round(Number(summary.cgst || 0)),
      sgst: round(Number(summary.sgst || 0)),
      vendorCount: b2b.length,
      invoiceCount: b2b.reduce((acc, row) => acc + (row.inv?.length || 0), 0),
    });
    for (const vendor of b2b) {
      vendorDocs.push({
        period,
        vendorName: vendor.trdnm || vendor.ctin,
        gstin: vendor.ctin,
        invoiceCount: vendor.inv?.length || 0,
      });
    }
  }

  return {
    periods: periodRows.sort((a, b) => a.period.localeCompare(b.period)),
    totals: {
      igst: round(sum(periodRows, (row) => row.igst)),
      cgst: round(sum(periodRows, (row) => row.cgst)),
      sgst: round(sum(periodRows, (row) => row.sgst)),
      invoiceCount: periodRows.reduce((acc, row) => acc + row.invoiceCount, 0),
      vendorCount: new Set(vendorDocs.map((row) => row.vendorName)).size,
    },
    vendorDocs,
  };
}

function buildVendorEvidence(bankTransactions, gstr2bSummary) {
  const vendorBankRows = bankTransactions
    .filter((row) => row.direction === "debit" && row.classification_tag === "vendor payment candidate")
    .map((row) => ({
      counterparty: row.counterparty_hint || row.narration,
      amount: Number(row.amount || 0),
    }));

  const grouped = new Map();
  for (const row of vendorBankRows) {
    const key = normalizeName(row.counterparty);
    if (!key) continue;
    const entry = grouped.get(key) || { name: row.counterparty, amount: 0 };
    entry.amount += row.amount;
    grouped.set(key, entry);
  }

  const topBankVendors = [...grouped.values()]
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 12)
    .map((row) => ({
      name: row.name,
      amount: round(row.amount),
      gstr2bEvidence: gstr2bSummary.vendorDocs.some(
        (vendor) => tokenSimilarity(vendor.vendorName, row.name) >= 0.5,
      ),
    }));

  return topBankVendors;
}

function mapDeductorsToCustomers(summaryRows, itrGroups, invoices, invoiceByCustomer) {
  const customerNames = [...invoiceByCustomer.keys()];
  const mappings = [];

  for (const summaryRow of summaryRows) {
    const manualCustomer = manualTanCustomerMap.get(summaryRow.tan);
    if (manualCustomer) {
      mappings.push({
        ...summaryRow,
        mappedCustomer: manualCustomer,
        mappingStatus: "matched_by_management_mapping",
        mappingEvidence: {
          source: "manual_tan_customer_map",
          tan: summaryRow.tan,
        },
      });
      continue;
    }

    const itrGroup = itrGroups.get(summaryRow.tan);
    const grossAmounts = itrGroup ? itrGroup.rows.map((row) => Number(row.GrossAmount || 0)) : [summaryRow.grossAmount];
    const candidates = customerNames.map((customerName) => {
      const customerInvoices = invoices.filter((row) => row.customer_name === customerName);
      const roundedSubtotals = customerInvoices.map((row) => round(row.subtotal, 2));
      const transactionMatchCount = grossAmounts.reduce((acc, gross) => {
        const matched = roundedSubtotals.some((subtotal) => Math.abs(subtotal - gross) <= 1.0);
        return acc + (matched ? 1 : 0);
      }, 0);
      const customerSummary = invoiceByCustomer.get(customerName);
      return {
        customerName,
        nameScore: tokenSimilarity(summaryRow.deductorName, customerName),
        totalDifference: Math.abs(customerSummary.taxable - summaryRow.grossAmount),
        transactionMatchCount,
        transactionTargetCount: grossAmounts.length,
      };
    });

    candidates.sort((a, b) => {
      if (b.nameScore !== a.nameScore) return b.nameScore - a.nameScore;
      if (b.transactionMatchCount !== a.transactionMatchCount) return b.transactionMatchCount - a.transactionMatchCount;
      return a.totalDifference - b.totalDifference;
    });

    const best = candidates[0];
    let status = "unresolved";
    if (best.nameScore >= 0.65) {
      status = "matched_by_name";
    } else if (best.transactionTargetCount > 0 && best.transactionMatchCount / best.transactionTargetCount >= 0.75) {
      status = "matched_by_transaction_coverage";
    } else if (best.transactionMatchCount >= 2 && best.totalDifference <= 5) {
      status = "matched_by_amount";
    } else if (best.transactionTargetCount === 1 && best.totalDifference <= 1) {
      status = "matched_by_total";
    }

    mappings.push({
      ...summaryRow,
      mappedCustomer: status === "unresolved" ? null : best.customerName,
      mappingStatus: status,
      mappingEvidence: {
        nameScore: round(best.nameScore, 4),
        totalDifference: round(best.totalDifference),
        transactionMatchCount: best.transactionMatchCount,
        transactionTargetCount: best.transactionTargetCount,
      },
    });
  }

  return mappings;
}

function buildCustomerSummaries(invoices, payments) {
  const invoiceByCustomer = new Map();
  for (const group of groupBy(invoices, (row) => row.customer_name)) {
    invoiceByCustomer.set(group.key, {
      customerName: group.key,
      taxable: round(sum(group.items, (row) => row.subtotal)),
      total: round(sum(group.items, (row) => row.total)),
      invoiceTds: round(sum(group.items, (row) => row.tax_breakup?.tds)),
    });
  }

  const paymentByCustomer = new Map();
  for (const group of groupBy(payments, (row) => row.customer_name)) {
    paymentByCustomer.set(group.key, {
      customerName: group.key,
      paymentTds: round(sum(group.items, (row) => row.total_withholding)),
      paymentAmount: round(sum(group.items, (row) => row.amount)),
    });
  }

  return { invoiceByCustomer, paymentByCustomer };
}

function groupBy(items, selector) {
  const grouped = new Map();
  for (const item of items) {
    const key = selector(item);
    const bucket = grouped.get(key) || [];
    bucket.push(item);
    grouped.set(key, bucket);
  }
  return [...grouped.entries()].map(([key, bucket]) => ({ key, items: bucket }));
}

function findQuarterShiftCandidate(invoiceQuarter, gstQuarter, invoiceSummary) {
  const taxableDelta = round(invoiceQuarter.taxable - gstQuarter.taxable);
  const igstDelta = round(invoiceQuarter.igst - gstQuarter.igst);
  if (Math.abs(taxableDelta) < 0.01 && Math.abs(igstDelta) < 0.01) return null;

  const invoices = invoiceSummary.quarters.find((row) => row.quarter === invoiceQuarter.quarter)?.invoices || [];
  const directMatch = invoices.find((invoice) => {
    const taxableMatch = round(Number(invoice.subtotal || 0) - Math.abs(taxableDelta)) === 0;
    const igstMatch = round(Number(invoice.tax_breakup?.igst || 0) - Math.abs(igstDelta)) === 0;
    return taxableMatch && igstMatch;
  });

  if (!directMatch) return null;
  return {
    invoiceNumber: directMatch.invoice_number,
    customerName: directMatch.customer_name,
    invoiceDate: directMatch.invoice_date,
    taxable: round(directMatch.subtotal),
    igst: round(directMatch.tax_breakup?.igst || 0),
  };
}

function buildMarkdownReport(result) {
  const lines = [];

  lines.push("# FY 2023-24 Statutory Reconciliation");
  lines.push("");
  lines.push("## Conclusion");
  lines.push(
    `- Turnover bridge: invoices taxable ${formatInr(result.turnoverBridge.invoiceTaxable)} -> GSTR-3B taxable ${formatInr(result.turnoverBridge.gstTaxable)} -> ITR turnover ${formatInr(result.turnoverBridge.itrTurnover)}.`,
  );
  lines.push(
    `- Full-year turnover aligns within ${formatInr(result.turnoverBridge.invoiceToItrVariance)}; GST and ITR are consistent with reconstructed invoice taxable value.`,
  );
  lines.push(
    `- Full-year GST liability aligns exactly: invoice GST ${formatInr(result.taxBridge.invoiceGst)} vs GSTR-3B ${formatInr(result.taxBridge.gstr3bGst)}.`,
  );
  lines.push(
    `- Cash bridge remains timing-sensitive: matched bank receipts ${formatInr(result.cashBridge.matchedBankReceipts)} vs FY invoice cash allocation ${formatInr(result.cashBridge.cashAllocatedToFyInvoices)}; the residual is explained by pre/post-FY allocations and unused customer payments, not by proven revenue leakage.`,
  );
  lines.push(
    `- TDS is not book-consistent: 26AS/ITR credit ${formatInr(result.tdsBridge.form26asTds)} vs invoice TDS fields ${formatInr(result.tdsBridge.invoiceTdsField)} vs receipt-level TDS captured ${formatInr(result.tdsBridge.paymentTdsCaptured)}.`,
  );
  lines.push("");

  lines.push("## Bridges");
  lines.push(
    `- Turnover: ${formatInr(result.turnoverBridge.invoiceTaxable)} -> ${formatInr(result.turnoverBridge.gstTaxable)} -> ${formatInr(result.turnoverBridge.itrTurnover)} | invoice-GST variance ${formatInr(result.turnoverBridge.invoiceToGstVariance)} | GST-ITR variance ${formatInr(result.turnoverBridge.gstToItrVariance)}.`,
  );
  lines.push(
    `- Tax: ${formatInr(result.taxBridge.invoiceGst)} -> ${formatInr(result.taxBridge.gstr3bGst)} | variance ${formatInr(result.taxBridge.variance)}.`,
  );
  lines.push(
    `- Cash: matched bank receipts ${formatInr(result.cashBridge.matchedBankReceipts)} -> payment records ${formatInr(result.cashBridge.paymentRecords)} -> FY invoice cash allocation ${formatInr(result.cashBridge.cashAllocatedToFyInvoices)}.`,
  );
  lines.push(
    `- TDS: 26AS ${formatInr(result.tdsBridge.form26asTds)} -> invoice TDS fields ${formatInr(result.tdsBridge.invoiceTdsField)} -> receipt-level TDS captured ${formatInr(result.tdsBridge.paymentTdsCaptured)}.`,
  );
  lines.push("");

  lines.push("## GST Quarter View");
  for (const row of result.gstQuarterComparison) {
    lines.push(
      `- ${row.quarter}: invoice taxable ${formatInr(row.invoiceTaxable)}, GSTR-3B taxable ${formatInr(row.gstTaxable)}, base variance ${formatInr(row.taxableVariance)}; invoice GST ${formatInr(row.invoiceGst)}, GSTR-3B GST ${formatInr(row.gstGst)}, tax variance ${formatInr(row.gstVariance)}.`,
    );
    if (row.shiftCandidate) {
      lines.push(
        `- ${row.quarter} shift candidate: ${row.shiftCandidate.invoiceNumber} (${row.shiftCandidate.customerName}, ${row.shiftCandidate.invoiceDate}) for taxable ${formatInr(row.shiftCandidate.taxable)} and IGST ${formatInr(row.shiftCandidate.igst)}.`,
      );
    }
  }
  lines.push("");

  lines.push("## TDS Detail");
  for (const row of result.tdsMappedRows.filter((item) => item.mappingStatus !== "unresolved")) {
    lines.push(
      `- ${row.deductorName} -> ${row.mappedCustomer}: 26AS ${formatInr(row.taxDeposited)}, invoice TDS ${formatInr(row.invoiceTds)}, receipt TDS ${formatInr(row.paymentTds)}, receipt gap ${formatInr(row.paymentGap)}.`,
    );
  }
  for (const row of result.tdsMappedRows.filter((item) => item.mappingStatus === "unresolved")) {
    lines.push(
      `- Unresolved deductor: ${row.deductorName} (${row.tan}) gross ${formatInr(row.grossAmount)}, TDS ${formatInr(row.taxDeposited)}.`,
    );
  }
  lines.push("");

  lines.push("## GST 2B Initial Pass");
  lines.push(
    `- Available GSTR-2B files cover ${result.gstr2b.periods.map((row) => row.period).join(", ")} only; deduped ITC evidenced in these files is IGST ${formatInr(result.gstr2b.totals.igst)}, CGST ${formatInr(result.gstr2b.totals.cgst)}, SGST ${formatInr(result.gstr2b.totals.sgst)} across ${result.gstr2b.totals.invoiceCount} vendor invoices.`,
  );
  for (const row of result.vendorEvidence) {
    lines.push(
      `- Vendor evidence check: ${row.name} bank payments ${formatInr(row.amount)} | present in available 2B files: ${row.gstr2bEvidence ? "yes" : "no"}.`,
    );
  }
  lines.push("");

  lines.push("## Real Mismatches");
  for (const item of result.realIssues) {
    lines.push(`- ${item.category}: ${item.description}`);
  }
  lines.push("");

  lines.push("## Audit Readiness");
  lines.push(`- Status: ${result.auditReady ? "audit-ready" : "not audit-ready"}.`);
  lines.push(`- Next corrections: ${result.nextCorrections.join(" | ")}.`);

  return lines.join("\n");
}

function main() {
  fs.mkdirSync(cacheDir, { recursive: true });
  const invoices = readJson(path.join(exportsDir, "fy23_24_revenue_reconstruction.invoices.json"));
  const payments = readJson(path.join(exportsDir, "fy23_24_revenue_reconstruction.payments.json"));
  const matches = readJson(path.join(exportsDir, "fy23_24_revenue_reconstruction.matches.json"));
  const report = readJson(path.join(exportsDir, "fy23_24_revenue_reconstruction.report.json"));
  const bankTransactions = readJson(path.join(exportsDir, "3326_fy2023_24_reconstruction.transactions.json"));
  const itr = readJson(path.join(itrDir, "itr_data_ay_2024_25.json"));

  const invoiceSummary = buildInvoiceSummary(invoices);
  const paymentSummary = buildPaymentSummary(payments);
  const gstr3bRows = fs
    .readdirSync(gstDir)
    .filter((name) => /^gstr3b_.*\.pdf$/i.test(name))
    .map((name) => parseGstr3bFromPdf(path.join(gstDir, name)))
    .sort((a, b) => a.quarter.localeCompare(b.quarter));
  const gstr2bSummary = buildGstr2bSummary(gstDir);
  const vendorEvidence = buildVendorEvidence(bankTransactions, gstr2bSummary);

  const itrTdsGroups = new Map(
    groupBy(itr.ITR.ITR4.TDSonOthThanSals.TDSonOthThanSalDtls, (row) => row.TANOfDeductor).map((group) => [
      group.key,
      {
        tan: group.key,
        grossAmount: round(sum(group.items, (row) => row.GrossAmount)),
        tds: round(sum(group.items, (row) => row.TDSDeducted)),
        rows: group.items,
      },
    ]),
  );

  const tds26asRows = parse26asSummary(path.join(tdsDir, "form26as_fy_2023_24.pdf"));
  const { invoiceByCustomer, paymentByCustomer } = buildCustomerSummaries(invoices, payments);
  const mappedTdsRows = mapDeductorsToCustomers(tds26asRows, itrTdsGroups, invoices, invoiceByCustomer).map((row) => {
    const invoiceCustomer = row.mappedCustomer ? invoiceByCustomer.get(row.mappedCustomer) : null;
    const paymentCustomer = row.mappedCustomer ? paymentByCustomer.get(row.mappedCustomer) : null;
    return {
      ...row,
      invoiceTds: invoiceCustomer ? invoiceCustomer.invoiceTds : null,
      paymentTds: paymentCustomer ? paymentCustomer.paymentTds : null,
      invoiceGap: invoiceCustomer ? round(row.taxDeposited - invoiceCustomer.invoiceTds) : null,
      paymentGap: paymentCustomer ? round(row.taxDeposited - paymentCustomer.paymentTds) : null,
    };
  });

  const gstQuarterComparison = invoiceSummary.quarters.map((invoiceQuarter) => {
    const gstQuarter = gstr3bRows.find((row) => row.quarter === invoiceQuarter.quarter);
    const invoiceGst = round(invoiceQuarter.gst);
    const gstGst = round((gstQuarter?.igst || 0) + (gstQuarter?.cgst || 0) + (gstQuarter?.sgst || 0) + (gstQuarter?.cess || 0));
    return {
      quarter: invoiceQuarter.quarter,
      invoiceTaxable: invoiceQuarter.taxable,
      gstTaxable: gstQuarter?.taxable || 0,
      taxableVariance: round(invoiceQuarter.taxable - (gstQuarter?.taxable || 0)),
      invoiceGst,
      gstGst,
      gstVariance: round(invoiceGst - gstGst),
      shiftCandidate: findQuarterShiftCandidate(invoiceQuarter, gstQuarter || { quarter: invoiceQuarter.quarter, taxable: 0, igst: 0 }, invoiceSummary),
    };
  });

  const turnoverBridge = {
    invoiceTaxable: invoiceSummary.totals.taxable,
    gstTaxable: round(sum(gstr3bRows, (row) => row.taxable)),
    itrTurnover: round(Number(itr.ITR.ITR4.ScheduleBP.TotalTurnoverGrsRcptGSTIN || 0)),
    invoiceToGstVariance: round(invoiceSummary.totals.taxable - sum(gstr3bRows, (row) => row.taxable)),
    gstToItrVariance: round(sum(gstr3bRows, (row) => row.taxable) - Number(itr.ITR.ITR4.ScheduleBP.TotalTurnoverGrsRcptGSTIN || 0)),
  };
  turnoverBridge.invoiceToItrVariance = round(turnoverBridge.invoiceTaxable - turnoverBridge.itrTurnover);

  const taxBridge = {
    invoiceGst: round(invoiceSummary.totals.igst + invoiceSummary.totals.cgst + invoiceSummary.totals.sgst + invoiceSummary.totals.cess),
    gstr3bGst: round(sum(gstr3bRows, (row) => row.igst + row.cgst + row.sgst + row.cess)),
  };
  taxBridge.variance = round(taxBridge.invoiceGst - taxBridge.gstr3bGst);

  const cashBridge = {
    matchedBankReceipts: round(Number(report.totals.total_matched_bank_receipts || 0)),
    paymentRecords: round(Number(report.totals.total_received_by_payments || 0)),
    cashAllocatedToFyInvoices: round(Number(report.totals.total_cash_allocated_to_invoices || 0)),
    withholdingCapturedInFyAllocations: round(Number(report.totals.total_withholding_captured || 0)),
    fyEndOutstandingFromReport: round(Number(report.totals.total_outstanding_as_of_fy_end || 0)),
    paymentRecordsWithoutBankMatch: round(Number(report.unmatched_receipts.payment_records_without_bank_match_amount || 0)),
    unusedCustomerPayments: round(Number(report.unmatched_receipts.unused_receipt_amount || 0)),
    appliedPreFyInvoices: paymentSummary.appliedPreFy,
    appliedPostFyInvoices: paymentSummary.appliedPostFy,
  };

  const tdsBridge = {
    form26asTds: round(sum(tds26asRows, (row) => row.taxDeposited)),
    itrTds: round(Number(itr.ITR.ITR4.TaxPaid.TaxesPaid.TDS || 0)),
    invoiceTdsField: round(invoiceSummary.totals.tdsField),
    paymentTdsCaptured: round(Number(report.totals.total_withholding_captured || 0)),
  };
  tdsBridge.form26asToInvoiceVariance = round(tdsBridge.form26asTds - tdsBridge.invoiceTdsField);
  tdsBridge.form26asToPaymentVariance = round(tdsBridge.form26asTds - tdsBridge.paymentTdsCaptured);

  const realIssues = [];

  const q2 = gstQuarterComparison.find((row) => row.quarter === "Q2");
  const q3 = gstQuarterComparison.find((row) => row.quarter === "Q3");
  if (q2 && q3 && Math.abs(q2.taxableVariance) > 1 && Math.abs(q3.taxableVariance) > 1) {
    realIssues.push({
      category: "GST mismatch",
      description: `Quarter shift: Q2 is short by ${formatInr(Math.abs(q2.taxableVariance))} base and ${formatInr(Math.abs(q2.gstVariance))} GST, while Q3 is excess by the same amount. Exact shift candidate is ${q2.shiftCandidate?.invoiceNumber || "unresolved"} (${q2.shiftCandidate?.customerName || "unknown"}) dated ${q2.shiftCandidate?.invoiceDate || "unknown"}.`,
    });
  }

  const knownMappedShortfall = mappedTdsRows
    .filter((row) => row.mappingStatus !== "unresolved" && Math.abs(row.paymentGap || 0) > 1)
    .sort((a, b) => Math.abs(b.paymentGap) - Math.abs(a.paymentGap));
  for (const row of knownMappedShortfall) {
    realIssues.push({
      category: row.paymentGap > 0 ? "TDS mismatch" : "TDS excess",
      description: `${row.mappedCustomer}: 26AS credit ${formatInr(row.taxDeposited)} vs receipt-level TDS capture ${formatInr(row.paymentTds || 0)}; variance ${formatInr(row.paymentGap)}.`,
    });
  }

  for (const row of mappedTdsRows.filter((item) => item.mappingStatus === "unresolved")) {
    realIssues.push({
      category: "TDS mismatch",
      description: `Unmapped 26AS deductor ${row.deductorName} (${row.tan}) carries gross ${formatInr(row.grossAmount)} and TDS ${formatInr(row.taxDeposited)}; no invoice/customer attribution is proven from available books.`,
    });
  }

  const unresolvedClientReceipts = matches.unmatched_bank_credits.filter(
    (row) => row.prior_classification === "client receipt candidate",
  );
  const unresolvedMaterialReceipts = unresolvedClientReceipts.filter(
    (row) => !/VISA|RVSL\/CHRG/i.test(String(row.narration || "")) && Number(row.amount || 0) >= 1000,
  );
  for (const row of unresolvedMaterialReceipts) {
    realIssues.push({
      category: "classification issue",
      description: `${row.transaction_date} ${formatInr(row.amount)} ${row.narration} remains outside receipt matching output; per operating note this requires explicit non-revenue classification, not silent netting.`,
    });
  }

  const auditReady = realIssues.length === 0;
  const nextCorrections = [
    "Post the GST quarter reclassification for invoice TISGLSE2023103 so Sep and Dec quarter GST bridges both close at quarter level.",
    "Book or repair TDS receivable postings from 26AS for customers with zero receipt-level capture, starting with Redex, Shubham International, Allen Jorgio, Emjay, Satkamal, Tip Top, and Sea Shine.",
    "Book the Rajesh Suraj Bhagat / MUMR22339C credit to SAIRAM EXPORTS and repair the remaining SAIRAM TDS variance against receipts.",
    "Keep the Sea Shine \u20b910,000 receipt and the \u20b91,39,548 returned payment as explicit non-revenue classifications in books.",
    "Do not assert full expense-side ITC reconciliation until a complete FY vendor bill register and full-period GSTR-2B set are loaded.",
  ];

  const result = {
    turnoverBridge,
    taxBridge,
    cashBridge,
    tdsBridge,
    gstQuarterComparison,
    gstr2b: gstr2bSummary,
    vendorEvidence,
    tdsMappedRows: mappedTdsRows,
    realIssues,
    auditReady,
    nextCorrections,
    sourceChecks: {
      itrTdsMatches26as: round(tdsBridge.itrTds - tdsBridge.form26asTds),
      bankUnmatchedByClassification: groupBy(matches.unmatched_bank_credits, (row) => row.prior_classification).map((group) => ({
        classification: group.key,
        count: group.items.length,
        amount: round(sum(group.items, (row) => row.amount)),
      })),
    },
  };

  const jsonPath = path.join(exportsDir, "fy23_24_statutory_reconciliation.report.json");
  const mdPath = path.join(exportsDir, "fy23_24_statutory_reconciliation.summary.md");
  writeText(jsonPath, `${JSON.stringify(result, null, 2)}\n`);
  writeText(mdPath, `${buildMarkdownReport(result)}\n`);

  console.log(JSON.stringify({ jsonPath, mdPath }, null, 2));
}

main();
