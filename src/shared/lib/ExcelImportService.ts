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
    sku: string;
}


const categorizeProduct = (l1: string): string => {
    // Strictly follow L1 from Excel as the Master Category
    if (!l1) return 'UNCATEGORIZED';
    
    // Clean up: Remove any prefixes like "▸" and trim
    return l1.replace(/[▸\s]/g, '').trim().toUpperCase();
};

const decodeCipher = (text: string): number => {
    if (!text) return 0;
    const upper = text.toUpperCase().trim();
    
    // If it's already a number or contains numeric digits, return parseFloat
    if (/[0-9]/.test(upper)) {
        return parseFloat(upper.replace(/[^0-9.]/g, '')) || 0;
    }

    // QUICK EPOXY (1 to 0) + S (repeat)
    const map: Record<string, string> = {
        'Q': '1', 'U': '2', 'I': '3', 'C': '4', 'K': '5',
        'E': '6', 'P': '7', 'O': '8', 'X': '9', 'Y': '0'
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
        let isFlatFormat = false;
        let colMapping = { name: 1, buying: 7, selling: 6, stock: -1, min: -1, unit: 8, brand: -1 };

        worksheet.eachRow((row, rowIndex) => {
            const rowValues = row.values as any[];
            const col1 = String(row.getCell(1).value || '').trim();

            // Detect Flat Format by checking headers in row 1
            if (rowIndex === 1) {
                const headerText = rowValues.join('|').toUpperCase();
                if (headerText.includes('ITEM NAME')) {
                    isFlatFormat = true;
                    // Find indices based on headers
                    row.eachCell((cell, colIndex) => {
                        const val = String(cell.value || '').toUpperCase();
                        if (val.includes('ITEM NAME')) colMapping.name = colIndex;
                        if (val.includes('BUYING PRICE')) colMapping.buying = colIndex;
                        if (val.includes('SELLING PRICE')) colMapping.selling = colIndex;
                        if (val.includes('CURRENT STOCK')) colMapping.stock = colIndex;
                        if (val.includes('MINIMUM ALERT')) colMapping.min = colIndex;
                        if (val.includes('BRAND')) colMapping.brand = colIndex;
                    });
                    return; // Skip header row
                }
            }

            if (isFlatFormat) {
                const rawName = String(row.getCell(colMapping.name).value || '').trim();
                if (!rawName || rawName.toUpperCase() === 'ITEM NAME') return;

                let buyingPrice = decodeCipher(String(row.getCell(colMapping.buying).value || '0'));
                let sellingPrice = decodeCipher(String(row.getCell(colMapping.selling).value || '0'));
                const stock = colMapping.stock !== -1 ? parseInt(String(row.getCell(colMapping.stock).value || '100')) : 100;
                const brand = colMapping.brand !== -1 ? String(row.getCell(colMapping.brand).value || '').trim() : undefined;

                // Fix swapped prices
                if (buyingPrice > sellingPrice && sellingPrice !== 0) {
                    const temp = buyingPrice;
                    buyingPrice = sellingPrice;
                    sellingPrice = temp;
                }

                // Derive Master Category from name
                const upName = rawName.toUpperCase();
                let master = 'UNCATEGORIZED';
                if (upName.includes('PIPE') || upName.includes('FITTING') || upName.includes('PVC') || upName.includes('ELBOW') || upName.includes('TEE') || upName.includes('SOCKET') || upName.includes('GI') || upName.includes('FLEXIBLE')) master = 'PIPES AND FITTINGS';
                else if (upName.includes('HARDWARE') || upName.includes('FASTENER') || upName.includes('NAIL') || upName.includes('SCREW') || upName.includes('BOLT')) master = 'HARDWARE AND FASTENERS';
                else if (upName.includes('CEMENT') || upName.includes('AGGREGATE') || upName.includes('SAND') || upName.includes('GRAVEL') || upName.includes('CHB')) master = 'CEMENT AND AGGREGATES';
                else if (upName.includes('DOOR') || upName.includes('JAMB') || upName.includes('LOCK') || upName.includes('HINGE')) master = 'DOORS AND FIXTURES';
                else if (upName.includes('PAINT') || upName.includes('LATEX') || upName.includes('ENAMEL') || upName.includes('ROLLER') || upName.includes('BRUSH') || upName.includes('THINNER')) master = 'PAINTS AND FINISHES';
                else if (upName.includes('ELECTRICAL') || upName.includes('WIRE') || upName.includes('CABLE') || upName.includes('BREAKER') || upName.includes('SWITCH') || upName.includes('OUTLET') || upName.includes('LIGHT') || upName.includes('CONDUIT')) master = 'ELECTRICALS';
                else if (upName.includes('STEEL') || upName.includes('RSB') || upName.includes('BAR') || upName.includes('WIRE MESH')) master = 'STEEL';
                else if (upName.includes('PLYWOOD') || upName.includes('FLEXBOARD') || upName.includes('GYPSUM')) master = 'PLYWOOD';
                else if (upName.includes('ROOFING') || upName.includes('GUTTER') || upName.includes('PURLIN') || upName.includes('GI SHEET')) master = 'ROOFING';
                else if (upName.includes('LUMBER') || upName.includes('WOOD') || upName.includes('PLANK')) master = 'LUMBER';

                const fullName = `${master} > ${rawName}`.toUpperCase();

                if (!productsMap.has(fullName)) {
                    productsMap.set(fullName, {
                        name: fullName,
                        stock_available: stock,
                        stock_reserved: 0,
                        stock_damaged: 0,
                        selling_price: sellingPrice,
                        buying_price: buyingPrice,
                        unit: 'pc',
                        brand: brand,
                        sku: fullName || crypto.randomUUID()
                    });
                }
                return;
            }

            // Hierarchical Parser (Original)
            const rawCol1 = col1;
            if (rawCol1.toUpperCase().includes('PRICE LIST') || rawCol1.toUpperCase().includes('EMC')) return;
            if (rowIndex === 1 && (rawCol1.toUpperCase().includes('MASTER') || rawCol1.toUpperCase().includes('L1'))) return;

            const l1 = col1;
            const l2 = String(row.getCell(2).value || '').trim();
            const l3 = String(row.getCell(3).value || '').trim();
            const l4 = String(row.getCell(4).value || '').trim();
            const srp = String(row.getCell(6).value || '').trim();
            const wspDecoded = String(row.getCell(7).value || '').trim();
            const unit = String(row.getCell(8).value || '').trim();

            if (l1) { currentMaster = l1.toUpperCase(); currentCategory = ''; currentSubCategory = ''; }
            if (l2) { currentCategory = l2; currentSubCategory = ''; }
            if (l3) { currentSubCategory = l3; }

            // Skip only if row is completely empty or just header
            if (!l1 && !l2 && !l3 && !l4 && !srp && !wspDecoded) return;

            // ENFORCE MASTER CATEGORIES
            const mGroup = categorizeProduct(currentMaster);
            const cGroup = currentCategory || 'GENERAL';
            const sGroup = currentSubCategory || 'GENERAL';
            const variantName = l4 || 'GENERAL';

            // Improved Name Construction with Redundancy Removal
            const parts = [mGroup, cGroup, sGroup, variantName]
                .filter(p => p && p.toUpperCase() !== 'GENERAL' && p.toUpperCase() !== 'UNCATEGORIZED')
                .map(p => p.trim());
            
            // If the last part (product) matches any preceding part, remove the preceding part
            const product = parts[parts.length - 1];
            const uniqueParts: string[] = [];
            parts.forEach((p, idx) => {
                const isRedundant = idx < parts.length - 1 && p.toUpperCase() === product.toUpperCase();
                if (!isRedundant) uniqueParts.push(p);
            });

            const fullName = uniqueParts.join(' > ').toUpperCase();

            let sellingPrice = decodeCipher(srp);
            let buyingPrice = decodeCipher(wspDecoded);

            // Fix swapped prices
            if (buyingPrice > sellingPrice && sellingPrice !== 0) {
                const temp = buyingPrice;
                buyingPrice = sellingPrice;
                sellingPrice = temp;
            }

            if (productsMap.has(fullName)) return;

            productsMap.set(fullName, {
                name: fullName,
                stock_available: 100,
                stock_reserved: 0,
                stock_damaged: 0,
                selling_price: sellingPrice,
                buying_price: buyingPrice,
                unit: unit || 'pc',
                sku: fullName || crypto.randomUUID()
            });
        });
    });

    return Array.from(productsMap.values());
};

export const mapRawToProduct = (raw: unknown) => raw;
