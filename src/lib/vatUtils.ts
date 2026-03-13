/**
 * BIR Tax-Ready Utility for EMC Retail OS
 * Centralized VAT and Discount computations (Form 2550M/Q, 1701Q/1702Q compliant)
 */

export type VatClassification = 'vatable' | 'exempt' | 'zero_rated';

interface VatSummary {
    netAmount: number;
    vatAmount: number;
    grossAmount: number;
}

/**
 * Rounds to 2 decimal places using numeric-safe approach
 */
export const roundTo2 = (value: number): number => {
    return Math.round((value + Number.EPSILON) * 100) / 100;
};

/**
 * Computes Output VAT for a gross amount
 */
export const computeOutputVat = (grossAmount: number, classification: VatClassification): VatSummary => {
    if (classification === 'exempt' || classification === 'zero_rated') {
        return {
            netAmount: roundTo2(grossAmount),
            vatAmount: 0,
            grossAmount: roundTo2(grossAmount)
        };
    }

    // Standard 12% VAT
    const netAmount = roundTo2(grossAmount / 1.12);
    const vatAmount = roundTo2(grossAmount - netAmount);

    return {
        netAmount,
        vatAmount,
        grossAmount: roundTo2(grossAmount)
    };
};

/**
 * Computes Input VAT from purchases
 */
export const computeInputVat = (grossAmount: number, isVatRegistered: boolean): number => {
    if (!isVatRegistered) return 0;
    const netAmount = roundTo2(grossAmount / 1.12);
    return roundTo2(grossAmount - netAmount);
};

/**
 * Computes Senior/PWD Discount and VAT exemption
 * Legal requirement: 20% discount on the net-of-vat value
 */
export const computeSeniorPwdDiscount = (grossAmount: number): {
    discountAmount: number;
    netAmount: number;
    vatAmount: 0;
    finalGross: number;
} => {
    // 1. Strip the 12% VAT first (Senior/PWD are VAT exempt)
    const originalNetOfVat = roundTo2(grossAmount / 1.12);

    // 2. Apply 20% discount on that net amount
    const discountAmount = roundTo2(originalNetOfVat * 0.20);

    // 3. Final amount to pay
    const finalGross = roundTo2(originalNetOfVat - discountAmount);

    return {
        discountAmount,
        netAmount: finalGross,
        vatAmount: 0,
        finalGross
    };
};

/**
 * Computes VAT Payable (Output VAT - Input VAT)
 */
export const computeVatPayable = (outputVat: number, inputVat: number): {
    vatDue: number;
    excessInput: number;
} => {
    const diff = roundTo2(outputVat - inputVat);
    return {
        vatDue: diff > 0 ? diff : 0,
        excessInput: diff < 0 ? Math.abs(diff) : 0
    };
};
