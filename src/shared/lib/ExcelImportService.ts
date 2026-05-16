import ExcelJS from 'exceljs';
import { buildSkuPrefix, generateSku, extractSize, extractVariantType } from './skuGenerator';

export interface RawProductData {
    name: string;
    stock_available: number;
    stock_reserved: number;
    stock_damaged: number;
    buying_price?: number;
    selling_price?: number;
    supplier_selling_price?: number;
    unit?: string;
    brand?: string;
    sku: string;
    // New fields for structured import
    category_path?: string;   // e.g. 'STEEL > Steel Matting > Manipis #6'
    location_code?: string;
    low_stock_threshold?: number;
}

// ── PRICE CIPHER ──────────────────────────────────────────────────────────────
// QUICK EPOXY: Q=1 U=2 I=3 C=4 K=5 E=6 P=7 O=8 X=9 Y=0  S=repeat last digit
const decodeCipher = (text: string): number => {
    if (!text) return 0;
    const upper = text.toUpperCase().trim();

    if (/[0-9]/.test(upper)) {
        return parseFloat(upper.replace(/[^0-9.]/g, '')) || 0;
    }

    const map: Record<string, string> = {
        'Q': '1', 'U': '2', 'I': '3', 'C': '4', 'K': '5',
        'E': '6', 'P': '7', 'O': '8', 'X': '9', 'Y': '0',
    };

    let result = '';
    let lastDigit = '';
    for (const char of upper) {
        if (char === 'S') {
            result += lastDigit;
        } else if (map[char]) {
            lastDigit = map[char];
            result += lastDigit;
        } else if (char === '.') {
            result += '.';
        }
    }
    return parseFloat(result) || 0;
};

const fixSwappedPrices = (buying: number, selling: number): [number, number] => {
    if (buying > selling && selling !== 0) return [selling, buying];
    return [buying, selling];
};

// ── STRUCTURED FORMAT PARSER ─────────────────────────────────────────────────
// Detects the new 4-column header template:
//   A: Master Category  B: Category  C: Sub-category  D: Product Name
//   E: SKU  F: Brand  G: Unit  H: Buying Price  I: Selling Price
//   J: Supplier Selling Price  K: Stock  L: Low Stock Alert  M: Location Code

interface StructuredColMap {
    master: number; category: number; subcategory: number; name: number;
    sku: number; brand: number; unit: number;
    buying: number; selling: number; supplierSelling: number;
    stock: number; lowStock: number; location: number;
}

function detectStructuredFormat(
    headerRow: ExcelJS.Row
): StructuredColMap | null {
    const cols: StructuredColMap = {
        master: -1, category: -1, subcategory: -1, name: -1,
        sku: -1, brand: -1, unit: -1,
        buying: -1, selling: -1, supplierSelling: -1,
        stock: -1, lowStock: -1, location: -1,
    };

    let found = false;
    headerRow.eachCell((cell, col) => {
        const val = String(cell.value ?? '').toUpperCase().trim();
        if (val.includes('MASTER')) { cols.master = col; found = true; }
        else if (val.includes('SUB')) cols.subcategory = col;
        else if (val.includes('CATEGORY')) cols.category = col;
        else if (val.includes('PRODUCT NAME') || val.includes('NAME')) cols.name = col;
        else if (val === 'SKU') cols.sku = col;
        else if (val.includes('BRAND')) cols.brand = col;
        else if (val.includes('UNIT')) cols.unit = col;
        else if (val.includes('BUYING') || val.includes('WSP')) cols.buying = col;
        else if (val.includes('SELLING') || val.includes('SRP')) cols.selling = col;
        else if (val.includes('SUPPLIER')) cols.supplierSelling = col;
        else if (val.includes('LOW STOCK')) cols.lowStock = col;
        else if (val.includes('STOCK')) cols.stock = col;
        else if (val.includes('LOCATION')) cols.location = col;
    });

    return found ? cols : null;
}

