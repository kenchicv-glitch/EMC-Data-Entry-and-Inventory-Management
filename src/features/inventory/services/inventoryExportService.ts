import ExcelJS from 'exceljs';
import type { Product, StocktakeItem } from '../types/product';

// ── PRODUCT LIST EXPORT ──────────────────────────────────────────────────────

export async function exportProductsToExcel(products: Product[]): Promise<void> {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Products');

    ws.columns = [
        { header: 'Master Category',        key: 'master',                 width: 20 },
        { header: 'Category',               key: 'category',               width: 20 },
        { header: 'Sub-category',           key: 'subcategory',            width: 20 },
        { header: 'Name',                   key: 'name',                   width: 35 },
        { header: 'SKU',                    key: 'sku',                    width: 22 },
        { header: 'Brand',                  key: 'brand',                  width: 15 },
        { header: 'Variant / Type',         key: 'variant_type',           width: 18 },
        { header: 'Size',                   key: 'size',                   width: 14 },
        { header: 'Unit',                   key: 'unit',                   width: 10 },
        { header: 'Stock Available',        key: 'stock_available',        width: 16 },
        { header: 'Low Stock Threshold',    key: 'low_stock_threshold',    width: 20 },
        { header: 'Selling Price',          key: 'selling_price',          width: 14 },
        { header: 'Buying Price',           key: 'buying_price',           width: 13 },
        { header: 'Supplier Selling Price', key: 'supplier_selling_price', width: 22 },
        { header: 'Location',              key: 'location',               width: 15 },
    ];

    // Style header row
    const headerRow = ws.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FF1E293B' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };
    headerRow.height = 20;

    products.forEach((p, i) => {
        const cat = (p as any).category;
        let master = '', category = '', subcategory = '';
        if (cat) {
            const depth = cat.depth ?? 0;
            if (depth === 2) {
                subcategory = cat.name ?? '';
                category    = cat.parent?.name ?? '';
                master      = cat.parent?.parent?.name ?? '';
            } else if (depth === 1) {
                category = cat.name ?? '';
                master   = cat.parent?.name ?? '';
            } else {
                master = cat.name ?? '';
            }
        } else {
            // Legacy: extract from name path
            const parts = p.name.split(' > ');
            master      = parts[0] ?? '';
            category    = parts[1] ?? '';
            subcategory = parts.length > 3 ? parts[2] : '';
        }

        ws.addRow({
            master,
            category,
            subcategory,
            name:                   p.name.includes(' > ') ? p.name.split(' > ').slice(-1)[0] : p.name,
            sku:                    p.sku && !p.sku.includes(' > ') ? p.sku : '',
            brand:                  p.brand ?? '',
            variant_type:           p.variant_type ?? '',
            size:                   p.size ?? '',
            unit:                   p.unit ?? '',
            stock_available:        p.stock_available,
            low_stock_threshold:    p.low_stock_threshold ?? 0,
            selling_price:          p.selling_price ?? 0,
            buying_price:           p.buying_price ?? 0,
            supplier_selling_price: p.supplier_selling_price ?? 0,
            location:               (p as any).location?.code ?? '',
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

// ── IMPORT TEMPLATE ──────────────────────────────────────────────────────────
// Structured 4-column format replacing the old single category_path column.

export async function downloadImportTemplate(): Promise<void> {
    const wb = new ExcelJS.Workbook();

    // ── Sheet 1: Import Template ──────────────────────────────────────────
    const ws = wb.addWorksheet('Import Template');

    ws.columns = [
        { header: 'Master Category ★',     key: 'master',                 width: 22 },
        { header: 'Category',               key: 'category',               width: 22 },
        { header: 'Sub-category',           key: 'subcategory',            width: 22 },
        { header: 'Product Name ★',        key: 'name',                   width: 38 },
        { header: 'SKU',                    key: 'sku',                    width: 18 },
        { header: 'Brand',                  key: 'brand',                  width: 15 },
        { header: 'Unit ★',                key: 'unit',                   width: 10 },
        { header: 'Buying Price / WSP ★',  key: 'buying_price',           width: 20 },
        { header: 'Selling Price / SRP ★', key: 'selling_price',          width: 20 },
        { header: 'Supplier Selling Price', key: 'supplier_selling_price', width: 22 },
        { header: 'Stock',                  key: 'stock_available',        width: 10 },
        { header: 'Low Stock Alert',        key: 'low_stock_threshold',    width: 16 },
        { header: 'Location Code',          key: 'location_code',          width: 16 },
    ];

    // Header styling — required cols in brand-red, optional in slate
    const REQUIRED_RED  = 'FFDC2626';
    const OPTIONAL_GRAY = 'FF334155';
    const headerRow = ws.getRow(1);
    headerRow.height = 22;
    headerRow.eachCell((cell, colNum) => {
        const isRequired = [1, 4, 7, 8, 9].includes(colNum);
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isRequired ? REQUIRED_RED : OPTIONAL_GRAY } };
        cell.alignment = { vertical: 'middle' };
    });

    // Master Category dropdown validation
    const MASTER_CATS = [
        'STEEL', 'PLYWOOD', 'ELECTRICALS', 'ROOFING', 'LUMBER',
        'PIPES AND FITTINGS', 'HARDWARE AND FASTENERS',
        'CEMENT AND AGGREGATES', 'DOORS AND FIXTURES',
        'PAINTS AND FINISHES', 'BOYSEN',
    ];
    (ws as any).dataValidations.add('A2:A5000', {
        type: 'list',
        allowBlank: false,
        formulae: [`"${MASTER_CATS.join(',')}"`],
        showErrorMessage: true,
        errorTitle: 'Invalid Master Category',
        error: 'Please select a master category from the list.',
    });

    // Sample rows
    const samples = [
        {
            master: 'STEEL', category: 'Steel Matting', subcategory: 'Manipis #6',
            name: '#6 EXPANDED WIRE MESH 4X8', sku: '', brand: 'Master Steel',
            unit: 'sheet', buying_price: 890, selling_price: 1050,
            supplier_selling_price: 920, stock_available: 50, low_stock_threshold: 5, location_code: 'SH-A',
        },
        {
            master: 'BOYSEN', category: 'Enamel - Flat Wall', subcategory: '',
            name: 'B800 FLAT WALL ENAMEL WHITE 16L', sku: '', brand: 'Boysen',
            unit: 'gallon', buying_price: 620, selling_price: 750,
            supplier_selling_price: 660, stock_available: 30, low_stock_threshold: 3, location_code: 'SH-B',
        },
        {
            master: 'PIPES AND FITTINGS', category: 'PVC Pipes', subcategory: '',
            name: 'PVC PIPE 1/2 INCH PRESSURE 6M', sku: '', brand: 'Neltex',
            unit: 'length', buying_price: 75, selling_price: 95,
            supplier_selling_price: 80, stock_available: 100, low_stock_threshold: 10, location_code: 'SH-C',
        },
    ];

    samples.forEach((row, i) => {
        const r = ws.addRow(row);
        r.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: i % 2 === 0 ? 'FFF8FAFC' : 'FFFFFFFF' } };
    });

    // ── Sheet 2: Instructions ─────────────────────────────────────────────
    const wsInfo = wb.addWorksheet('📋 Instructions');
    const instructions = [
        ['EMC3 Inventory Import Template — Instructions'],
        [''],
        ['COLUMNS'],
        ['Master Category ★', 'Required. Select from the dropdown: STEEL, BOYSEN, PIPES AND FITTINGS, etc.'],
        ['Category', 'Optional. The product category under the master (e.g. Steel Matting, Enamel - Flat Wall).'],
        ['Sub-category', 'Optional. Finer grouping (e.g. Manipis #6, Manipis #8).'],
        ['Product Name ★', 'Required. The clean product name WITHOUT any category prefix.'],
        ['SKU', 'Optional. Leave blank to auto-generate.'],
        ['Brand', 'Optional. Manufacturer or brand name.'],
        ['Unit ★', 'Required. Unit of measurement: pc, sheet, length, gallon, bag, roll, kg, set, box…'],
        ['Buying Price / WSP ★', 'Required. Your cost price. Cannot equal or exceed Selling Price.'],
        ['Selling Price / SRP ★', 'Required. The customer-facing price.'],
        ['Supplier Selling Price', 'Optional. The price the supplier lists (before your negotiated cost).'],
        ['Stock', 'Optional. Initial stock count. Defaults to 100 if left blank.'],
        ['Low Stock Alert', 'Optional. Alert threshold. Defaults to 10 if left blank.'],
        ['Location Code', 'Optional. Warehouse shelf code (e.g. SH-A, SH-B).'],
        [''],
        ['TIPS'],
        ['★ = Required field. Red headers are required; grey headers are optional.'],
        ['Do NOT change column headers or column order.'],
        ['You may delete the sample rows (rows 2-4) before filling in your data.'],
        ['Prices can use the QUICK EPOXY cipher: Q=1 U=2 I=3 C=4 K=5 E=6 P=7 O=8 X=9 Y=0 S=repeat'],
    ];

    instructions.forEach((row, i) => {
        const r = wsInfo.addRow(row);
        if (i === 0) {
            r.font = { bold: true, size: 14 };
        } else if (i === 2 || i === 17) {
            r.font = { bold: true, color: { argb: 'FFDC2626' } };
        }
    });
    wsInfo.getColumn(1).width = 28;
    wsInfo.getColumn(2).width = 75;

    const buffer = await wb.xlsx.writeBuffer();
    triggerDownload(buffer, 'EMC3_Import_Template.xlsx');
}

// ── STOCKTAKE SHEET EXPORT ───────────────────────────────────────────────────

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

// ── HELPERS ──────────────────────────────────────────────────────────────────

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
