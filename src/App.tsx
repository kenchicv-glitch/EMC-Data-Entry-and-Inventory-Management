import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './lib/AuthContext';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Sales from './pages/Sales';
import Purchases from './pages/Purchases';
import Inventory from './pages/Inventory';
import Returns from './pages/Returns';
import CustomerRefunds from './pages/CustomerRefunds';
import Pricelist from './pages/Pricelist';
import Expenses from './pages/Expenses';
import DailySalesSummary from './pages/DailySalesSummary';
import DailyInventorySummary from './pages/DailyInventorySummary';
import ProfitAnalysis from './pages/ProfitAnalysis';
import SupplierPricelist from './pages/SupplierPricelist';
import Settings from './pages/Settings';

function App() {
    return (
        <AuthProvider>
            <Router>
                <Routes>
                    <Route path="/login" element={<Login />} />
                    <Route path="/signup" element={<Signup />} />
                    <Route element={<Layout />}>
                        <Route path="/" element={<Dashboard />} />
                        <Route path="/sales" element={<Sales />} />
                        <Route path="/purchases" element={<Purchases />} />
                        <Route path="/inventory" element={<Inventory />} />
                        <Route path="/pricelist" element={<Pricelist />} />
                        <Route path="/returns" element={<Returns />} />
                        <Route path="/customer-refunds" element={<CustomerRefunds />} />
                        <Route path="/expenses" element={<Expenses />} />
                        <Route path="/summary" element={<DailySalesSummary />} />
                        <Route path="/inventory-summary" element={<DailyInventorySummary />} />
                        <Route path="/profit" element={<ProfitAnalysis />} />
                        <Route path="/supplier-pricelist" element={<SupplierPricelist />} />
                        <Route path="/settings" element={<Settings />} />
                    </Route>
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </Router>
        </AuthProvider>
    );
}

// Helper to handle Router import if needed (Browser Router is usually what's wanted)
import { BrowserRouter as Router } from 'react-router-dom';

export default App;
