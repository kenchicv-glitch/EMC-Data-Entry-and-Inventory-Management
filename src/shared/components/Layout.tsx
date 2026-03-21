import React, { useState, Suspense } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useWorkspace } from '../hooks/useWorkspace';
import {
    LayoutDashboard, ShoppingCart, Package, Truck,
    RotateCcw, LogOut, Bell, ClipboardList,
    ChevronDown, Menu, X, Tag, Wallet,
    Calendar, Settings as SettingsIcon, LineChart,
    Users, ArrowLeft, ArrowRightLeft, FileBarChart, Calculator, Building2
} from 'lucide-react';
import logo from '../../assets/brand-logo.png';
import ThemeToggle from './ThemeToggle';
import type { Workspace } from '../lib/WorkspaceContextExports';
import type { Branch } from '../lib/BranchContextExports';
import { useBranch } from '../hooks/useBranch';
import { usePermissions } from '../hooks/usePermissions';
import { useNotifications } from '../hooks/useNotifications';
import NotificationModal from './NotificationModal';
import { useModal } from '../context/ModalContext';
import SalesModal from '../../features/sales/components/SalesModal';
import PurchaseModal from '../../features/purchases/components/PurchaseModal';

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
    currentWorkspace: Workspace;
    handleSwitchWorkspace: () => void;
    displayName: string | null;
    branches: Branch[];
    activeBranchId: string | null;
    setActiveBranchId: (id: string) => void;
}