function parseStructuredRow(
    row: ExcelJS.Row,
    cols: StructuredColMap,
    existingSkus: string[] = []
): RawProductData | null {
    const getStr = (c: number) => c > 0 ? String(row.getCell(c).value ?? '').trim() : '';
    const getNum = (c: number) => c > 0 ? decodeCipher(String(row.getCell(c).value ?? '0')) : 0;

    const master     = getStr(cols.master).toUpperCase();
    const category   = getStr(cols.category);
    const subcategory = getStr(cols.subcategory);
    const productName = getStr(cols.name);

    if (!productName || !master) return null;

    // Build category path for category resolution
    const pathParts = [master, category, subcategory].filter(Boolean);
    const categoryPath = pathParts.join(' > ');

    const rawSku = getStr(cols.sku);
    const brandStr = getStr(cols.brand) || undefined;

    // Generate structured SKU if not explicitly provided
    let sku: string;
    if (rawSku && !rawSku.includes(' > ')) {
        // Explicit non-breadcrumb SKU provided — use it
        sku = rawSku.toUpperCase();
    } else {
        // Auto-generate using the new format
        const size = extractSize(productName);
        const prefix = buildSkuPrefix(master, subcategory || category || undefined, brandStr, productName);
        // Find next sequence from existing SKUs + already-generated in this batch
        let maxSeq = 0;
        const prefixDash = prefix + '-';
        for (const s of existingSkus) {
            if (s.startsWith(prefixDash)) {
                const seqPart = s.slice(prefixDash.length);
                const num = parseInt(seqPart, 10);
                if (!isNaN(num) && num > maxSeq) maxSeq = num;
            }
        }
        sku = generateSku({
            masterCategory: master,
            subCategory: subcategory || category || undefined,
            brand: brandStr,
            size: size || undefined,
            sequenceNumber: maxSeq + 1,
        });
        existingSkus.push(sku); // Track for next row in batch
    }

    let buying  = getNum(cols.buying);
    let selling = getNum(cols.selling);
    [buying, selling] = fixSwappedPrices(buying, selling);

    const supplierSelling = getNum(cols.supplierSelling);
    const stock    = cols.stock > 0 ? (parseInt(String(row.getCell(cols.stock).value ?? '100')) || 100) : 100;
    const lowStock = cols.lowStock > 0 ? (parseInt(String(row.getCell(cols.lowStock).value ?? '10')) || 10) : 10;

    return {
        name:                    productName.toUpperCase(),
        sku,
        category_path:           categoryPath || undefined,
        location_code:           getStr(cols.location) || undefined,
        brand:                   brandStr,
        unit:                    getStr(cols.unit) || 'pc',
        buying_price:            buying,
        selling_price:           selling,
        supplier_selling_price:  supplierSelling || undefined,
        stock_available:         stock,
        stock_reserved:          0,
        stock_damaged:           0,
        low_stock_threshold:     lowStock,
    };
}

// ── LEGACY FORMAT PARSERS ─────────────────────────────────────────────────────

const categorizeLegacy = (l1: string): string => {
    if (!l1) return 'UNCATEGORIZED';
    return l1.replace(/[▸\s]/g, '').trim().toUpperCase();
};

