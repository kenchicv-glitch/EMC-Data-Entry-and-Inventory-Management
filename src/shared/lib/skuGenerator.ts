/**
 * SKU Generator — Human-Readable Code Format
 * 
 * Format: {MASTER}-{SUBCAT}-{BRAND}-{SIZE}-{SEQ}
 * Example: ELEC-WIRE-ROYU-10G-001
 * 
 * All codes are UPPERCASE, hyphen-delimited.
 */

// ── MASTER CATEGORY ABBREVIATIONS ──────────────────────────────────────────

export const MASTER_CODES: Record<string, string> = {
    'STEEL':                   'STL',
    'ELECTRICALS':             'ELEC',
    'PLYWOOD':                 'PLY',
    'ROOFING':                 'ROOF',
    'LUMBER':                  'LBR',
    'PIPES AND FITTINGS':      'PIPE',
    'HARDWARE AND FASTENERS':  'HW',
    'CEMENT AND AGGREGATES':   'CMT',
    'DOORS AND FIXTURES':      'DOOR',
    'PAINTS AND FINISHES':     'PNT',
    'BOYSEN':                  'BYSN',
    'UNCATEGORIZED':           'MISC',
};

// ── COMMON BRAND ABBREVIATIONS ─────────────────────────────────────────────

export const BRAND_CODES: Record<string, string> = {
    'ROYU':           'ROYU',
    'POWERFLEX':      'PFLX',
    'PHELPS DODGE':   'PHLDG',
    'BOYSEN':         'BYSN',
    'NELTEX':         'NLTX',
    'HOLCIM':         'HOLC',
    'MASTER STEEL':   'MSTL',
    'ATLANTA':        'ATLA',
    'EAGLE':          'EAGL',
    'PHILFLEX':       'PFLX',
    'PDX':            'PDX',
    'AMERICAN WIRE':  'AMWI',
    'GRAND':          'GRND',
    'DAVIES':         'DAVS',
    'RAIN OR SHINE':  'ROS',
    'ISLAND':         'ISLA',
    'PACIFIC':        'PACF',
    'REPUBLIC':       'RPLC',
};

// ── SUB-CATEGORY ABBREVIATIONS ─────────────────────────────────────────────

export const SUBCAT_CODES: Record<string, string> = {
    'ELECTRICAL WIRE':     'WIRE',
    'STEEL MATTING':       'MAT',
    'ANGLE BAR':           'ANG',
    'FLAT BAR':            'FLAT',
    'ROUND BAR':           'RBAR',
    'C-PURLINS':           'CPRL',
    'GI PIPE':             'GPIP',
    'PVC PIPE':            'PPIP',
    'PVC FITTINGS':        'PVFT',
    'GI FITTINGS':         'GIFT',
    'FLEXBOARD':           'FLEX',
    'ORDINARY PLYWOOD':    'OPLY',
    'MARINE PLYWOOD':      'MPLY',
    'ENAMEL':              'ENML',
    'LATEX':               'LATX',
    'ACRY-COLOR':          'ACRY',
    'FLAT WALL':           'FLTW',
    'SEMI-GLOSS':          'SMGL',
    'TUBULAR':             'TUBR',
    'GI SHEET':            'GSHT',
    'CORRUGATED':          'CORR',
    'YERO':                'YERO',
    'NAILS':               'NAIL',
    'SCREWS':              'SCRW',
    'BOLTS':               'BOLT',
    'CEMENT':              'CMNT',
    'CONDUIT':             'COND',
    'BREAKER':             'BRKR',
    'SWITCH':              'SWCH',
    'OUTLET':              'OTLT',
};

// ── VARIANT TYPES (auto-detected from product names) ───────────────────────

const VARIANT_KEYWORDS: Record<string, string> = {
    'MAKAPAL':    'MAKAPAL',
    'MANIPIS':    'MANIPIS',
    'THICK':      'THICK',
    'THIN':       'THIN',
    'FLAT WALL':  'FLAT WALL',
    'SEMI-GLOSS': 'SEMI-GLOSS',
    'GLOSS':      'GLOSS',
    'MATTE':      'MATTE',
    'GREEN':      'GREEN',
    'BLUE':       'BLUE',
    'RED':        'RED',
    'WHITE':      'WHITE',
    'BLACK':      'BLACK',
    'PRESSURE':   'PRESSURE',
    'SANITARY':   'SANITARY',
    'DRAINAGE':   'DRAINAGE',
};

// ── SIZE / GAUGE EXTRACTION ────────────────────────────────────────────────