const Sidebar = ({ 
    role, userEmail, userInitials, signOut, setIsSidebarOpen, openMenus, 
    toggleMenu, currentWorkspace, handleSwitchWorkspace, displayName,
    branches, activeBranchId, setActiveBranchId
}: SidebarProps) => {
    const { canAccessMaster } = usePermissions();
    
    return (
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
                    Retail OS
                </p>
            </div>
        </div>

        {/* Mobile Branch Selector */}
        {canAccessMaster && (
            <div className="px-6 py-4 border-b border-white/5 lg:hidden">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Switch Branch</p>
                <div className="relative">
                    <select 
                        value={activeBranchId || ''} 
                        onChange={(e) => {
                            setActiveBranchId(e.target.value);
                        }}
                        className="w-full appearance-none bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm font-bold text-white outline-none cursor-pointer focus:ring-2 focus:ring-brand-red/20 transition-all"
                    >
                        <option value="" disabled className="bg-brand-charcoal">Select Branch</option>
                        {branches.map((b: Branch) => (
                            <option key={b.id} value={b.id} className="bg-brand-charcoal text-white">{b.name}</option>
                        ))}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" />
                </div>
            </div>
        )}

        <nav className="flex-1 px-4 py-6 space-y-6 overflow-y-auto custom-scrollbar">
            {currentWorkspace === 'systems' && (
                <>
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
                                <SidebarLink to="/transfers" label="Transfers" icon={ArrowRightLeft} onClick={() => setIsSidebarOpen(false)} />
                            </div>
                        )}
                    </div>

                    <div className="space-y-1">
                        <button
                            onClick={() => toggleMenu('externals')}
                            className="w-full flex items-center justify-between px-3 py-2 text-[10px] font-black text-slate-500 uppercase tracking-widest hover:text-white transition-colors group"
                        >
                            <span>Externals</span>
                            <ChevronDown size={14} className={`transition-transform duration-300 ${openMenus.externals ? 'rotate-180' : ''}`} />
                        </button>
                        {openMenus.externals && (
                            <div className="space-y-1 mt-1 animate-slide-up">
                                <SidebarLink to="/suppliers" label="Suppliers" icon={Truck} onClick={() => setIsSidebarOpen(false)} />
                                <SidebarLink to="/customers" label="Customers" icon={Users} onClick={() => setIsSidebarOpen(false)} />
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
                                <SidebarLink to="/summary" label="DSC" icon={Calendar} onClick={() => setIsSidebarOpen(false)} />
                                <SidebarLink to="/inventory-summary" label="Daily Inventory Summary" icon={ClipboardList} onClick={() => setIsSidebarOpen(false)} />
                                <SidebarLink to="/expenses" label="Expenses" icon={Wallet} onClick={() => setIsSidebarOpen(false)} />
                            </div>
                        )}
                    </div>

                </>
            )}

            {currentWorkspace === 'bir' && (
                <div className="space-y-1">
                    <p className="px-3 py-2 text-[10px] font-black text-slate-500 uppercase tracking-widest">BIR & Exports</p>
                    <div className="space-y-1 mt-1">
                        <SidebarLink to="/tax-dashboard" label="Tax Computation" icon={Calculator} onClick={() => setIsSidebarOpen(false)} />
                        <SidebarLink to="/summary" label="DS Journal" icon={FileBarChart} onClick={() => setIsSidebarOpen(false)} />
                    </div>
                </div>
            )}

            {currentWorkspace === 'admin' && canAccessMaster && (
                <div className="space-y-1">
                    <p className="px-3 py-2 text-[10px] font-black text-slate-500 uppercase tracking-widest">Owner's Space</p>
                    <div className="space-y-1 mt-1 animate-slide-up">
                        <SidebarLink to="/admin" label="Command Center" icon={LayoutDashboard} onClick={() => setIsSidebarOpen(false)} />
                        <SidebarLink to="/profit" label="Profit Analysis" icon={LineChart} onClick={() => setIsSidebarOpen(false)} />
                        <SidebarLink to="/branch-inventory" label="Branch Inventory" icon={Building2} onClick={() => setIsSidebarOpen(false)} />
                        <SidebarLink to="/admin-pricelist" label="Admin Pricelist" icon={Tag} onClick={() => setIsSidebarOpen(false)} />
                        <SidebarLink to="/branch-management" label="Branch Management" icon={SettingsIcon} onClick={() => setIsSidebarOpen(false)} />
                    </div>
                </div>
            )}

            {/* Context Switcher Button */}
            <div className="pt-4 mt-4 border-t border-white/5">
                <button
                    onClick={handleSwitchWorkspace}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-all group"
                >
                    <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Switch Workspace</span>
                </button>
            </div>
        </nav>

        <div className="px-4 py-6 border-t border-white/5 bg-black/20">
            <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/5 hover:bg-white/10 transition-all duration-200 cursor-pointer group">
                <div className="w-10 h-10 rounded-xl bg-brand-red flex items-center justify-center text-white text-xs font-black shadow-lg flex-shrink-0">
                    {userInitials}
                </div>
                <div className="overflow-hidden flex-1 min-w-0">
                    <p className="text-sm font-bold text-white truncate">{displayName || userEmail?.split('@')[0]}</p>
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
};

