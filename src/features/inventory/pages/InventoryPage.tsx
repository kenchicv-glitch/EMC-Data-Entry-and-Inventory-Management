import { useState, useMemo, useRef } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { useReactToPrint } from 'react-to-print';
import {
    Package,
    Download,
    Upload,
    Printer,
    Tag,
    MapPin,
    ClipboardList,
} from 'lucide-react';
import { useBranch } from '../../../shared/hooks/useBranch';
import { useAuth } from '../../../shared/hooks/useAuth';
import { useProductsWithDetails } from '../hooks/useProducts';
import { useImportProducts } from '../hooks/useProducts';
import { useCategoryTree, useCategoryProductCounts } from '../hooks/useCategories';
import { useLocations } from '../hooks/useLocations';
import { useLowStockProducts } from '../hooks/useProducts';
import CategoryTreeComponent from '../components/CategoryTree';
import ProductTable from '../components/ProductTable';
import ProductFilters from '../components/ProductFilters';
import ProductQuickViewModal from '../components/ProductQuickViewModal';
import ProductImportModal from '../components/ProductImportModal';
import { exportProductsToExcel } from '../services/inventoryExportService';
import type { Product, ProductImportRow, ProductImportResult } from '../types/product';

const NAV_TABS = [
    { label: 'Products',   to: '/inventory',            icon: Package },
    { label: 'Categories', to: '/inventory/categories', icon: Tag },
    { label: 'Locations',  to: '/inventory/locations',  icon: MapPin },
    { label: 'Stocktake',  to: '/inventory/stocktake',  icon: ClipboardList },
];

