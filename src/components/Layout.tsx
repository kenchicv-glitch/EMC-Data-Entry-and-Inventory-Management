import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import {
    LayoutDashboard, ShoppingCart, Package, Truck,
    RotateCcw, LogOut, Bell, ClipboardList,
    ChevronDown, Menu, X, Tag, Wallet,
    Calendar, Settings as SettingsIcon, LineChart
} from 'lucide-react';
import logo from '../assets/brand-logo.png';

interface SidebarLinkProps {
    to: string;
    label: string;
    icon: React.ElementType;
    end?: boolean;
    onClick: () => void;
}

const SidebarLink = ({ to, label, icon: Icon, end = false, onClick }: SidebarLinkProps) => (
    <NavLink
        to={to}
        end={end}
        onClick={onClick}
        className={({ isActive }) =>
            `sidebar-item transition-all duration-300 hover:scale-[1.02] ${isActive ? 'sidebar-item-active' : 'sidebar-item-inactive'}`
        }
    >
        {({ isActive }) => (
            <>
                <Icon size={18} className={isActive ? 'text-brand-charcoal' : 'text-slate-400'} />
                <span className="flex-1">{label}</span>
                {isActive && (
                    <div className="w-1.5 h-1.5 bg-brand-charcoal rounded-full shadow-sm" />
                )}
            </>
        )}
    </NavLink>
);

interface SidebarProps {
    role: string | null;
    userEmail: string | undefined;
    userInitials: string;
    signOut: () => Promise<void>;
    isSidebarOpen: boolean;
    setIsSidebarOpen: (open: boolean) => void;
    openMenus: Record<string, boolean>;
    toggleMenu: (menu: string) => void;
}

const Sidebar = ({ role, userEmail, userInitials, signOut, setIsSidebarOpen, openMenus, toggleMenu }: SidebarProps) => (
    <aside className="w-64 flex-shrink-0 bg-brand-charcoal flex flex-col h-full border-r border-white/5">
        <div className="flex items-center gap-3 px-6 py-8 border-b border-white/5">
            <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-lg overflow-hidden border border-white/10 p-1">
                <img src={logo} alt="EMC Logo" className="w-full h-full object-contain" />
            </div>
            <div className="overflow-hidden flex-1">
                <h1 className="font-bold text-sm text-white leading-tight tracking-tight uppercase">
                    EMC Trading
                </h1>
                <p className="text-[10px] text-brand-red font-black uppercase tracking-[0.2em]">
                    Systems
                </p>
            </div>
            <div className="flex items-center gap-1">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:bg-white/10 shadow-sm cursor-pointer transition-all" title="Checklist">
                    <ClipboardList size={18} />
                </div>
                <div className="relative w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:bg-white/10 hover:text-brand-red shadow-sm cursor-pointer transition-all" title="Notifications">
                    <Bell size={18} />
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-brand-orange rounded-full border-2 border-brand-charcoal ring-2 ring-brand-orange/20 animate-pulse" />
                </div>
            </div>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-6 overflow-y-auto custom-scrollbar">
            <div className="space-y-1">
                <button
                    onClick={() => toggleMenu('overview')}
                    className="w-full flex items-center justify-between px-3 py-2 text-[10px] font-black text-slate-500 uppercase tracking-widest hover:text-white transition-colors group"
                >
                    <span>Systems Overview</span>
                    <ChevronDown size={14} className={`transition-transform duration-300 ${openMenus.overview ? 'rotate-180' : ''}`} />
                </button>
                {openMenus.overview && (
                    <div className="space-y-1 mt-1 animate-slide-up">
                        <SidebarLink to="/" label="Overview" icon={LayoutDashboard} end={true} onClick={() => setIsSidebarOpen(false)} />
                        <SidebarLink to="/sales" label="Sales" icon={ShoppingCart} onClick={() => setIsSidebarOpen(false)} />
                        <SidebarLink to="/purchases" label="Purchases" icon={Truck} onClick={() => setIsSidebarOpen(false)} />
                        <SidebarLink to="/inventory" label="Inventory" icon={Package} onClick={() => setIsSidebarOpen(false)} />
                        <SidebarLink to="/returns" label="Supplier Returns" icon={RotateCcw} onClick={() => setIsSidebarOpen(false)} />
                        <SidebarLink to="/customer-refunds" label="Customer Refunds" icon={RotateCcw} onClick={() => setIsSidebarOpen(false)} />
                    </div>
                )}
            </div>

            <div className="space-y-1">
                <button
                    onClick={() => toggleMenu('financials')}
                    className="w-full flex items-center justify-between px-3 py-2 text-[10px] font-black text-slate-500 uppercase tracking-widest hover:text-white transition-colors group"
                >
                    <span>Financials</span>
                    <ChevronDown size={14} className={`transition-transform duration-300 ${openMenus.financials ? 'rotate-180' : ''}`} />
                </button>
                {openMenus.financials && (
                    <div className="space-y-1 mt-1 animate-slide-up">
                        <SidebarLink to="/summary" label="Daily Sales Summary" icon={Calendar} onClick={() => setIsSidebarOpen(false)} />
                        <SidebarLink to="/inventory-summary" label="Daily Inventory Summary" icon={ClipboardList} onClick={() => setIsSidebarOpen(false)} />
                        <SidebarLink to="/expenses" label="Expenses" icon={Wallet} onClick={() => setIsSidebarOpen(false)} />
                    </div>
                )}
            </div>

            {role === 'admin' && (
                <div className="space-y-1">
                    <button
                        onClick={() => toggleMenu('admin')}
                        className="w-full flex items-center justify-between px-3 py-2 text-[10px] font-black text-slate-500 uppercase tracking-widest hover:text-white transition-colors group"
                    >
                        <span>Admin</span>
                        <ChevronDown size={14} className={`transition-transform duration-300 ${openMenus.admin ? 'rotate-180' : ''}`} />
                    </button>
                    {openMenus.admin && (
                        <div className="space-y-1 mt-1 animate-slide-up">
                            <SidebarLink to="/profit" label="Profit Analysis" icon={LineChart} onClick={() => setIsSidebarOpen(false)} />
                            <SidebarLink to="/admin-pricelist" label="Admin Pricelist" icon={Tag} onClick={() => setIsSidebarOpen(false)} />
                            <SidebarLink to="/settings" label="Settings" icon={SettingsIcon} onClick={() => setIsSidebarOpen(false)} />
                        </div>
                    )}
                </div>
            )}
        </nav>

        <div className="px-4 py-6 border-t border-white/5 bg-black/20">
            <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/5 hover:bg-white/10 transition-all duration-200 cursor-pointer group">
                <div className="w-10 h-10 rounded-xl bg-brand-red flex items-center justify-center text-white text-xs font-black shadow-lg flex-shrink-0">
                    {userInitials}
                </div>
                <div className="overflow-hidden flex-1 min-w-0">
                    <p className="text-sm font-bold text-white truncate">{userEmail?.split('@')[0]}</p>
                    <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest">{role}</p>
                </div>
                <button
                    onClick={() => signOut()}
                    className="p-2 rounded-xl hover:bg-red-500/20 transition-all text-slate-400 hover:text-brand-red"
                    title="Sign Out"
                >
                    <LogOut size={16} />
                </button>
            </div>
        </div>
    </aside>
);

