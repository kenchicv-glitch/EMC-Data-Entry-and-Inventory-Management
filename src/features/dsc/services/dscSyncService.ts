import { supabase } from '../../../shared/lib/supabase';

/**
 * Shortens a full product hierarchy name for DSC display.
 * "PIPES AND FITTINGS > STEEL MATTING > MAKAPAL > #6 MAKAPAL" → "STEEL MATTING #6 MAKAPAL"
 * Takes the 2nd segment (subcategory) and last segment (item), skipping the top-level category.
 */
function shortenProductName(fullName: string, brand?: string): string {
  let name = fullName || 'Unknown Item';
  
  // 1. Split into segments
  const segments = name.split(' > ').map(s => s.trim()).filter(Boolean);
  
  // 2. Extract item (last) and subcategory (second to last)
  const item = segments[segments.length - 1] || 'Unknown Item';
  const sub = segments.length > 1 ? segments[segments.length - 2] : '';
  
  // 3. Combine sub and item
  let combined = sub && !item.toLowerCase().includes(sub.toLowerCase()) 
    ? `${sub} ${item}` 
    : item;

  // 4. Prepend brand if missing
  if (brand && !combined.toLowerCase().includes(brand.toLowerCase())) {
    combined = `${brand} ${combined}`;
  }

  // 5. Final token-based deduplication
  // e.g. "MAKAPAL #6 MAKAPAL" -> "MAKAPAL #6"
  const tokens = combined.split(/\s+/);
  const seen = new Set<string>();
  const uniqueTokens: string[] = [];
  
  for (const token of tokens) {
    const lower = token.toLowerCase();
    // Allow small words like 'and', '#', etc. or unique tokens
    if (!seen.has(lower) || token.length <= 2) {
      uniqueTokens.push(token);
      seen.add(lower);
    }
  }

  return uniqueTokens.join(' ');
}

/**
 * Creates Manila (GMT+8) day boundaries in UTC for query filtering.
 */
function getDayBoundaries(date: string) {
  // Ensure we parse 'YYYY-MM-DD' correctly as local Manila time
  const [y, m, d] = date.split('-').map(Number);
  // Manila 00:00:00 = UTC previous-day 16:00:00
  // Using Date.UTC and subtracting 8 hours is the most stable way to get the true UTC midnight Manila
  const startUtc = new Date(Date.UTC(y, m - 1, d, 0, 0, 0) - 8 * 60 * 60 * 1000);
  const endUtc = new Date(startUtc.getTime() + 24 * 60 * 60 * 1000);
  
  return { 
    start: startUtc.toISOString(), 
    end: endUtc.toISOString() 
  };
}

