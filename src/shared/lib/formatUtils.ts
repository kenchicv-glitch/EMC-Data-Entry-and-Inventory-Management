import { format as dfFormat } from 'date-fns';

/**
 * Formats a number as Philippine Peso (₱).
 * @param amount The numeric amount to format.
 * @returns A formatted string e.g., "₱1,234.56"
 */
export const formatCurrency = (amount: number | string | null | undefined): string => {
    const value = typeof amount === 'string' ? parseFloat(amount) : (amount ?? 0);
    if (isNaN(value)) return '₱0.00';
    return `₱${value.toLocaleString('en-PH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
};

/**
 * Formats a date string or Date object using date-fns.
 * @param date The date to format.
 * @param pattern The pattern to use (default: 'MMM d, yyyy').
 * @returns A formatted date string.
 */
export const formatDate = (date: string | Date | null | undefined, pattern: string = 'MMM d, yyyy'): string => {
    if (!date) return '-';
    try {
        const d = typeof date === 'string' ? new Date(date) : date;
        return dfFormat(d, pattern);
    } catch (e) {
        return '-';
    }
};

/**
 * Formats a number with thousands separators.
 * @param num The number to format.
 * @returns A formatted string e.g., "1,234"
 */
export const formatNumber = (num: number | string | null | undefined): string => {
    const value = typeof num === 'string' ? parseFloat(num) : (num ?? 0);
    if (isNaN(value)) return '0';
    return value.toLocaleString('en-PH');
};
