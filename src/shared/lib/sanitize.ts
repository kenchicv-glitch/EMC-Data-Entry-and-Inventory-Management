export function sanitizeString(val: string | null | undefined): string {
    if (!val) return '';
    // Strip HTML tags
    const clean = val.replace(/<[^>]*>?/gm, '');
    // Basic SQL escaping (though backend should handle this, frontend layer is extra)
    // We avoid stripping ' or - entirely but we can trim and prevent some patterns
    return clean.trim();
}

/**
 * Sanitizes an object by applying sanitizeString to all string properties.
 */
export function sanitizeObject<T extends object>(obj: T): T {
    const result = { ...obj } as any;
    for (const key in result) {
        if (typeof result[key] === 'string') {
            result[key] = sanitizeString(result[key]);
        }
    }
    return result;
}
