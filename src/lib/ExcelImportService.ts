import * as XLSX from 'xlsx';
import { decodePrice, isEncoded } from './priceCodes';

export interface RawProductData {
    name: string;
    stock_available: number;
    stock_reserved: number;
    stock_damaged: number;
    buying_price?: number;
    selling_price?: number;
}

export const parseExcelFile = async (file: File): Promise<RawProductData[]> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const data = e.target?.result;
                const workbook = XLSX.read(data, { type: 'binary' });
                const productsMap = new Map<string, RawProductData>();

                workbook.SheetNames.forEach(sheetName => {
                    const worksheet = workbook.Sheets[sheetName];

                    // Read as 2D array to handle complex layouts
                    const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as unknown[][];

                    let l1 = sheetName.toUpperCase();
                    let currentGroupLeft = 'GENERAL';
                    let currentCatLeft = 'GENERAL';
                    let currentGroupRight = 'GENERAL';
                    let currentCatRight = 'GENERAL';

                    // Heuristic: Iterate through rows and maintain category state for two column groups
                    rows.forEach((row, rowIndex) => {
                        if (!row || row.length === 0) return;

                        // Group 1: Columns A, B, C (0, 1, 2)
                        const colA = String(row[0] || '').trim();
                        const colB = String(row[1] || '').trim();
                        const colC = String(row[2] || '').trim();

                        // Group 2: Columns D, E, F (3, 4, 5)
                        const colD = String(row[3] || '').trim();
                        const colE = String(row[4] || '').trim();
                        const colF = String(row[5] || '').trim();

                        // Detect L1 from Row 1 Title (e.g. "STEEL PRICE LIST" or "ELECTRICALS")
                        // Usually Row 1 has the big title
                        if (rowIndex === 0 && colA && !colB && !colC) {
                            l1 = colA.replace(/PRICE LIST/gi, '').trim().toUpperCase();
                            if (!l1) l1 = sheetName.toUpperCase();
                            return;
                        }

                        // Header Detection: Left
                        // If B contains "WSP" or "SRP", the row describes headers. Col A might be the category name.
                        const isWspHeaderLeft = colB.toUpperCase() === 'WSP' || colC.toUpperCase() === 'SRP';
                        // If B and C are empty and A has text, it's a standalone group header
                        const isStandaloneLeft = colA && !colB && !colC && !colA.toUpperCase().includes('TOTAL');

                        if (isWspHeaderLeft) {
                            const upperA = colA.toUpperCase();
                            // Common generic labels to ignore as category titles
                            const genericLabels = ['ITEM', 'DESCRIPTION', 'PER BOX', 'PER MTR', 'AMP', 'GE', 'ROYU', 'BRANCHES', 'TYPES'];
                            if (colA && !genericLabels.includes(upperA)) {
                                currentGroupLeft = colA;
                                currentCatLeft = 'GENERAL';
                            } else if (colA) {
                                currentCatLeft = colA;
                            }
                            return; // Skip the header row itself
                        }
                        if (isStandaloneLeft) {
                            currentGroupLeft = colA;
                            currentCatLeft = 'GENERAL';
                            return;
                        }

                        // Header Detection: Right
                        const isWspHeaderRight = colE.toUpperCase() === 'WSP' || colF.toUpperCase() === 'SRP';
                        const isStandaloneRight = colD && !colE && !colF && !colD.toUpperCase().includes('TOTAL');

                        if (isWspHeaderRight) {
                            const upperD = colD.toUpperCase();
                            const genericLabels = ['ITEM', 'DESCRIPTION', 'PER BOX', 'PER MTR', 'AMP', 'GE', 'ROYU', 'BRANCHES', 'TYPES'];
                            if (colD && !genericLabels.includes(upperD)) {
                                currentGroupRight = colD;
                                currentCatRight = 'GENERAL';
                            } else if (colD) {
                                currentCatRight = colD;
                            }
                            return; // Skip the header row itself
                        }
                        if (isStandaloneRight) {
                            currentGroupRight = colD;
                            currentCatRight = 'GENERAL';
                            return;
                        }

                        // Process Data Row: Left (A=Name, B=WSP, C=SRP)
                        if (colA && (colB || colC) && colB.toUpperCase() !== 'WSP' && !colA.toUpperCase().includes('TOTAL')) {
                            // Construct Name: L1 > Group > Cat > Item
                            const catPart = currentCatLeft === 'GENERAL' ? '' : `${currentCatLeft} > `;
                            const groupPart = currentGroupLeft === 'GENERAL' ? '' : `${currentGroupLeft} > `;
                            const fullName = `${l1} > ${groupPart}${catPart}${colA}`.replace(/\s>\sGENERAL\s>\s/g, ' > ').trim().toUpperCase();

                            // Parse Buying Price (WSP)
                            let buyingPrice: number | undefined;
                            if (colB) {
                                if (isEncoded(colB)) {
                                    buyingPrice = decodePrice(colB);
                                } else {
                                    buyingPrice = parseFloat(colB.replace(/[^0-9.]/g, '')) || 0;
                                }
                            }

                            // Parse Selling Price (SRP)
                            const sellingPrice = colC ? (parseFloat(colC.replace(/[^0-9.]/g, '')) || 0) : 0;

                            productsMap.set(fullName, {
                                name: fullName,
                                stock_available: 0,
                                stock_reserved: 0,
                                stock_damaged: 0,
                                buying_price: buyingPrice,
                                selling_price: sellingPrice
                            });
                        }

                        // Process Data Row: Right (D=Name, E=WSP, F=SRP)
                        if (colD && (colE || colF) && colE.toUpperCase() !== 'WSP' && !colD.toUpperCase().includes('TOTAL')) {
                            const catPart = currentCatRight === 'GENERAL' ? '' : `${currentCatRight} > `;
                            const groupPart = currentGroupRight === 'GENERAL' ? '' : `${currentGroupRight} > `;
                            const fullName = `${l1} > ${groupPart}${catPart}${colD}`.replace(/\s>\sGENERAL\s>\s/g, ' > ').trim().toUpperCase();

                            // Parse Buying Price (WSP)
                            let buyingPrice: number | undefined;
                            if (colE) {
                                if (isEncoded(colE)) {
                                    buyingPrice = decodePrice(colE);
                                } else {
                                    buyingPrice = parseFloat(colE.replace(/[^0-9.]/g, '')) || 0;
                                }
                            }

                            // Parse Selling Price (SRP)
                            const sellingPrice = colF ? (parseFloat(colF.replace(/[^0-9.]/g, '')) || 0) : 0;

                            productsMap.set(fullName, {
                                name: fullName,
                                stock_available: 0,
                                stock_reserved: 0,
                                stock_damaged: 0,
                                buying_price: buyingPrice,
                                selling_price: sellingPrice
                            });
                        }
                    });
                });

                resolve(Array.from(productsMap.values()));
            } catch (err) {
                reject(err);
            }
        };

        reader.onerror = (err) => reject(err);
        reader.readAsBinaryString(file);
    });
};

export const mapRawToProduct = (raw: unknown) => raw;
