import ExcelJS from 'exceljs';
import { format } from 'date-fns';

/**
 * Standard CSV Export for generic data
 */
export const exportToCSV = (data: Record<string, unknown>[], filename: string) => {
    if (data.length === 0) return;

    const headers = Object.keys(data[0]);
    const csvContent = [
        headers.join(','),
        ...data.map(row =>
            headers.map(header => {
                const value = row[header] ?? '';
                const stringValue = String(value).replace(/"/g, '""');
                return `"${stringValue}"`;
            }).join(',')
        )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `${filename}_${format(new Date(), 'yyyy-MM-dd')}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
};

/**
 * BIR-Compliant Sales Journal / OR Summary Excel Export
 */
export const exportBIRSalesJournal = async (sales: any[]) => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Sales Journal');

    // Headers
    worksheet.columns = [
        { header: 'Date', key: 'date', width: 15 },
        { header: 'OR Number', key: 'or_number', width: 15 },
        { header: 'Customer', key: 'customer', width: 25 },
        { header: 'TIN', key: 'tin', width: 15 },
        { header: 'VAT Classification', key: 'classification', width: 20 },
        { header: 'Gross Sales (PHP)', key: 'gross', width: 18 },
        { header: 'Output VAT (PHP)', key: 'vat', width: 18 },
        { header: 'Net Sales (PHP)', key: 'net', width: 18 },
        { header: 'Discount (PHP)', key: 'discount', width: 15 }
    ];

    // Styling headers
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
    };

    // Add Data
    sales.forEach(sale => {
        const vatAmount = Number(sale.vat_amount || 0);
        const grossAmount = Number(sale.total_price || 0);
        const netAmount = grossAmount - vatAmount;

        worksheet.addRow({
            date: format(new Date(sale.date), 'MM/dd/yyyy'),
            or_number: sale.or_number || 'N/A',
            customer: sale.customers?.name || 'Walk-in',
            tin: sale.customers?.tin || 'N/A',
            classification: sale.vat_classification?.toUpperCase() || 'VATABLE',
            gross: grossAmount,
            vat: vatAmount,
            net: netAmount,
            discount: Number(sale.discount_amount || 0)
        });
    });

    // Formatting numbers
    worksheet.getColumn('gross').numFmt = '#,##0.00';
    worksheet.getColumn('vat').numFmt = '#,##0.00';
    worksheet.getColumn('net').numFmt = '#,##0.00';
    worksheet.getColumn('discount').numFmt = '#,##0.00';

    // Download
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `BIR_Sales_Journal_${format(new Date(), 'yyyy_MM')}.xlsx`;
    a.click();
    window.URL.revokeObjectURL(url);
};

/**
 * BIR Summary Worksheet (VAT Compliance Basis)
 */
export const exportBIRSummaryWorksheet = async (metrics: any) => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('BIR Summary');

    worksheet.addRow(['EMC TRADING - BIR SUMMARY WORKSHEET']);
    worksheet.addRow([`Report Period: ${format(new Date(), 'MMMM yyyy')}`]);
    worksheet.addRow([]);

    worksheet.addRow(['VAT CATEGORY', 'GROSS AMOUNT', 'OUTPUT VAT', 'NET SALES']);
    worksheet.addRow(['Vatable Sales', metrics.vatableSales, metrics.outputVat, metrics.vatableSales - metrics.outputVat]);
    worksheet.addRow(['Exempt Sales', metrics.exemptSales, 0, metrics.exemptSales]);
    worksheet.addRow(['Zero-Rated Sales', metrics.zeroRatedSales, 0, metrics.zeroRatedSales]);
    worksheet.addRow([]);
    worksheet.addRow(['TOTALS', metrics.grossSales, metrics.outputVat, metrics.grossSales - metrics.outputVat]);

    worksheet.addRow([]);
    worksheet.addRow(['INPUT VAT BASIS']);
    worksheet.addRow(['Total Purchases', metrics.grossPurchases]);
    worksheet.addRow(['Total Input VAT', metrics.inputVat]);
    worksheet.addRow([]);
    worksheet.addRow(['VAT PAYABLE (DUE)', metrics.vatPayable]);

    // Styling
    worksheet.getRow(1).font = { bold: true, size: 14 };
    worksheet.getRow(4).font = { bold: true };

    const numberRows = [5, 6, 7, 9, 12, 13, 15];
    numberRows.forEach(rowIdx => {
        const row = worksheet.getRow(rowIdx);
        row.getCell(2).numFmt = '#,##0.00';
        row.getCell(3).numFmt = '#,##0.00';
        row.getCell(4).numFmt = '#,##0.00';
    });

    // Download
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `BIR_Summary_Worksheet_${format(new Date(), 'yyyy_MM')}.xlsx`;
    a.click();
    window.URL.revokeObjectURL(url);
};

/**
 * Export Inventory to Excel (Template & Data)
 * Groups products by Master Category (L1) into separate sheets.
 */
export const exportInventoryToExcel = async (products: any[], branchName: string = 'Current Branch') => {
    const workbook = new ExcelJS.Workbook();
    
    // Group products by L1 (Master Category)
    const groups: Record<string, any[]> = {};
    products.forEach(p => {
        const parts = p.name.split(' > ');
        const l1 = (parts[0] || 'UNCATEGORIZED').toUpperCase();
        if (!groups[l1]) groups[l1] = [];
        groups[l1].push(p);
    });

    const l1s = Object.keys(groups).sort();
    if (l1s.length === 0) {
        // Create an empty template sheet if no products
        const ws = workbook.addWorksheet('INVENTORY');
        ws.columns = [
            { header: 'ITEM NAME', key: 'name', width: 50 },
            { header: 'BUYING PRICE (COST)', key: 'buying_price', width: 20 },
            { header: 'SELLING PRICE (SRP)', key: 'selling_price', width: 20 },
            { header: 'CURRENT STOCK', key: 'stock', width: 15 },
            { header: 'MINIMUM ALERT', key: 'threshold', width: 15 },
            { header: 'BRAND', key: 'brand', width: 20 }
        ];
    } else {
        l1s.forEach(l1 => {
            // Excel sheet names have a 31 char limit and some forbidden chars
            const safeSheetName = l1.substring(0, 30).replace(/[*?:\\/[\]]/g, '_');
            const worksheet = workbook.addWorksheet(safeSheetName);

            worksheet.columns = [
                { header: 'ITEM NAME', key: 'name', width: 50 },
                { header: 'BUYING PRICE (COST)', key: 'buying_price', width: 20 },
                { header: 'SELLING PRICE (SRP)', key: 'selling_price', width: 20 },
                { header: 'CURRENT STOCK', key: 'stock', width: 15 },
                { header: 'MINIMUM ALERT', key: 'threshold', width: 15 },
                { header: 'BRAND', key: 'brand', width: 20 }
            ];

            // Styling headers
            worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
            worksheet.getRow(1).fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFC00000' } // Brand Red
            };

            // Add Data
            groups[l1].forEach(p => {
                const parts = p.name.split(' > ');
                // If it's hierarchical, the "Item Name" in the row is everything AFTER the L1
                const rowName = parts.length > 1 ? parts.slice(1).join(' > ') : parts[0];
                
                worksheet.addRow({
                    name: rowName,
                    buying_price: p.buying_price || 0,
                    selling_price: p.selling_price || 0,
                    stock: p.stock_available || 0,
                    threshold: p.low_stock_threshold || 10,
                    brand: p.brand || ''
                });
            });

            // Formatting
            worksheet.getColumn('buying_price').numFmt = '#,##0.00';
            worksheet.getColumn('selling_price').numFmt = '#,##0.00';
            worksheet.getColumn('stock').numFmt = '0';
            worksheet.getColumn('threshold').numFmt = '0';
        });
    }

    // Download
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Inventory_${branchName.replace(/\s+/g, '_')}_${format(new Date(), 'yyyy_MM_dd')}.xlsx`;
    a.click();
    window.URL.revokeObjectURL(url);
};
