import ExcelJS from 'exceljs';
import type { Product, StocktakeItem } from '../types/product';

// ---- PRODUCT LIST EXPORT ----

export async function exportProductsToExcel(products: Product[]): Promise<void> {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Products');

    ws.columns = [
        { header: 'SKU',                    key: 'sku',                    width: 15 },
        { header: 'Name',                   key: 'name',                   width: 35 },
        { header: 'Brand',                  key: 'brand',                  width: 15 },
        { header: 'Unit',                   key: 'unit',                   width: 10 },
        { header: 'Category',               key: 'category',               width: 25 },
        { header: 'Location',               key: 'location',               width: 15 },
        { header: 'Stock Available',        key: 'stock_available',        width: 16 },
        { header: 'Stock Reserved',         key: 'stock_reserved',         width: 15 },
        { header: 'Stock Damaged',          key: 'stock_damaged',          width: 15 },
        { header: 'Low Stock Threshold',    key: 'low_stock_threshold',    width: 20 },
        { header: 'Selling Price',          key: 'selling_price',          width: 14 },
        { header: 'Buying Price',           key: 'buying_price',           width: 13 },
        { header: 'Supplier Selling Price', key: 'supplier_selling_price', width: 22 },
    ];

    // Style header row
    const headerRow = ws.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FF1E293B' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };
    headerRow.height = 20;

    products.forEach((p, i) => {
        ws.addRow({
            sku:                    p.sku,
            name:                   p.name,
            brand:                  p.brand ?? '',
            unit:                   p.unit ?? '',
            category:               p.category?.name ?? '',
            location:               p.location?.code ?? '',
            stock_available:        p.stock_available,
            stock_reserved:         p.stock_reserved,
            stock_damaged:          p.stock_damaged,
            low_stock_threshold:    p.low_stock_threshold ?? 0,
            selling_price:          p.selling_price ?? 0,
            buying_price:           p.buying_price ?? 0,
            supplier_selling_price: p.supplier_selling_price ?? 0,
        });

        // Highlight low-stock rows
        const threshold = p.low_stock_threshold ?? 0;
        if (p.stock_available <= threshold && threshold > 0) {
            ws.getRow(i + 2).fill = {
                type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFCE4D6' },
            };
        }
    });

    const buffer = await wb.xlsx.writeBuffer();
    triggerDownload(buffer, `EMC3_Inventory_${today()}.xlsx`);
}

// ---- IMPORT TEMPLATE ----

export async function downloadImportTemplate(): Promise<void> {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Import Template');

    ws.columns = [
        { header: 'sku *',                                           key: 'sku',                    width: 15 },
        { header: 'name *',                                          key: 'name',                   width: 35 },
        { header: 'description',                                     key: 'description',            width: 30 },
        { header: 'brand',                                           key: 'brand',                  width: 15 },
        { header: 'unit',                                            key: 'unit',                   width: 10 },
        { header: 'selling_price *',                                 key: 'selling_price',          width: 15 },
        { header: 'buying_price *',                                  key: 'buying_price',           width: 14 },
        { header: 'supplier_selling_price',                          key: 'supplier_selling_price', width: 22 },
        { header: 'stock_available',                                 key: 'stock_available',        width: 16 },
        { header: 'low_stock_threshold',                             key: 'low_stock_threshold',    width: 20 },
        { header: 'category_path (e.g. Plumbing > Pipes > PVC)',    key: 'category_path',          width: 42 },
        { header: 'location_code (e.g. SH-A)',                      key: 'location_code',          width: 26 },
    ];

    const headerRow = ws.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF203864' } };
    headerRow.height = 20;

    // Sample data row
    ws.addRow({
        sku:                    'PVC-1/2-001',
        name:                   'PVC Pipe 1/2 inch',
        description:            'Standard PVC pressure pipe',
        brand:                  'Neltex',
        unit:                   'pc',
        selling_price:          90,
        buying_price:           75,
        supplier_selling_price: 80,
        stock_available:        50,
        low_stock_threshold:    10,
        category_path:          'Plumbing > Pipes > PVC',
        location_code:          'SH-A',
    });

    const buffer = await wb.xlsx.writeBuffer();
    triggerDownload(buffer, 'EMC3_Import_Template.xlsx');
}

// ---- STOCKTAKE SHEET EXPORT ----

export async function exportStocktakeSheet(
    items: StocktakeItem[],
    sessionId: string
): Promise<void> {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Stocktake');

    ws.columns = [
        { header: '#',           key: 'row',         width: 6  },
        { header: 'SKU',         key: 'sku',         width: 15 },
        { header: 'Name',        key: 'name',        width: 35 },
        { header: 'Unit',        key: 'unit',        width: 10 },
        { header: 'System Qty',  key: 'system_qty',  width: 12 },
        { header: 'Counted Qty', key: 'counted_qty', width: 13 },
        { header: 'Variance',    key: 'variance',    width: 11 },
        { header: 'Notes',       key: 'notes',       width: 25 },
    ];

    const headerRow = ws.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };

    items.forEach((item, i) => {
        const row = ws.addRow({
            row:         i + 1,
            sku:         item.product?.sku ?? '',
            name:        item.product?.name ?? '',
            unit:        item.product?.unit ?? '',
            system_qty:  item.system_qty,
            counted_qty: item.counted_qty ?? '',
            variance:    item.variance ?? '',
            notes:       item.notes ?? '',
        });

        if (item.variance !== null && item.variance < 0) {
            row.getCell('variance').font = { color: { argb: 'FFCC0000' }, bold: true };
        } else if (item.variance !== null && item.variance > 0) {
            row.getCell('variance').font = { color: { argb: 'FF0B6E4F' }, bold: true };
        }
    });

    const buffer = await wb.xlsx.writeBuffer();
    triggerDownload(buffer, `EMC3_Stocktake_${sessionId.slice(0, 8)}_${today()}.xlsx`);
}

// ---- HELPERS ----

function today(): string {
    return new Date().toISOString().slice(0, 10);
}

function triggerDownload(buffer: ExcelJS.Buffer, filename: string): void {
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
