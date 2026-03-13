/**
 * Checks if a target string contains all search terms in any order.
 * This enables "smart" search behavior where typing "angle green"
 * matches "Angle Bar Green".
 * 
 * @param target The string to search within (e.g. product name)
 * @param query The search query string
 * @returns boolean indicating if all terms are present
 */
export const isSmartMatch = (target: string, query: string): boolean => {
    if (!query) return true;
    
    // Split query by spaces and filter out empty strings
    const terms = query.toLowerCase().split(/\s+/).filter(t => t.trim().length > 0);
    if (terms.length === 0) return true;
    
    const normalizedTarget = target.toLowerCase();
    
    // All terms must be present in the target string
    return terms.every(term => normalizedTarget.includes(term));
};