const inferMasterFromName = (upName: string): string => {
    if (upName.includes('PIPE') || upName.includes('FITTING') || upName.includes('PVC')
        || upName.includes('ELBOW') || upName.includes('TEE') || upName.includes('SOCKET')
        || upName.includes('GI') || upName.includes('FLEXIBLE')) return 'PIPES AND FITTINGS';
    if (upName.includes('HARDWARE') || upName.includes('FASTENER')
        || upName.includes('NAIL') || upName.includes('SCREW') || upName.includes('BOLT')) return 'HARDWARE AND FASTENERS';
    if (upName.includes('CEMENT') || upName.includes('AGGREGATE')
        || upName.includes('SAND') || upName.includes('GRAVEL') || upName.includes('CHB')) return 'CEMENT AND AGGREGATES';
    if (upName.includes('DOOR') || upName.includes('JAMB')
        || upName.includes('LOCK') || upName.includes('HINGE')) return 'DOORS AND FIXTURES';
    if (upName.includes('PAINT') || upName.includes('LATEX') || upName.includes('ENAMEL')
        || upName.includes('ROLLER') || upName.includes('BRUSH') || upName.includes('THINNER')) return 'PAINTS AND FINISHES';
    if (upName.includes('ELECTRICAL') || upName.includes('WIRE') || upName.includes('CABLE')
        || upName.includes('BREAKER') || upName.includes('SWITCH') || upName.includes('OUTLET')
        || upName.includes('LIGHT') || upName.includes('CONDUIT')) return 'ELECTRICALS';
    if (upName.includes('STEEL') || upName.includes('RSB')
        || upName.includes('BAR') || upName.includes('WIRE MESH')) return 'STEEL';
    if (upName.includes('PLYWOOD') || upName.includes('FLEXBOARD')
        || upName.includes('GYPSUM')) return 'PLYWOOD';
    if (upName.includes('ROOFING') || upName.includes('GUTTER')
        || upName.includes('PURLIN') || upName.includes('GI SHEET')) return 'ROOFING';
    if (upName.includes('LUMBER') || upName.includes('WOOD')
        || upName.includes('PLANK')) return 'LUMBER';
    return 'UNCATEGORIZED';
};

// ── MAIN PARSE ENTRY POINT ────────────────────────────────────────────────────