export default function Layout() {
    const { user, role, signOut, loading } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({
        overview: true,
        financials: true,
        admin: true
    });

    React.useEffect(() => {
        if (!loading && !user) navigate('/login');
    }, [user, loading, navigate]);

    if (loading) return (
        <div className="flex h-screen items-center justify-center bg-slate-50">
            <div className="flex flex-col items-center gap-4">
                <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center shadow-2xl animate-pulse p-4">
                    <img src={logo} alt="Loading..." className="w-full h-full object-contain" />
                </div>
                <p className="text-sm text-slate-500 font-medium animate-pulse">Initializing Systems...</p>
            </div>
        </div>
    );
    if (!user) return null;

    const toggleMenu = (menu: string) => setOpenMenus(prev => ({ ...prev, [menu]: !prev[menu] }));
    const userInitials = (user.email || 'U').split('@')[0].slice(0, 2).toUpperCase();

    const sidebarProps = {
        role,
        userEmail: user.email,
        userInitials,
        signOut,
        isSidebarOpen,
        setIsSidebarOpen,
        openMenus,
        toggleMenu
    };

    return (
        <div className="flex h-screen w-full bg-slate-50 overflow-hidden">
            <div className="hidden md:flex flex-col h-full shadow-2xl z-20">
                <Sidebar {...sidebarProps} />
            </div>

            {isSidebarOpen && (
                <div className="fixed inset-0 z-50 flex md:hidden">
                    <div className="absolute inset-0 bg-brand-charcoal/80 backdrop-blur-md" onClick={() => setIsSidebarOpen(false)} />
                    <div className="relative w-72 h-full flex flex-col animate-slide-right">
                        <Sidebar {...sidebarProps} />
                        <button
                            onClick={() => setIsSidebarOpen(false)}
                            className="absolute top-8 -right-12 w-10 h-10 bg-white rounded-full flex items-center justify-center text-brand-charcoal shadow-xl"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>
            )}

            <main className="flex-1 flex flex-col overflow-hidden bg-slate-50">
                <header className="h-20 flex items-center justify-between px-8 bg-white/80 backdrop-blur-md sticky top-0 z-10 border-b border-slate-200 flex-shrink-0">
                    <div className="flex items-center gap-4">
                        <button className="md:hidden p-3 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200" onClick={() => setIsSidebarOpen(true)}>
                            <Menu size={20} />
                        </button>
                        <div className="hidden lg:flex flex-col">
                            <h2 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Current Workspace</h2>
                            <p className="text-sm font-bold text-brand-charcoal flex items-center gap-2">Main Store Distribution <ChevronDown size={14} /></p>
                        </div>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto custom-scrollbar bg-[#f8fafc]">
                    <div className="p-8 lg:p-10 max-w-[1600px] mx-auto animate-page-entry" key={location.pathname}>
                        <Outlet />
                    </div>
                </div>
            </main>
        </div>
    );
}
