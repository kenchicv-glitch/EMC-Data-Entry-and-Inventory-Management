import ExcelJS from 'exceljs';
import { format } from 'date-fns';
import type { DscMonthlySummaryRow } from '../types';

function downloadBuffer(buffer: ArrayBuffer, filename: string) {
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function exportDscMonthlyToExcel(
  rows: DscMonthlySummaryRow[],
  year: number,
  month: number
): Promise<void> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('EMC3 SUMMARY');

  ws.getCell('A1').value = `EMC3 DSC ${format(new Date(year, month - 1), 'MMMM').toUpperCase()} SUMMARY ${year}`;
  ws.getCell('A1').font = { bold: true, size: 14 };

  const headers = [
    'DATE', 'CASH', 'CASH OUT', 'CHQ SALES', 'GCASH', 'BANK XFER',
    'TOTAL P1', 'TOTAL P2', 'TOTAL P3',
    'EXPENSES', 'MDA', 'SA WIDRW', 'BIR-CHECK', 'SALARY-CHECK', 'AR MC SALARY',
    'TOTAL AR CASH', 'TOTAL AR1', 'AR2',
    'TOTAL SALES', 'NET SALES',
    'CASH COLL', 'GCASH', 'BNK PSB', 'BNK MBTC', 'CHQ COLL',
    'ZALDY', 'CASH+', 'MILCORP', 'TOTAL DEPOSIT',
  ];

  const headerRow = ws.getRow(2);
  headers.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = h;
    cell.font = { bold: true, size: 9 };
    cell.alignment = { horizontal: 'center', wrapText: true };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE9ECEF' } };
    cell.border = {
      top: { style: 'thin' },
      bottom: { style: 'thin' },
      left: { style: 'thin' },
      right: { style: 'thin' },
    };
  });

  rows.forEach((row, i) => {
    const wsRow = ws.getRow(i + 3);
    const vals = [
      row.date, row.cash, row.cash_out, row.chq_sales, row.gcash, row.bank_transfer,
      row.total_purchases_1, row.total_purchases_2, row.total_purchases_3,
      row.expenses, row.mda, row.sa_withdrawal, row.bir_check, row.salary_check, row.ar_mc_salary,
      row.total_ar_cash, row.total_ar1, row.ar2,
      row.total_sales, row.net_sales,
      row.coll_cash, row.coll_gcash, row.coll_bank_psb, row.coll_bank_mbtc, row.coll_cheque,
      row.coll_zaldy, row.coll_cashplus, row.coll_milcorp, row.total_deposit,
    ];
    vals.forEach((val, j) => {
      const cell = wsRow.getCell(j + 1);
      cell.value = val;
      if (j > 0) cell.numFmt = '#,##0.00';
      cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
    });
  });

  // Auto-width columns
  ws.columns.forEach((col) => { col.width = 14; });
  ws.getColumn(1).width = 12;

  const buffer = await wb.xlsx.writeBuffer();
  downloadBuffer(buffer as ArrayBuffer, `EMC3_DSC_${year}${String(month).padStart(2, '0')}.xlsx`);
}