export const dscSyncService = {
  /**
   * Fetches sales from the system workspace for a specific day and branch,
   * categorized into DSC buckets.
   */
  async fetchSystemSales(date: string, branchId: string | null) {
    const { start, end } = getDayBoundaries(date);

    let query = supabase
      .from('sales')
      .select('id, product_id, quantity, unit_price, total_price, vat_amount, discount_amount, is_os, invoice_type, invoice_number, customer_name, products(name, brand)')
      .gte('date', start)
      .lt('date', end);

    if (branchId) {
      query = query.eq('branch_id', branchId);
    }

    const { data, error } = await query;
    if (error) throw error;

    const sales = (data || []).map(s => {
      const p = Array.isArray(s.products) ? s.products[0] : s.products;
      return {
        ...s,
        description: shortenProductName(p?.name || 'Unknown Item', p?.brand),
      };
    }) as any[];

    // Mutually Exclusive Bucketing
    const invoicesA = sales.filter(s => s.invoice_type === 'A');
    const invoicesB = sales.filter(s => s.invoice_type === 'B');
    const otsItems = sales.filter(s => s.is_os && s.invoice_type !== 'A' && s.invoice_type !== 'B');
    const drItems = sales.filter(s => !s.invoice_type && !s.is_os);

    return {
      invoicesA,
      invoicesB,
      otsItems,
      drItems
    };
  },

  /**
   * Fetches collections (payments) grouped by payment mode for a specific day.
   */
  async fetchSystemCollections(date: string, branchId: string | null) {
    const { start, end } = getDayBoundaries(date);

    let query = supabase
      .from('sales')
      .select('payment_mode, total_price')
      .gte('date', start)
      .lt('date', end);

    if (branchId) {
      query = query.eq('branch_id', branchId);
    }

    const { data, error } = await query;
    if (error) throw error;

    // Group by payment mode
    const groups: Record<string, number> = {};
    (data || []).forEach(s => {
      const mode = s.payment_mode || 'Unknown';
      groups[mode] = (groups[mode] || 0) + Number(s.total_price || 0);
    });

    return Object.entries(groups).map(([mode, amount]) => ({
      payment_mode: mode,
      amount
    }));
  },

  /**
   * Fetches non-cancelled refunds for itemized returns display.
   */
  async fetchSystemRefunds(date: string, branchId: string | null) {
    const { start, end } = getDayBoundaries(date);

    let query = supabase
      .from('customer_refunds')
      .select('id, product_id, quantity, unit_price, total_price, reason, invoice_number, products(name, brand)')
      .gte('date', start)
      .lt('date', end);

    if (branchId) {
      query = query.eq('branch_id', branchId);
    }

    const { data, error } = await query;
    if (error) throw error;

    return (data || []).map(r => {
      const p = Array.isArray(r.products) ? r.products[0] : r.products;
      return {
        ...r,
        description: shortenProductName(p?.name || 'Unknown Item', p?.brand),
      };
    });
  },

  /**
   * Fetches expenses and identifies salaries.
   */
  async fetchSystemExpenses(date: string, branchId: string | null) {
    const { start, end } = getDayBoundaries(date);

    let query = supabase
      .from('expenses')
      .select('id, category, description, amount')
      .gte('date', start)
      .lt('date', end);

    if (branchId) {
      query = query.eq('branch_id', branchId);
    }

    const { data, error } = await query;
    if (error) throw error;

    return (data || []).map(e => ({
      ...e,
      is_salary: e.category?.toLowerCase().includes('salary') || e.category?.toLowerCase().includes('labor')
    }));
  },

  /**
   * Fetches purchases from the system workspace for a specific day and branch.
   */
  async fetchSystemPurchases(date: string, branchId: string | null) {
    const { start, end } = getDayBoundaries(date);

    // Use a more relaxed filter for purchases to ensure we don't miss items
    // Checks both 'date' and 'received_date'
    let query = supabase
      .from('purchases')
      .select('id, product_id, quantity, unit_price, total_price, supplier, invoice_number, products(name, brand)')
      .or(`and(date.gte.${start},date.lt.${end}),and(received_date.gte.${start},received_date.lt.${end})`);

    if (branchId) {
      // Also allow null branch_id to catch global/unassigned purchases
      query = query.or(`branch_id.eq.${branchId},branch_id.is.null`);
    }

    const { data, error } = await query;
    if (error) throw error;

    const rawData = data || [];
    // Deduplicate by ID in case .or matches same row twice (though SQL shouldn't, extra safety)
    const uniqueMap = new Map();
    rawData.forEach(p => uniqueMap.set(p.id, p));
    const uniqueData = Array.from(uniqueMap.values());

    return uniqueData.map(p => {
      const prod = Array.isArray(p.products) ? p.products[0] : p.products;
      return {
        ...p,
        description: shortenProductName(prod?.name || 'Unknown Item', prod?.brand),
      };
    });
  },

  /**
   * Fetches products for autocomplete.
   */
  async searchProducts(term: string, branchId: string | null) {
    if (!term || term.length < 2) return [];
    
    let query = supabase
      .from('products')
      .select('id, name, selling_price')
      .ilike('name', `%${term}%`)
      .limit(10);

    if (branchId) {
      query = query.eq('branch_id', branchId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  /**
   * Fetches suppliers for autocomplete.
   */
  async searchSuppliers(term: string) {
    if (!term || term.length < 2) return [];
    
    const { data, error } = await supabase
      .from('suppliers')
      .select('id, name')
      .ilike('name', `%${term}%`)
      .limit(10);

    if (error) throw error;
    return data || [];
  }
};
