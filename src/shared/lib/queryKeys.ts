/**
 * Centralized Query Keys Factory
 * 
 * Ensures consistent cache management and invalidation across the application.
 * Follows the standard pattern: [domain, type, ...filters/id]
 */
export const queryKeys = {
    auth: {
        session: ['auth', 'session'] as const,
        user: (id?: string) => (id ? (['auth', 'user', id] as const) : (['auth', 'user'] as const)),
    },
    branches: {
        all: ['branches', 'list'] as const,
        detail: (id: string) => ['branches', 'detail', id] as const,
    },
    sales: {
        all: ['sales'] as const,
        list: (branchId: string | null, startDate?: string) => [...queryKeys.sales.all, 'list', { branchId, startDate }] as const,
        details: (id: string) => [...queryKeys.sales.all, 'detail', id] as const,
        refunds: (branchId: string | null) => [...queryKeys.sales.all, 'refunds', { branchId }] as const,
        tax: (dateRange: { start: string; end: string }, branchId: string | null) => 
            [...queryKeys.sales.all, 'tax', dateRange, branchId] as const,
        profit: (dateRange: { start: string; end: string }, branchId: string | null) => 
            [...queryKeys.sales.all, 'profit', dateRange, branchId] as const,
    },
    purchases: {
        all: ['purchases'] as const,
        list: (branchId: string | null, startDate?: string) => [...queryKeys.purchases.all, 'list', { branchId, startDate }] as const,
        returns: (branchId: string | null) => [...queryKeys.purchases.all, 'returns', { branchId }] as const,
        tax: (dateRange: { start: string; end: string }, branchId: string | null) => 
            [...queryKeys.purchases.all, 'tax', dateRange, branchId] as const,
    },
    products: {
        all: ['products'] as const,
        list: (branchId: string | null) => [...queryKeys.products.all, 'list', { branchId }] as const,
        detail: (id: string) => [...queryKeys.products.all, 'detail', id] as const,
    },
    suppliers: {
        all: ['suppliers'] as const,
        list: (branchId: string | null) => [...queryKeys.suppliers.all, 'list', { branchId }] as const,
    },
    customers: {
        all: ['customers'] as const,
        list: (branchId: string | null) => [...queryKeys.customers.all, 'list', { branchId }] as const,
    },
    expenses: {
        all: ['expenses'] as const,
        list: (branchId: string | null) => [...queryKeys.expenses.all, 'list', { branchId }] as const,
        profit: (dateRange: { start: string; end: string }, branchId: string | null) => 
            [...queryKeys.expenses.all, 'profit', dateRange, branchId] as const,
    },
    users: {
        all: ['users'] as const,
        list: () => [...queryKeys.users.all, 'list'] as const,
    },
    transfers: {
        all: ['transfers'] as const,
        list: (branchId: string | null) => [...queryKeys.transfers.all, 'list', { branchId }] as const,
    },
    reports: {
        all: ['reports'] as const,
        inventory: (date: string, branchId: string | null) => [...queryKeys.reports.all, 'inventory', date, branchId] as const,
    }
} as const;