export default function InventoryPage() {
    const { activeBranchId } = useBranch();
    const { user } = useAuth();
    const location = useLocation();
    const [searchParams, setSearchParams] = useSearchParams();

    // ---- Data ----
    const { data: products = [], isLoading } = useProductsWithDetails(activeBranchId);
    const { data: categoryTree = [] } = useCategoryTree();
    const { data: productCounts = {} } = useCategoryProductCounts(activeBranchId);
    const { data: locations = [] } = useLocations(activeBranchId);
    const { data: lowStockProducts = [] } = useLowStockProducts(activeBranchId);
    const importMutation = useImportProducts();

    // ---- State ----
    const selectedCategoryId = searchParams.get('category');
    const setSelectedCategoryId = (id: string | null) => {
        if (id) {
            searchParams.set('category', id);
        } else {
            searchParams.delete('category');
        }
        setSearchParams(searchParams);
    };
    const [search, setSearch] = useState('');
    const [brandFilter, setBrandFilter] = useState('');
    const [locationFilter, setLocationFilter] = useState('');
    const [lowStockOnly, setLowStockOnly] = useState(false);
    const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);
    const [showImport, setShowImport] = useState(false);

    // ---- Derived ----
    const brands = useMemo(() => {
        const set = new Set(products.map(p => p.brand).filter(Boolean) as string[]);
        return Array.from(set).sort();
    }, [products]);

    // Helper to get all descendant IDs including the parent itself
    const selectedCategoryIds = useMemo(() => {
        if (!selectedCategoryId) return null;
        
        const getAllIds = (nodes: any[], targetId: string): string[] => {
            for (const node of nodes) {
                if (node.id === targetId) {
                    const ids = [node.id];
                    const getChildrenIds = (children: any[]) => {
                        for (const child of children) {
                            ids.push(child.id);
                            if (child.children) getChildrenIds(child.children);
                        }
                    };
                    if (node.children) getChildrenIds(node.children);
                    return ids;
                }
                if (node.children) {
                    const result = getAllIds(node.children, targetId);
                    if (result.length > 0) return result;
                }
            }
            return [];
        };

        return new Set(getAllIds(categoryTree, selectedCategoryId));
    }, [categoryTree, selectedCategoryId]);

    const filteredProducts = useMemo(() => {
        let result = products;

        if (selectedCategoryIds && !search) {
            result = result.filter(p => p.category_id && selectedCategoryIds.has(p.category_id));
        }
        if (brandFilter) {
            result = result.filter(p => p.brand === brandFilter);
        }
        if (locationFilter) {
            result = result.filter(p => p.location_id === locationFilter);
        }
        if (lowStockOnly) {
            const threshold = (p: Product) => p.low_stock_threshold ?? 0;
            result = result.filter(p => threshold(p) > 0 && p.stock_available <= threshold(p));
        }

        return result;
    }, [products, selectedCategoryId, brandFilter, locationFilter, lowStockOnly]);

    // ---- Print ----
    const printRef = useRef<HTMLDivElement>(null);
    const handlePrint = useReactToPrint({ contentRef: printRef });

    // ---- Import ----
    const handleImport = async (rows: ProductImportRow[]): Promise<ProductImportResult> => {
        if (!activeBranchId || !user?.id) throw new Error('No branch or user selected');
        return importMutation.mutateAsync({ rows, branchId: activeBranchId, userId: user.id });
    };

    const handleExport = () => {
        exportProductsToExcel(filteredProducts);
    };

    const isProductsRoute = location.pathname === '/inventory';

    return (
        <div className="flex flex-col h-full">
            {/* Page header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border-default shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-brand-red/10 flex items-center justify-center">
                        <Package size={18} className="text-brand-red" />
                    </div>
                    <div>
                        <h1 className="text-lg font-black text-text-primary">Inventory</h1>
                        <p className="text-xs text-text-muted">
                            {products.length.toLocaleString()} products
                            {lowStockProducts.length > 0 && (
                                <span className="ml-2 text-amber-500 font-bold">
                                    · {lowStockProducts.length} low stock
                                </span>
                            )}
                        </p>
                    </div>
                </div>

                {/* Actions — only shown on products tab */}
                {isProductsRoute && (
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleExport}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border-default text-xs font-semibold text-text-secondary hover:bg-bg-subtle hover:text-text-primary transition-all"
                        >
                            <Download size={13} /> Export
                        </button>
                        <button
                            onClick={() => setShowImport(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border-default text-xs font-semibold text-text-secondary hover:bg-bg-subtle hover:text-text-primary transition-all"
                        >
                            <Upload size={13} /> Import
                        </button>
                        <button
                            onClick={() => handlePrint()}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border-default text-xs font-semibold text-text-secondary hover:bg-bg-subtle hover:text-text-primary transition-all no-print"
                        >
                            <Printer size={13} /> Print
                        </button>
                    </div>
                )}
            </div>

            {/* Sub-nav tabs */}
            <div className="flex items-center gap-1 px-6 py-2 border-b border-border-default bg-bg-surface shrink-0">
                {NAV_TABS.map(({ label, to, icon: Icon }) => {
                    const isActive = location.pathname === to;
                    return (
                        <Link
                            key={to}
                            to={to}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                isActive
                                    ? 'bg-brand-red/10 text-brand-red'
                                    : 'text-text-muted hover:bg-bg-subtle hover:text-text-primary'
                            }`}
                        >
                            <Icon size={13} />
                            {label}
                        </Link>
                    );
                })}
            </div>

            {/* Main layout — only shown on /inventory */}
            {isProductsRoute ? (
                <div className="flex flex-1 overflow-hidden">
                    {/* Category sidebar */}
                    <aside className="w-56 shrink-0 border-r border-border-default overflow-y-auto p-3 bg-bg-subtle/30">
                        <p className="text-[10px] font-black text-text-muted uppercase tracking-wider px-3 mb-2">
                            Categories
                        </p>
                        <CategoryTreeComponent
                            tree={categoryTree}
                            selectedId={selectedCategoryId}
                            onSelect={setSelectedCategoryId}
                            productCounts={productCounts}
                        />
                    </aside>

                    {/* Product content */}
                    <div ref={printRef} className="flex-1 overflow-y-auto p-4 space-y-3">
                        <ProductFilters
                            search={search}
                            onSearchChange={setSearch}
                            brandFilter={brandFilter}
                            onBrandChange={setBrandFilter}
                            locationFilter={locationFilter}
                            onLocationChange={setLocationFilter}
                            lowStockOnly={lowStockOnly}
                            onLowStockToggle={() => setLowStockOnly(v => !v)}
                            brands={brands}
                            locations={locations}
                            onClearAll={() => {
                                setSearch('');
                                setBrandFilter('');
                                setLocationFilter('');
                                setLowStockOnly(false);
                            }}
                        />
                        <ProductTable
                            products={filteredProducts}
                            isLoading={isLoading}
                            globalFilter={search}
                            onRowClick={setQuickViewProduct}
                        />
                    </div>
                </div>
            ) : (
                // Nested routes render here via Outlet
                <div className="flex-1 overflow-y-auto p-6">
                    <p className="text-text-muted text-sm">Loading…</p>
                </div>
            )}

            {/* Modals */}
            <ProductQuickViewModal
                isOpen={Boolean(quickViewProduct)}
                onClose={() => setQuickViewProduct(null)}
                product={quickViewProduct}
            />
            <ProductImportModal
                isOpen={showImport}
                onClose={() => setShowImport(false)}
                onImport={handleImport}
                isImporting={importMutation.isPending}
            />
        </div>
    );
}
