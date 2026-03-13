import ExcelJS from 'exceljs';

export interface RawProductData {
    name: string;
    stock_available: number;
    stock_reserved: number;
    stock_damaged: number;
    buying_price?: number;
    selling_price?: number;
    unit?: string;
    brand?: string;
}

const MASTER_CATEGORIES = ['STEEL', 'PLYWOOD', 'ELECTRICALS', 'ROOFING'];

const categorizeProduct = (l1: string, l2: string, l3: string, l4: string): string => {
    const text = `${l1} ${l2} ${l3} ${l4}`.toUpperCase();

    // 1. ELECTRICALS (High specificity)
    if (/(ELECTRICAL|WIRE|THHN|PDX|PHELPS|POWERFLEX|ROYU|FIREFLY|PHILIPS|BREAKER|SWITCH|CONDUIT|PANEL BOX|NEMA|FUSE|LAMP|LIGHT|PDX|STAPLE)/i.test(text)) {
        if (!/(GI WIRE|BARBED|CYCLONE|STEEL MATTING)/i.test(text)) {
            return 'ELECTRICALS';
        }
    }

    // 2. PLYWOOD & BOARDS
    if (/(PLYWOOD|PHENOLIC|SHERA|GYPSUM|COCO|LUMBER|WOOD|MARINE|BOARD|FIBER|ECO 4|ECO4)/i.test(text)) {
        return 'PLYWOOD';
    }

    // 3. ROOFING
    if (/(RIB TYPE|CORRUGATED|LONG SPAN|POLYCARBONATE|FIBER GLASS|FLASHING|GUTTER|RIDGE ROLL|INSULATION|FOAM|PLAIN SHEET|ROOF|STEEL DECK)/i.test(text)) {
        // Steel deck is structural but often grouped with roofing in smaller shops, user put it in ROOF sheet in SOP
        return 'ROOFING';
    }

    // 4. STEEL
    if (/(STEEL|PIPE|BAR|TUBULAR|PURLIN|ANGLE|SQUARE|ROUND|FLAT|GI|CHROME|METAL|FRAME|MATTING|WIRE|WELDING)/i.test(text)) {
        return 'STEEL';
    }

    // Check if L1 already matches
    const cleanL1 = l1.replace(/[▸\s]/g, '').toUpperCase();
    if (MASTER_CATEGORIES.includes(cleanL1)) return cleanL1;

    // Default
    return 'STEEL';
};

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

    workbook.eachSheet((worksheet) => {
        let currentMaster = '';
        let currentCategory = '';
        let currentSubCategory = '';

        worksheet.eachRow((row, rowIndex) => {
            const rawCol1 = String(row.getCell(1).value || '').trim();
            if (rawCol1.toUpperCase().includes('PRICE LIST') || rawCol1.toUpperCase().includes('EMC')) return;
            if (rowIndex === 1 && (rawCol1.toUpperCase().includes('MASTER') || rawCol1.toUpperCase().includes('L1'))) return;

            const l1 = String(row.getCell(1).value || '').trim();
            const l2 = String(row.getCell(2).value || '').trim();
            const l3 = String(row.getCell(3).value || '').trim();
            const l4 = String(row.getCell(4).value || '').trim();
            const wspDecoded = String(row.getCell(6).value || '').trim();
            const srp = String(row.getCell(7).value || '').trim();
            const unit = String(row.getCell(8).value || '').trim();

            if (l1) { currentMaster = l1.toUpperCase(); currentCategory = ''; currentSubCategory = ''; }
            if (l2) { currentCategory = l2; currentSubCategory = ''; }
            if (l3) { currentSubCategory = l3; }

            if (!l4 && !srp) return;

            // ENFORCE 4 MASTER CATEGORIES
            const mGroup = categorizeProduct(currentMaster, currentCategory, currentSubCategory, l4);
            const cGroup = currentCategory || 'GENERAL';
            const sGroup = currentSubCategory || 'GENERAL';

            let variantName = l4 || 'GENERAL';
            const cleanC = cGroup.toUpperCase().trim();
            const cleanS = sGroup.toUpperCase().trim();
            const upperV = variantName.toUpperCase().trim();

            if (upperV.startsWith(cleanS) && cleanS.length > 0) {
                variantName = variantName.substring(cleanS.length).trim();
            } else if (upperV.startsWith(cleanC) && cleanC.length > 0) {
                variantName = variantName.substring(cleanC.length).trim();
            }

            const fullName = `${mGroup} > ${cGroup} > ${sGroup} > ${variantName}`
                .replace(/\s>\sGENERAL\s>\s/g, ' > ')
                .replace(/\s>\sGENERAL$/g, '')
                .trim()
                .toUpperCase();

            const sellingPrice = parseFloat(srp.replace(/[^0-9.]/g, '')) || 0;
            const buyingPrice = parseFloat(wspDecoded.replace(/[^0-9.]/g, '')) || 0;

            // SKIP INVALID PRICES: Missing either or same
            if (sellingPrice === 0 || buyingPrice === 0 || sellingPrice === buyingPrice) return;

            if (productsMap.has(fullName)) return;

            productsMap.set(fullName, {
                name: fullName,
                stock_available: 100,
                stock_reserved: 0,
                stock_damaged: 0,
                selling_price: sellingPrice,
                buying_price: buyingPrice,
                unit: unit || 'pc'
            });
        });
    });

    return Array.from(productsMap.values());
};

export const mapRawToProduct = (raw: unknown) => raw;