export const parseExcelFile = async (file: File): Promise<RawProductData[]> => {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = new ExcelJS.Workbook();
    try {
        await workbook.xlsx.load(arrayBuffer);
    } catch (err) {
        console.error('Excel load error:', err);
        throw new Error('Failed to parse Excel file.');
    }

    const productsMap = new Map<string, RawProductData>();

    const batchSkus: string[] = []; // Track SKUs generated in this batch for sequencing

    workbook.eachSheet((worksheet) => {
        // Skip the instructions sheet
        if (worksheet.name.toLowerCase().includes('instruction')) return;

        let structuredCols: StructuredColMap | null = null;
        let isFlatFormat = false;
        let flatColMap = { name: 1, buying: 7, selling: 6, stock: -1, min: -1, unit: 8, brand: -1 };

        let currentMaster = '';
        let currentCategory = '';
        let currentSubCategory = '';

        worksheet.eachRow((row, rowIndex) => {
            // ── Header detection (row 1 only) ────────────────────────────
            if (rowIndex === 1) {
                const headerText = (row.values as any[]).join('|').toUpperCase();

                // 1. New structured format?
                structuredCols = detectStructuredFormat(row);
                if (structuredCols) return; // Header row parsed — skip to data

                // 2. Flat format (ITEM NAME header)?
                if (headerText.includes('ITEM NAME')) {
                    isFlatFormat = true;
                    row.eachCell((cell, colIndex) => {
                        const val = String(cell.value ?? '').toUpperCase();
                        if (val.includes('ITEM NAME'))      flatColMap.name    = colIndex;
                        if (val.includes('BUYING PRICE'))   flatColMap.buying  = colIndex;
                        if (val.includes('SELLING PRICE'))  flatColMap.selling = colIndex;
                        if (val.includes('CURRENT STOCK'))  flatColMap.stock   = colIndex;
                        if (val.includes('MINIMUM ALERT'))  flatColMap.min     = colIndex;
                        if (val.includes('BRAND'))          flatColMap.brand   = colIndex;
                    });
                    return;
                }

                // 3. Check for explicit header row to skip
                const col1 = String(row.getCell(1).value ?? '').trim().toUpperCase();
                if (col1.includes('MASTER') || col1.includes('L1')) return;
                // fall through to hierarchical parser
            }

            // ── NEW STRUCTURED FORMAT ─────────────────────────────────────
            if (structuredCols) {
                const item = parseStructuredRow(row, structuredCols, batchSkus);
                if (!item) return;
                const key = item.name;
                if (!productsMap.has(key)) productsMap.set(key, item);
                return;
            }

            // ── FLAT FORMAT ───────────────────────────────────────────────
            if (isFlatFormat) {
                const rawName = String(row.getCell(flatColMap.name).value ?? '').trim();
                if (!rawName || rawName.toUpperCase() === 'ITEM NAME') return;

                let buying  = decodeCipher(String(row.getCell(flatColMap.buying).value ?? '0'));
                let selling = decodeCipher(String(row.getCell(flatColMap.selling).value ?? '0'));
                [buying, selling] = fixSwappedPrices(buying, selling);

                const stock = flatColMap.stock !== -1 ? parseInt(String(row.getCell(flatColMap.stock).value ?? '100')) : 100;
                const brand = flatColMap.brand !== -1 ? String(row.getCell(flatColMap.brand).value ?? '').trim() : undefined;
                const master = inferMasterFromName(rawName.toUpperCase());
                const fullName = `${master} > ${rawName}`.toUpperCase();

                if (!productsMap.has(fullName)) {
                    productsMap.set(fullName, {
                        name:              fullName,
                        sku:               fullName,
                        stock_available:   stock,
                        stock_reserved:    0,
                        stock_damaged:     0,
                        selling_price:     selling,
                        buying_price:      buying,
                        unit:              'pc',
                        brand,
                    });
                }
                return;
            }

            // ── HIERARCHICAL (LEGACY) FORMAT ──────────────────────────────
            const col1 = String(row.getCell(1).value ?? '').trim();
            const l1   = col1;
            const l2   = String(row.getCell(2).value ?? '').trim();
            const l3   = String(row.getCell(3).value ?? '').trim();
            const l4   = String(row.getCell(4).value ?? '').trim();
            const srp  = String(row.getCell(6).value ?? '').trim();
            const wsp  = String(row.getCell(7).value ?? '').trim();
            const unit = String(row.getCell(8).value ?? '').trim();

            if (col1.toUpperCase().includes('PRICE LIST') || col1.toUpperCase().includes('EMC')) return;
            if (l1) { currentMaster = l1.toUpperCase(); currentCategory = ''; currentSubCategory = ''; }
            if (l2) { currentCategory = l2; currentSubCategory = ''; }
            if (l3) { currentSubCategory = l3; }

            if (!l1 && !l2 && !l3 && !l4 && !srp && !wsp) return;

            const mGroup  = categorizeLegacy(currentMaster);
            const cGroup  = currentCategory || 'GENERAL';
            const sGroup  = currentSubCategory || 'GENERAL';
            const variant = l4 || 'GENERAL';

            const parts = [mGroup, cGroup, sGroup, variant]
                .filter(p => p && p.toUpperCase() !== 'GENERAL' && p.toUpperCase() !== 'UNCATEGORIZED')
                .map(p => p.trim());

            const product = parts[parts.length - 1];
            const uniqueParts: string[] = [];
            parts.forEach((p, idx) => {
                const isRedundant = idx < parts.length - 1 && p.toUpperCase() === product.toUpperCase();
                if (!isRedundant) uniqueParts.push(p);
            });

            const fullName = uniqueParts.join(' > ').toUpperCase();

            let buying  = decodeCipher(srp);
            let selling = decodeCipher(wsp);
            [buying, selling] = fixSwappedPrices(buying, selling);

            if (productsMap.has(fullName)) return;
            productsMap.set(fullName, {
                name:            fullName,
                sku:             fullName,
                stock_available: 100,
                stock_reserved:  0,
                stock_damaged:   0,
                selling_price:   selling,
                buying_price:    buying,
                unit:            unit || 'pc',
            });
        });
    });

    return Array.from(productsMap.values());
};

export const mapRawToProduct = (raw: unknown) => raw;
