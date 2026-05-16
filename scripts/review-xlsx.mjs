import fs from 'fs';
import path from 'path';
import ExcelJS from 'exceljs';

async function main() {
  const fp = path.join(process.cwd(), 'Excel Pricelist', 'EMC_MASTER_IMPORT_2026.xlsx');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(fp);
  const ws = wb.worksheets[0];

  const rows = [];
  ws.eachRow((row, i) => {
    if (i === 1) return; // skip header
    rows.push({
      sku: row.getCell(1).value,
      name: row.getCell(2).value,
      wsp: row.getCell(3).value,
      srp: row.getCell(4).value,
      cat: row.getCell(5).value,
      brand: row.getCell(6).value,
      unit: row.getCell(7).value,
    });
  });

  // Group by top-level category
  const groups = {};
  rows.forEach(r => {
    const top = (r.cat || '').split(' > ')[0];
    if (!groups[top]) groups[top] = [];
    groups[top].push(r);
  });

  let out = `# EMC Master Import Review — ${rows.length} Products\n\n`;

  for (const [dept, items] of Object.entries(groups).sort()) {
    out += `## ${dept} (${items.length} products)\n\n`;
    out += `| # | SKU | Name | WSP | SRP | Category | Unit |\n`;
    out += `|---|-----|------|-----|-----|----------|------|\n`;
    items.forEach((r, i) => {
      out += `| ${i+1} | ${r.sku} | ${r.name} | ${r.wsp} | ${r.srp} | ${r.cat} | ${r.unit} |\n`;
    });
    out += `\n`;
  }

  const outPath = path.join(process.cwd(), 'Excel Pricelist', 'REVIEW.md');
  fs.writeFileSync(outPath, out);
  console.log(`Written to ${outPath}`);
}

main().catch(console.error);