/**
 * Extracts size/gauge/dimension information from a product name.
 * Returns the extracted size string or null.
 * 
 * Patterns detected:
 * - Gauge: #10, #6, #12          → "10G", "6G", "12G"
 * - Metric: (5.5MM), 3.5MM       → "5.5MM", "3.5MM"
 * - Fractions: 1/4, 3/4, 1/2     → "1/4", "3/4", "1/2"
 * - Dimensions: 1/4 X 1, 2 X 2   → "1/4X1", "2X2"
 * - Length: 150M, 75M             → "150M", "75M"  
 * - Volume: .25L, 1L, 4L, 16L    → "0.25L", "1L", "4L"
 * - Weight: 10.5KG, 40KG         → "10.5KG", "40KG"
 * - Inches: 1/2 INCH, 3/4"       → "1/2IN", "3/4IN"
 */
export function extractSize(name: string): string | null {
    const up = name.toUpperCase().trim();
    const parts: string[] = [];

    // Gauge: #10, #6, #12, #8
    const gaugeMatch = up.match(/#(\d+)\b/);
    if (gaugeMatch) parts.push(`${gaugeMatch[1]}G`);

    // Metric diameter: (5.5MM) or standalone 5.5MM / 3.5MM
    const mmMatch = up.match(/\(?(\d+\.?\d*)\s*MM\)?/);
    if (mmMatch && !parts.some(p => p.endsWith('G') && p.replace('G','') === mmMatch[1])) {
        // Don't duplicate if gauge already captured the same number
    }

    // Dimensions: 1/4 X 1, 2 X 2, 1/4 X 1-1/2
    const dimMatch = up.match(/(\d+(?:\/\d+)?(?:\.\d+)?)\s*[Xx×]\s*(\d+(?:\/\d+)?(?:\.\d+)?(?:\s*-\s*\d+\/\d+)?)/);
    if (dimMatch) {
        const clean = `${dimMatch[1]}X${dimMatch[2].replace(/\s/g,'')}`;
        parts.push(clean);
    }

    // Fractions standalone (only if no dimension found): 1/4, 3/4, 1/2
    if (!dimMatch) {
        const fracMatch = up.match(/\b(\d+\/\d+)\b/);
        if (fracMatch) parts.push(fracMatch[1]);
    }

    // Length: 150M, 75M (but NOT MM)
    const lenMatch = up.match(/\b(\d+)\s*M\b(?!M)/);
    if (lenMatch) parts.push(`${lenMatch[1]}M`);

    // Volume: .25L, 0.25L, 1L, 4L, 16L
    const volMatch = up.match(/\.?(\d*\.?\d+)\s*L\b/);
    if (volMatch) {
        const vol = volMatch[0].startsWith('.') ? `0${volMatch[0].trim()}` : volMatch[0].trim();
        parts.push(vol.toUpperCase());
    }

    // Weight: 10.5KG, 40KG
    const wtMatch = up.match(/(\d+\.?\d*)\s*KG\b/);
    if (wtMatch) parts.push(`${wtMatch[1]}KG`);

    // Inches: 1/2 INCH, 3/4", 1/2"
    const inchMatch = up.match(/(\d+(?:\/\d+)?)\s*(?:INCH|")/);
    if (inchMatch && !parts.some(p => p.includes(inchMatch[1]))) {
        parts.push(`${inchMatch[1]}IN`);
    }

    return parts.length > 0 ? parts.join('-') : null;
}

/**
 * Detects variant/type keywords from a product name.
 */
export function extractVariantType(name: string): string | null {
    const up = name.toUpperCase();
    for (const [keyword, variant] of Object.entries(VARIANT_KEYWORDS)) {
        if (up.includes(keyword)) return variant;
    }
    return null;
}

// ── ABBREVIATION HELPERS ───────────────────────────────────────────────────

/**
 * Abbreviates a string to maxLen chars using the registry first,
 * then falling back to consonant-stripping.
 */
export function abbreviate(str: string, maxLen: number = 4): string {
    if (!str) return '';
    const up = str.toUpperCase().trim();
    if (up.length <= maxLen) return up;

    // Strip vowels (keep first char), remove spaces
    const noSpaces = up.replace(/\s+/g, '');
    const first = noSpaces[0];
    const rest = noSpaces.slice(1).replace(/[AEIOU]/g, '');
    const result = (first + rest).slice(0, maxLen);
    return result;
}

/**
 * Looks up a master category code from the registry.
 */
export function getMasterCode(master: string): string {
    const up = master.toUpperCase().trim();
    return MASTER_CODES[up] || abbreviate(up, 4);
}

/**
 * Looks up a sub-category code from the registry.
 */
export function getSubcatCode(subcat: string): string {
    const up = subcat.toUpperCase().trim();
    if (!up || up === 'GENERAL' || up === 'UNCATEGORIZED') return '';
    return SUBCAT_CODES[up] || abbreviate(up, 4);
}

/**
 * Looks up a brand code from the registry.
 */
export function getBrandCode(brand: string): string {
    const up = brand.toUpperCase().trim();
    if (!up) return '';
    return BRAND_CODES[up] || abbreviate(up, 4);
}

// ── MAIN SKU GENERATOR ─────────────────────────────────────────────────────

export interface SkuGeneratorParams {
    masterCategory: string;      // e.g., "ELECTRICALS"
    subCategory?: string;        // e.g., "ELECTRICAL WIRE"
    brand?: string;              // e.g., "ROYU"
    size?: string;               // already extracted, e.g., "10G"
    sequenceNumber: number;      // e.g., 1 → 001
}

/**
 * Generates a human-readable SKU code.
 * 
 * Format: {MASTER}-{SUBCAT}-{BRAND}-{SIZE}-{SEQ}
 * Empty segments are omitted.
 * 
 * Examples:
 *   ELEC-WIRE-ROYU-10G-001
 *   STL-ANG-MSTL-1/4X1-001
 *   PNT-ACRY-BYSN-1L-001
 */
export function generateSku(params: SkuGeneratorParams): string {
    const parts: string[] = [];

    parts.push(getMasterCode(params.masterCategory));

    const subCode = params.subCategory ? getSubcatCode(params.subCategory) : '';
    if (subCode) parts.push(subCode);

    const brandCode = params.brand ? getBrandCode(params.brand) : '';
    if (brandCode) parts.push(brandCode);

    if (params.size) parts.push(params.size);

    const seq = String(params.sequenceNumber).padStart(3, '0');
    parts.push(seq);

    return parts.join('-');
}

// ── BATCH GENERATOR (for migration) ────────────────────────────────────────

export interface ProductForSku {
    id: string;
    name: string;
    sku: string | null;
    brand: string | null;
    category_name?: string;      // resolved category name
    master_name?: string;        // resolved master category name
    subcat_name?: string;        // resolved sub-category name
}

export interface SkuMigrationResult {
    id: string;
    oldSku: string | null;
    newSku: string;
    extractedSize: string | null;
    extractedVariant: string | null;
}

/**
 * Generates new SKUs for a batch of products.
 * Groups by prefix to assign sequential numbers.
 */
export function generateSkuBatch(products: ProductForSku[]): SkuMigrationResult[] {
    // Track sequence counters per prefix
    const prefixCounters = new Map<string, number>();
    const results: SkuMigrationResult[] = [];

    for (const p of products) {
        const master = p.master_name || 'UNCATEGORIZED';
        const subcat = p.subcat_name || '';
        const brand = p.brand || '';
        const size = extractSize(p.name);
        const variant = extractVariantType(p.name);

        // Build prefix (everything before sequence number) for grouping
        const prefixParts: string[] = [getMasterCode(master)];
        const sc = getSubcatCode(subcat);
        if (sc) prefixParts.push(sc);
        const bc = getBrandCode(brand);
        if (bc) prefixParts.push(bc);
        if (size) prefixParts.push(size);
        const prefix = prefixParts.join('-');

        // Increment sequence
        const count = (prefixCounters.get(prefix) || 0) + 1;
        prefixCounters.set(prefix, count);

        const newSku = `${prefix}-${String(count).padStart(3, '0')}`;

        results.push({
            id: p.id,
            oldSku: p.sku,
            newSku,
            extractedSize: size,
            extractedVariant: variant,
        });
    }

    return results;
}

/**
 * For a single new product: determine the next sequence number by
 * counting existing SKUs with the same prefix.
 */
export function getNextSequence(existingSkus: string[], prefix: string): number {
    let max = 0;
    const prefixDash = prefix + '-';
    for (const sku of existingSkus) {
        if (sku.startsWith(prefixDash)) {
            const seqPart = sku.slice(prefixDash.length);
            const num = parseInt(seqPart, 10);
            if (!isNaN(num) && num > max) max = num;
        }
    }
    return max + 1;
}

/**
 * Builds the SKU prefix (without sequence) for a product.
 * Used to find the next available sequence number.
 */
export function buildSkuPrefix(
    masterCategory: string,
    subCategory?: string,
    brand?: string,
    productName?: string,
): string {
    const parts: string[] = [getMasterCode(masterCategory)];
    const sc = subCategory ? getSubcatCode(subCategory) : '';
    if (sc) parts.push(sc);
    const bc = brand ? getBrandCode(brand) : '';
    if (bc) parts.push(bc);
    const size = productName ? extractSize(productName) : null;
    if (size) parts.push(size);
    return parts.join('-');
}
