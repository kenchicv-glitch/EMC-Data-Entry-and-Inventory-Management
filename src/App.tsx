import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './shared/lib/queryClient';
import { AuthProvider } from './shared/lib/AuthContext';
import { WorkspaceProvider, useWorkspace } from './shared/lib/WorkspaceContext';
import { BranchProvider } from './shared/lib/BranchContext';
import Login from './features/auth/Login';
import Home from './features/home/Home';
import Layout from './shared/components/Layout';
import { Toaster } from 'sonner';
import { useTheme } from './shared/hooks/useTheme';
import Dashboard from './features/dashboard/Dashboard';
import Sales from './features/sales/Sales';
import Purchases from './features/purchases/Purchases';
import Inventory from './features/inventory/Inventory';
import Returns from './features/purchases/Returns';
import CustomerRefunds from './features/sales/CustomerRefunds';
import AdminPricelist from './features/inventory/AdminPricelist';
import Expenses from './features/expenses/Expenses';
import DailySalesSummary from './features/dashboard/DailySalesSummary';
import DailyInventorySummary from './features/inventory/DailyInventorySummary';
import ProfitAnalysis from './features/dashboard/ProfitAnalysis';
import Settings from './features/auth/Settings';
import Suppliers from './features/suppliers/Suppliers';
import Customers from './features/customers/Customers';
import ExpressSales from './features/sales/ExpressSales';
import TaxDashboard from './features/reports/TaxDashboard';
import AdminCommandCenter from './features/dashboard/AdminCommandCenter';
import BranchInventory from './features/inventory/BranchInventory';
import BranchInventoryDetail from './features/inventory/BranchInventoryDetail';

import { useAuth } from './shared/hooks/useAuth';

function EncoderGuard({ children }: { children: React.ReactNode }) {
    const { user, loading } = useAuth();
    if (loading) return null;
    if (!user) return <Navigate to="/login" replace />;
    return <>{children}</>;
}

function OwnerGuard({ children }: { children: React.ReactNode }) {
    const { user, role, loading } = useAuth();
    if (loading) return null;
    if (!user) return <Navigate to="/login" replace />;
    if (role !== 'owner') return <Navigate to="/" replace />;
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
                <Route path="/summary" element={<DailySalesSummary />} />
                <Route path="/tax-dashboard" element={<TaxDashboard />} />
                <Route path="/inventory-summary" element={<DailyInventorySummary />} />
                <Route path="/profit" element={<ProfitAnalysis />} />
                <Route path="/settings" element={<Settings />} />
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
            <AppRoutes />
            <Toaster richColors position="top-right" theme={theme as 'light' | 'dark'} />
        </>
    );
}

export default App;