export default function Layout() {
    const { user, role, signOut, loading: authLoading, displayName } = useAuth();
    const { branches, activeBranchId, setActiveBranchId, currentBranchName, loading: branchLoading } = useBranch();
    const { currentWorkspace, setWorkspace } = useWorkspace();
    const { canAccessMaster } = usePermissions();
    const loading = authLoading || branchLoading;
    const navigate = useNavigate();
    const location = useLocation();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isNotificationModalOpen, setIsNotificationModalOpen] = useState(false);
    const { 
        salesModal, 
        purchaseModal, 
        openSalesModal, 
        closeSalesModal, 
        openPurchaseModal, 
        closePurchaseModal 
    } = useModal();
    const { notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification } = useNotifications();

    const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({
        overview: true,
        externals: true,
        financials: true,
        admin: true
    });

    React.useEffect(() => {
        if (!loading && !user) navigate('/login');
    }, [user, loading, navigate]);

    // Redirect to home if no workspace is selected (extra safety)
    React.useEffect(() => {
        if (user && !currentWorkspace && location.pathname !== '/home') {
            navigate('/home');
        }
    }, [user, currentWorkspace, navigate, location.pathname]);

    // Global Keyboard Shortcuts (bare keys — N, P, Escape, F1)
    React.useEffect(() => {
        const handleGlobalShortcuts = (e: KeyboardEvent) => {
            const tag = (document.activeElement?.tagName || '').toLowerCase();
            const isInputFocused = tag === 'input' || tag === 'textarea' || tag === 'select' || (document.activeElement as HTMLElement)?.isContentEditable;

            if (!isInputFocused && !e.altKey && !e.ctrlKey && !e.shiftKey) {
                switch (e.key.toLowerCase()) {
                    case 'n':
                        e.preventDefault();
                        openSalesModal();
                        break;
                    case 'p':
                        e.preventDefault();
                        openPurchaseModal();
                        break;
                }
            }

            // Escape always dispatches (modals check their own open state)
            if (e.key === 'Escape') {
                window.dispatchEvent(new CustomEvent('close-modal'));
            }

            // F1 — focus inventory search (any focus state)
            if (e.key === 'F1') {
                e.preventDefault();
                if (location.pathname !== '/inventory') {
                    navigate('/inventory', { state: { focusSearch: true } });
                } else {
                    const searchEl = document.getElementById('inventory-global-search') as HTMLInputElement | null;
                    if (searchEl) searchEl.focus();
                }
            }
        };

        window.addEventListener('keydown', handleGlobalShortcuts);
        return () => window.removeEventListener('keydown', handleGlobalShortcuts);
    }, [location.pathname, navigate]);

    // Global Navigation Shortcuts
    React.useEffect(() => {
        const handleGlobalNav = (e: KeyboardEvent) => {
            if (e.altKey && !e.ctrlKey && !e.shiftKey) {
                switch (e.key.toLowerCase()) {
                    case 's':
                        e.preventDefault();
                        navigate('/sales');
                        break;
                    case 'p':
                        e.preventDefault();
                        navigate('/purchases');
                        break;
                    case 'i':
                        e.preventDefault();
                        navigate('/inventory');
                        break;
                    case 'e':
                        e.preventDefault();
                        navigate('/expenses');
                        break;
                    case 'd':
                        e.preventDefault();
                        navigate('/summary'); // DSC
                        break;
                    case 'c':
                        e.preventDefault();
                        navigate('/customers');
                        break;
                    case 'u':
                        e.preventDefault();
                        navigate('/suppliers');
                        break;
                    case 'h':
                        e.preventDefault();
                        navigate('/');
                        break;
                }
            }
        };

        window.addEventListener('keydown', handleGlobalNav);
        return () => window.removeEventListener('keydown', handleGlobalNav);
    }, [navigate]);

    if (loading) return (
        <div className="flex h-screen items-center justify-center bg-bg-base">
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

    const handleSwitchWorkspace = () => {
        setWorkspace(null);
        navigate('/home');
    };

    const sidebarProps = {
        role,
        userEmail: user.email,
        userInitials,
        signOut,
        isSidebarOpen,
        setIsSidebarOpen,
        openMenus,
        toggleMenu,
        currentWorkspace,
        handleSwitchWorkspace,
        displayName,
        branches,
        activeBranchId,
        setActiveBranchId
    };

    return (
        <div className="flex h-screen w-full bg-bg-base overflow-hidden">
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

            <main className="flex-1 flex flex-col overflow-hidden bg-bg-base">
                <header className="h-20 flex items-center justify-between px-8 bg-bg-surface/80 backdrop-blur-md sticky top-0 z-10 border-b border-border-default flex-shrink-0">
                    <div className="flex items-center gap-4">
                        <button className="md:hidden p-3 rounded-xl bg-bg-subtle text-text-secondary hover:bg-bg-muted" onClick={() => setIsSidebarOpen(true)}>
                            <Menu size={20} />
                        </button>
                        <div className="hidden lg:flex flex-col">
                            <h2 className="text-xs font-black text-text-muted uppercase tracking-[0.2em]">{currentWorkspace === 'systems' ? 'Systems Overview' : currentWorkspace === 'bir' ? 'BIR & Compliance' : "Owner's Space"}</h2>
                            {canAccessMaster ? (
                                <div className="relative group">
                                    <select 
                                        value={activeBranchId || ''} 
                                        onChange={(e) => {
                                            setActiveBranchId(e.target.value);
                                        }}
                                        className="appearance-none bg-transparent text-sm font-bold text-text-primary pr-8 outline-none cursor-pointer hover:text-brand-red transition-colors"
                                    >
                                        <option value="" disabled>Select Branch</option>
                                        {branches.map((b: Branch) => (
                                            <option key={b.id} value={b.id}>{b.name}</option>
                                        ))}
                                    </select>
                                    <ChevronDown size={14} className="absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none text-text-muted" />
                                </div>
                            ) : (
                                <p className="text-sm font-bold text-text-primary flex items-center gap-2">
                                    {currentBranchName}
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <button
                            onClick={handleSwitchWorkspace}
                            className="hidden md:flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-bg-subtle hover:bg-bg-muted border border-border-default text-text-secondary hover:text-text-primary transition-all text-[10px] font-black uppercase tracking-widest"
                        >
                            <ArrowLeft size={14} /> Back to Home
                        </button>

                        <div className="flex items-center gap-3 border-l pl-4 border-border-default">
                            <ThemeToggle />

                            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-text-muted hover:bg-bg-subtle shadow-sm cursor-pointer transition-all" title="Checklist">
                                <ClipboardList size={18} />
                            </div>
                             <div 
                                onClick={() => setIsNotificationModalOpen(true)}
                                className="relative w-9 h-9 rounded-xl flex items-center justify-center text-text-muted hover:bg-bg-subtle hover:text-brand-red shadow-sm cursor-pointer transition-all" 
                                title="Notifications"
                            >
                                <Bell size={18} />
                                {unreadCount > 0 && (
                                    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-brand-red text-white text-[10px] font-black rounded-full flex items-center justify-center shadow-red animate-bounce ring-2 ring-bg-surface">
                                        {unreadCount > 99 ? '99+' : unreadCount}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </header>

                <NotificationModal 
                    isOpen={isNotificationModalOpen}
                    onClose={() => setIsNotificationModalOpen(false)}
                    notifications={notifications}
                    onMarkAsRead={markAsRead}
                    onMarkAllAsRead={markAllAsRead}
                    onDeleteNotification={deleteNotification}
                />

                <div className="flex-1 overflow-y-auto custom-scrollbar bg-bg-base/50">
                    <div 
                        key={location.pathname}
                        className="p-8 lg:p-10 max-w-[1600px] mx-auto animate-page-entry"
                    >
                        <Suspense fallback={
                            <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
                                <div className="w-12 h-12 border-4 border-brand-red/20 border-t-brand-red rounded-full animate-spin" />
                                <p className="text-xs font-black text-text-muted uppercase tracking-widest">Loading Dashboard...</p>
                            </div>
                        }>
                            <Outlet />
                        </Suspense>
                    </div>
                </div>

                <SalesModal 
                    isOpen={salesModal.isOpen}
                    onClose={closeSalesModal}
                    editData={salesModal.editData}
                    onSuccess={() => {
                        window.dispatchEvent(new CustomEvent('refresh-data'));
                    }}
                />

                <PurchaseModal 
                    isOpen={purchaseModal.isOpen}
                    onClose={closePurchaseModal}
                    editData={purchaseModal.editData}
                    onSuccess={() => {
                        window.dispatchEvent(new CustomEvent('refresh-data'));
                    }}
                />
            </main>
        </div>
    );
}
