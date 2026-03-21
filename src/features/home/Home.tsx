import { useNavigate } from 'react-router-dom';
import { useWorkspace } from '../../shared/hooks/useWorkspace';
import type { Workspace } from '../../shared/lib/WorkspaceContextExports';
import { useAuth } from '../../shared/hooks/useAuth';
import {
    LayoutDashboard,
    ShieldCheck,
    FileBarChart,
    ArrowRight,
    LogOut
} from 'lucide-react';
import logo from '../../assets/brand-logo.png';

interface WorkspaceTileProps {
    id: Workspace;
    title: string;
    subtitle: string;
    icon: React.ElementType;
    gradient: string;
    onClick: (id: Workspace) => void;
    delay: string;
}

const WorkspaceTile = ({ id, title, subtitle, icon: Icon, gradient, onClick, delay }: WorkspaceTileProps) => (
    <button
        onClick={() => onClick(id)}
        className={`group relative flex flex-col p-8 rounded-[40px] transition-all duration-500 hover:scale-[1.03] active:scale-[0.98] text-left overflow-hidden border border-white/20 select-none animate-slide-up h-72 shadow-2xl shadow-black/5`}
        style={{ animationDelay: delay }}
    >
        {/* Background Gradient - Now primarily Brand Red */}
        <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-90 group-hover:opacity-100 transition-opacity`} />

        {/* Glass Effect */}
        <div className="absolute inset-0 backdrop-blur-3xl bg-white/5" />

        {/* Decorative Circles */}
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-white/10 rounded-full blur-3xl group-hover:scale-125 transition-transform duration-700" />
        <div className="absolute -bottom-12 -left-12 w-32 h-32 bg-black/10 rounded-full blur-2xl group-hover:scale-110 transition-transform duration-700" />

        <div className="relative z-10 flex flex-col h-full">
            <div className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mb-6 shadow-xl border border-white/20">
                <Icon size={28} className="text-white" />
            </div>

            <div className="mt-auto">
                <h3 className="text-2xl font-black text-white uppercase tracking-tight mb-2 flex items-center gap-2">
                    {title}
                    <ArrowRight size={20} className="opacity-0 -translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300" />
                </h3>
                <p className="text-white/70 text-sm font-bold tracking-wide uppercase">
                    {subtitle}
                </p>
            </div>
        </div>
    </button>
);

export default function Home() {
    const { setWorkspace } = useWorkspace();
    const { signOut, user, role } = useAuth();
    const navigate = useNavigate();

    const handleSelectWorkspace = (id: Workspace) => {
        setWorkspace(id);
        navigate('/'); // Redirect to the dashboard in the selected workspace
    };

    const userInitials = (user?.email || 'U').split('@')[0].slice(0, 2).toUpperCase();

    // Use a light, easy-on-the-eyes red for the background
    return (
        <div className="min-h-screen bg-[#FFF8F8] flex flex-col items-center justify-center p-6 relative overflow-hidden">
            {/* Background elements - using soft red blobs */}
            <div className="fixed top-0 left-0 w-full h-full pointer-events-none">
                <div className="absolute top-[10%] left-[5%] w-[40%] h-[40%] bg-brand-red/5 rounded-full blur-[120px] animate-pulse" />
                <div className="absolute bottom-[10%] right-[5%] w-[30%] h-[30%] bg-brand-red/5 rounded-full blur-[100px] animate-pulse" />
                <div className="absolute top-[40%] right-[15%] w-[25%] h-[25%] bg-brand-red/3 rounded-full blur-[80px]" />
            </div>

            <div className="w-full max-w-6xl relative z-10 flex flex-col items-center">
                {/* Header */}
                <div className="text-center mb-16 animate-fade-in flex flex-col items-center">
                    {/* Brand Logo replaces the Sparkles badge */}
                    <div className="w-24 h-24 mb-8 bg-white p-4 rounded-[32px] shadow-2xl shadow-brand-red/10 border border-slate-100 flex items-center justify-center transform hover:rotate-6 transition-transform duration-500">
                        <img src={logo} alt="EMC Logo" className="w-full h-full object-contain" />
                    </div>

                    <h1 className="text-5xl font-black text-brand-charcoal tracking-tight mb-4 uppercase">
                        Welcome back, <span className="text-brand-red">{role === 'owner' ? 'Owner' : role === 'admin' ? 'Admin' : 'Encoder'}</span>
                    </h1>
                    <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">
                        Select a workspace to begin your operations
                    </p>
                </div>

                {/* Workspace Grid - centered even with 2 tiles */}
                <div className="flex flex-wrap justify-center gap-8 w-full">
                    <WorkspaceTile
                        id="systems"
                        title="Systems"
                        subtitle="Inventory, Sales & Logistics"
                        icon={LayoutDashboard}
                        gradient="from-brand-red to-brand-red/80"
                        onClick={handleSelectWorkspace}
                        delay="0s"
                    />
                    <WorkspaceTile
                        id="bir"
                        title="BIR & Exports"
                        subtitle="Reporting & Tax Compliance"
                        icon={FileBarChart}
                        gradient="from-brand-red to-brand-red/80"
                        onClick={handleSelectWorkspace}
                        delay="0.1s"
                    />
                    {role === 'owner' && (
                        <WorkspaceTile
                            id="admin"
                            title="Owner's Space"
                            subtitle="Multi-Branch Control & Analytics"
                            icon={ShieldCheck}
                            gradient="from-brand-red to-brand-red/80"
                            onClick={handleSelectWorkspace}
                            delay="0.2s"
                        />
                    )}
                </div>

                {/* Footer / User Profile */}
                <div className="mt-20 flex items-center gap-6 animate-fade-in" style={{ animationDelay: '0.4s' }}>
                    <div className="flex items-center gap-4 bg-white p-2.5 pr-6 rounded-[28px] shadow-lg border border-slate-100 group transition-all hover:scale-105">
                        <div className="w-12 h-12 bg-brand-charcoal rounded-2xl flex items-center justify-center text-white font-black shadow-lg">
                            {userInitials}
                        </div>
                        <div className="flex flex-col">
                            <span className="text-sm font-black text-brand-charcoal uppercase truncate">{user?.email?.split('@')[0]}</span>
                            <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest flex items-center gap-1">
                                <ShieldCheck size={10} className="text-emerald-500" /> {role === 'owner' ? 'Authorized Owner' : role === 'admin' ? 'Authorized Admin' : 'Encoder'}
                            </span>
                        </div>
                        <div className="ml-4 h-8 w-[1px] bg-slate-100" />
                        <button
                            onClick={() => signOut()}
                            className="ml-2 p-3 rounded-2xl bg-slate-50 text-slate-400 hover:text-brand-red hover:bg-red-50 transition-all active:scale-90"
                            title="Sign Out"
                        >
                            <LogOut size={18} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
