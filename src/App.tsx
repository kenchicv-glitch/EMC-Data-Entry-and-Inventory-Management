import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './shared/lib/queryClient';
import { AuthProvider } from './shared/lib/AuthContext';
import { WorkspaceProvider } from './shared/lib/WorkspaceContext';
import { useWorkspace } from './shared/hooks/useWorkspace';
import { BranchProvider } from './shared/lib/BranchContext';
import Login from './features/auth/Login';
import Home from './features/home/Home';
import Layout from './shared/components/Layout';
import { Toaster } from 'sonner';
import { useTheme } from './shared/hooks/useTheme';

// Lazy load major features
const Dashboard = lazy(() => import('./features/dashboard/Dashboard'));
const Sales = lazy(() => import('./features/sales/Sales'));
const Purchases = lazy(() => import('./features/purchases/Purchases'));
const Inventory = lazy(() => import('./features/inventory/Inventory'));
const Returns = lazy(() => import('./features/purchases/Returns'));
const CustomerRefunds = lazy(() => import('./features/sales/CustomerRefunds'));
const AdminPricelist = lazy(() => import('./features/inventory/AdminPricelist'));
const Expenses = lazy(() => import('./features/expenses/Expenses'));
const DailySalesSummary = lazy(() => import('./features/dashboard/DailySalesSummary'));
const DailyInventorySummary = lazy(() => import('./features/inventory/DailyInventorySummary'));
const ProfitAnalysis = lazy(() => import('./features/dashboard/ProfitAnalysis'));
const Settings = lazy(() => import('./features/auth/Settings'));
const Suppliers = lazy(() => import('./features/suppliers/Suppliers'));
const Customers = lazy(() => import('./features/customers/Customers'));
const ExpressSales = lazy(() => import('./features/sales/ExpressSales'));
const TaxDashboard = lazy(() => import('./features/reports/TaxDashboard'));
const AdminCommandCenter = lazy(() => import('./features/dashboard/AdminCommandCenter'));
const BranchInventory = lazy(() => import('./features/inventory/BranchInventory'));
const BranchInventoryDetail = lazy(() => import('./features/inventory/BranchInventoryDetail'));
const Transfers = lazy(() => import('./features/transfers/Transfers'));
const GuidePage = lazy(() => import('./features/guide/pages/GuidePage'));

import { useAuth } from './shared/hooks/useAuth';
import { usePermissions } from './shared/hooks/usePermissions';

function EncoderGuard({ children }: { children: React.ReactNode }) {
    const { user, loading } = useAuth();
    if (loading) return null;
    if (!user) return <Navigate to="/login" replace />;
    return <>{children}</>;
}

function OwnerGuard({ children }: { children: React.ReactNode }) {
    const { user, loading } = useAuth();
    const { canAccessMaster } = usePermissions();
    if (loading) return null;
    if (!user) return <Navigate to="/login" replace />;
    if (!canAccessMaster) return <Navigate to="/" replace />;
    return <>{children}</>;
}

function AppRoutes() {
    const { currentWorkspace } = useWorkspace();
    return (
        <Routes>
            <Route path="/login" element={<Login />} />
            
            <Route element={<EncoderGuard><Layout /></EncoderGuard>}>
                {/* Standard Dashboard for all authenticated roles */}
                <Route path="/" element={currentWorkspace ? <Dashboard /> : <Navigate to="/home" replace />} />
                <Route path="/dashboard" element={<Dashboard />} />
                
                {/* Owner only routes */}
                    <Route element={<OwnerGuard><Outlet /></OwnerGuard>}>
                        <Route path="/admin" element={<AdminCommandCenter />} />
                        <Route path="/branch-inventory" element={<BranchInventory />} />
                        <Route path="/branch-inventory/:branchId" element={<BranchInventoryDetail />} />
                        <Route path="/branch-management" element={<Settings />} />
                        <Route path="/users" element={<Settings />} />
                    </Route>

                {/* Shared routes */}
                <Route path="/sales" element={<Sales />} />
                <Route path="/express-sales" element={<ExpressSales />} />
                <Route path="/purchases" element={<Purchases />} />
                <Route path="/inventory" element={<Inventory />} />
                <Route path="/admin-pricelist" element={<AdminPricelist />} />
                <Route path="/returns" element={<Returns />} />
                <Route path="/customer-refunds" element={<CustomerRefunds />} />
                <Route path="/expenses" element={<Expenses />} />
                <Route path="/suppliers" element={<Suppliers />} />
                <Route path="/customers" element={<Customers />} />
                <Route path="/transfers" element={<Transfers />} />
                <Route path="/summary" element={<DailySalesSummary />} />
                <Route path="/tax-dashboard" element={<TaxDashboard />} />
                <Route path="/inventory-summary" element={<DailyInventorySummary />} />
                <Route path="/profit" element={<ProfitAnalysis />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/guide" element={<GuidePage />} />
            </Route>

            <Route path="/home" element={<EncoderGuard><Home /></EncoderGuard>} />
            <Route path="*" element={<Navigate to="/home" replace />} />
        </Routes>
    );
}

function App() {
    return (
        <QueryClientProvider client={queryClient}>
            <AuthProvider>
                <BranchProvider>
                    <WorkspaceProvider>
                        <Router>
                            <AppContent />
                        </Router>
                    </WorkspaceProvider>
                </BranchProvider>
            </AuthProvider>
        </QueryClientProvider>
    );
}

function AppContent() {
    const { theme } = useTheme();

    return (
        <>
            <Suspense fallback={
                <div className="flex h-screen items-center justify-center bg-bg-base font-black text-brand-red animate-pulse">
                    LOADING...
                </div>
            }>
                <AppRoutes />
            </Suspense>
            <Toaster richColors position="top-center" theme={theme as 'light' | 'dark'} />
        </>
    );
}

export default App;
