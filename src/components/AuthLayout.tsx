import React from 'react';
import logo from '../assets/brand-logo.png';

interface AuthLayoutProps {
    children: React.ReactNode;
    title: string;
    subtitle: string;
    rightTitle: string;
    rightSubtitle: string;
}

export default function AuthLayout({ children, title, subtitle, rightTitle, rightSubtitle }: AuthLayoutProps) {
    return (
        <div className="flex min-h-screen bg-white font-sans overflow-hidden">
            {/* Left Side - Form */}
            <div className="flex-1 flex flex-col justify-center px-8 sm:px-12 lg:px-24 xl:px-32 max-w-2xl bg-white relative">
                <div className="mb-12">
                    <div className="flex items-center gap-4 mb-8">
                        <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-2xl p-2 border border-slate-100">
                            <img src={logo} alt="EMC Logo" className="w-full h-full object-contain" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-lg font-black text-brand-charcoal tracking-tight leading-none">EMC TRADING</span>
                            <span className="text-[10px] text-brand-red font-black uppercase tracking-[0.3em] mt-1">Systems</span>
                        </div>
                    </div>
                    <h1 className="text-4xl font-black text-slate-900 mb-2">{title}</h1>
                    <p className="text-slate-500 font-medium">{subtitle}</p>
                </div>

                <div className="w-full">
                    {children}
                </div>

                <div className="mt-12 text-center text-sm text-slate-400">
                    &copy; {new Date().getFullYear()} E.M. Cayetano Trading. All rights reserved.
                </div>
            </div>

            {/* Right Side - Visuals */}
            <div className="hidden lg:flex flex-1 relative bg-gradient-to-br from-brand-red via-brand-red to-brand-charcoal items-center justify-center p-20">
                {/* Decorative Elements (Candlesticks visual simulation) */}
                <div className="absolute inset-0 overflow-hidden opacity-30 pointer-events-none">
                    <div className="absolute top-[20%] left-[10%] w-[2px] h-40 bg-white/20">
                        <div className="absolute top-1/4 left-[-6px] w-4 h-16 bg-white/40 rounded-sm"></div>
                    </div>
                    <div className="absolute top-[40%] left-[30%] w-[2px] h-60 bg-white/20">
                        <div className="absolute top-1/3 left-[-6px] w-4 h-24 bg-white/60 rounded-sm shadow-[0_0_20px_rgba(255,255,255,0.3)]"></div>
                    </div>
                    <div className="absolute top-[10%] left-[50%] w-[2px] h-32 bg-white/20">
                        <div className="absolute top-1/2 left-[-6px] w-4 h-12 bg-white/30 rounded-sm"></div>
                    </div>
                    <div className="absolute top-[50%] left-[70%] w-[2px] h-48 bg-white/20">
                        <div className="absolute top-1/4 left-[-6px] w-4 h-20 bg-white/50 rounded-sm shadow-[0_0_15px_rgba(255,255,255,0.2)]"></div>
                    </div>
                    <div className="absolute top-[30%] left-[90%] w-[2px] h-52 bg-white/20">
                        <div className="absolute top-1/2 left-[-6px] w-4 h-28 bg-white/40 rounded-sm"></div>
                    </div>
                </div>

                {/* Content Overlay */}
                <div className="relative z-10 text-white max-w-lg">
                    <h2 className="text-6xl font-black mb-8 leading-tight tracking-tighter">
                        {rightTitle}
                    </h2>
                    <p className="text-xl font-medium text-white/80 leading-relaxed">
                        {rightSubtitle}
                    </p>
                </div>

                {/* Glassmorphism Circle */}
                <div className="absolute bottom-[-10%] right-[-5%] w-96 h-96 bg-white/10 rounded-full blur-3xl"></div>
                <div className="absolute top-[-10%] left-[-5%] w-64 h-64 bg-brand-red-light/30 rounded-full blur-3xl"></div>
            </div>
        </div>
    );
}
