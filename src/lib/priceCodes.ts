const MAP: Record<string, string> = {
    'Q': '1', 'U': '2', 'I': '3', 'C': '4', 'K': '5',
    'E': '6', 'P': '7', 'O': '8', 'X': '9', 'Y': '0'
};

const REVERSE_MAP: Record<string, string> = Object.entries(MAP).reduce((acc, [char, num]) => {
    acc[num] = char;
    return acc;
}, {} as Record<string, string>);

/**
 * QUICK EPOXY Code System
 * Letters map to digits: Q=1 U=2 I=3 C=4 K=5 E=6 P=7 O=8 X=9 Y=0
 * S = repeat the previous digit (shorthand for doubled digits)
 *
 * Encoding examples:
 *   150   -> QKY
 *   177   -> QPS    (P=7, S=repeat 7)
 *   188   -> QOS    (O=8, S=repeat 8)
 *   199   -> QXS    (X=9, S=repeat 9)
 *   1550  -> QKKY   (no S needed since K and K are adjacent but we use S only for encoding)
 *   150.50 -> QKY.KY
 *
 * Encoding uses S when consecutive identical digits appear.
 */
export const encodePrice = (price: number | string | null | undefined): string => {
    if (price === null || price === undefined || price === '') return '';
    const numStr = String(price);
    const result: string[] = [];
    let lastDigit = '';

    for (const char of numStr) {
        if (REVERSE_MAP[char]) {
            if (char === lastDigit) {
                // Same digit as previous — use S shorthand
                result.push('S');
            } else {
                result.push(REVERSE_MAP[char]);
                lastDigit = char;
            }
        } else if (char === '.') {
            result.push('.');
            lastDigit = ''; // Reset after decimal point
        } else {
            result.push(char);
            lastDigit = '';
        }
    }

    return result.join('');
};

/**
 * Decodes a QUICK EPOXY code into a numeric price
 * S = repeat the digit that the previous letter represents
 *
 * Decoding examples:
 *   QKY  -> 150
 *   QPS  -> 177   (P=7, S=repeat 7)
 *   QOS  -> 188   (O=8, S=repeat 8)
 *   QXS  -> 199   (X=9, S=repeat 9)
 */
export const decodePrice = (code: string | null | undefined): number => {
    if (!code) return 0;
    const chars = String(code).toUpperCase().split('');
    const decoded: string[] = [];
    let lastDecodedDigit = '';

    for (const char of chars) {
        if (char === 'S') {
            // Repeat the last decoded digit
            if (lastDecodedDigit) {
                decoded.push(lastDecodedDigit);
            }
            // lastDecodedDigit stays the same for potential chaining (e.g. PSS = 777)
        } else if (MAP[char]) {
            const digit = MAP[char];
            decoded.push(digit);
            lastDecodedDigit = digit;
        } else if (char === '.') {
            decoded.push('.');
            // Don't reset lastDecodedDigit — S after decimal should still work
        } else if (/[0-9]/.test(char)) {
            decoded.push(char);
            lastDecodedDigit = char;
        }
        // Skip any other characters
    }

    const val = parseFloat(decoded.join(''));
    return isNaN(val) ? 0 : val;
};

/**
 * Checks if a string looks like a QUICK EPOXY code
 * Valid characters: Q U I C K E P O X Y S and dots/spaces/digits
 */
export const isEncoded = (str: string | null | undefined): boolean => {
    if (!str) return false;
    const cleaned = String(str).toUpperCase().replace(/[.\s0-9]/g, '');
    if (cleaned.length === 0) return false;
    return cleaned.split('').every(char => !!MAP[char] || char === 'S');
};
