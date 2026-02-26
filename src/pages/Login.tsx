import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { Lock, User, ArrowRight } from 'lucide-react';
import logo from '../assets/brand-logo.png';

export default function Login() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const navigate = useNavigate();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            // Internal mapping: usernames are converted to virtual emails
            const email = username.includes('@') ? username : `${username}@emc.internal`;

            const { error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });
            if (error) throw error;
            navigate('/');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred during sign in');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen relative flex flex-col justify-center items-center p-4 sm:p-6 lg:p-8 font-sans overflow-hidden">
            {/* Dynamic Background Elements - Darker & Sharper */}
            <div className="fixed inset-0 bg-[#0a0a0b] z-0">
                {/* Darker Background Blobs with significantly higher opacity and deep red */}
                <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-brand-red-deep/30 rounded-full blur-[80px] animate-pulse"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[70%] h-[70%] bg-brand-red-deep/20 rounded-full blur-[70px] animate-pulse" style={{ animationDelay: '2s' }}></div>
                <div className="absolute top-[20%] right-[10%] w-[40%] h-[40%] bg-brand-red-deep/20 rounded-full blur-[60px] animate-pulse" style={{ animationDelay: '1s' }}></div>

                {/* More distinct moving spheres with deeper contrast */}
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-brand-red-deep/15 rounded-full blur-[60px] animate-blob"></div>
                <div className="absolute bottom-1/4 right-1/4 w-[30rem] h-[30rem] bg-brand-red-deep/10 rounded-full blur-[70px] animate-blob-reverse" style={{ animationDelay: '3s' }}></div>

                {/* Deep Background Noise/Mesh for texture */}
                <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')]"></div>
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
                @keyframes blob {
                    0% { transform: translate(0px, 0px) scale(1); }
                    33% { transform: translate(60px, -80px) scale(1.2); }
                    66% { transform: translate(-50px, 50px) scale(0.85); }
                    100% { transform: translate(0px, 0px) scale(1); }
                }
                @keyframes blob-reverse {
                    0% { transform: translate(0px, 0px) scale(1); }
                    33% { transform: translate(-70px, 50px) scale(1.15); }
                    66% { transform: translate(50px, -60px) scale(0.9); }
                    100% { transform: translate(0px, 0px) scale(1); }
                }
                @keyframes shake {
                    0%, 100% { transform: translateX(0); }
                    10%, 30%, 50%, 70%, 90% { transform: translateX(-4px); }
                    20%, 40%, 60%, 80% { transform: translateX(4px); }
                }
                .animate-blob { 
                    animation: blob 15s infinite ease-in-out; 
                }
                .animate-blob-reverse { 
                    animation: blob-reverse 20s infinite ease-in-out; 
                }
                .animate-shake { 
                    animation: shake 0.5s cubic-bezier(.36,.07,.19,.97) both; 
                }
            `}} />

            <div className="w-full max-w-[480px] relative z-10 transition-all duration-700 ease-out">
                {/* Logo & Branding */}
                <div className="flex flex-col items-center mb-10">
                    <div className="w-24 h-24 bg-white rounded-[2rem] flex items-center justify-center shadow-[0_20px_40px_rgba(226,29,29,0.15)] p-4 border border-white/80 mb-6 transition-all hover:scale-110 hover:rotate-2 duration-500">
                        <img src={logo} alt="EMC Logo" className="w-full h-full object-contain" />
                    </div>
                    <div className="text-center group cursor-default">
                        <h2 className="text-3xl font-black text-white tracking-tighter leading-none mb-1 transition-all group-hover:text-brand-red duration-500">EMC TRADING</h2>
                        <span className="text-[12px] text-brand-red font-black uppercase tracking-[0.6em] block transition-all group-hover:tracking-[0.8em] duration-500">Systems</span>
                    </div>
                </div>

                {/* Login Card with Bold Black Outline */}
                <div className="bg-white/90 backdrop-blur-[32px] rounded-[3.5rem] shadow-[0_40px_100px_rgba(0,0,0,0.3),0_20px_40px_rgba(226,29,29,0.15)] border border-black/10 p-10 sm:p-14 relative overflow-hidden group/card transition-all duration-700 hover:shadow-[0_50px_120px_rgba(226,29,29,0.25)] hover:bg-white">
                    <div className="absolute inset-0 border-2 border-black rounded-[3.5rem] pointer-events-none"></div>
                    {/* Visual accents for depth */}
                    <div className="absolute top-0 right-0 w-48 h-48 bg-brand-red/10 rounded-full -mr-24 -mt-24 blur-3xl group-hover/card:bg-brand-red/20 transition-all duration-700"></div>
                    <div className="absolute bottom-0 left-0 w-32 h-32 bg-brand-red/5 rounded-full -ml-16 -mb-16 blur-2xl group-hover/card:bg-brand-red/15 transition-all duration-700"></div>

                    <div className="relative z-10">
                        <div className="mb-10 text-center sm:text-left">
                            <h1 className="text-4xl font-black text-slate-900 mb-3 tracking-tight">Login Portal</h1>
                            <p className="text-slate-500 font-semibold text-lg flex items-center gap-2">
                                <span className="w-1.5 h-1.5 bg-brand-red rounded-full animate-pulse"></span>
                                Secure company access
                            </p>
                        </div>

                        <form className="space-y-8" onSubmit={handleLogin}>
                            <div className="space-y-6">
                                <div className="space-y-3">
                                    <label className="block text-sm font-black text-slate-800 ml-1 uppercase tracking-[0.2em] opacity-80">Username</label>
                                    <div className="relative group/input">
                                        <User className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within/input:text-brand-red transition-all duration-300 group-hover/input:text-slate-600" size={20} />
                                        <input
                                            type="text"
                                            required
                                            className="w-full pl-14 pr-6 py-5 bg-white/40 border-2 border-slate-200 rounded-[1.5rem] text-sm font-black focus:ring-8 focus:ring-brand-red/5 focus:border-black outline-none transition-all duration-300 group-hover/input:border-slate-400 group-hover/input:bg-white"
                                            placeholder="admin / encoder"
                                            value={username}
                                            onChange={(e) => setUsername(e.target.value)}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <div className="flex items-center justify-between ml-1">
                                        <label className="text-sm font-black text-slate-800 uppercase tracking-wider opacity-80">Security Key</label>
                                        <button type="button" className="text-xs font-black text-brand-red hover:text-brand-red-dark hover:underline underline-offset-4 transition-all duration-300">Reset?</button>
                                    </div>
                                    <div className="relative group/input">
                                        <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within/input:text-brand-red transition-all duration-300 group-hover/input:text-slate-600" size={20} />
                                        <input
                                            type="password"
                                            required
                                            className="w-full pl-14 pr-6 py-5 bg-white/40 border-2 border-slate-200 rounded-[1.5rem] text-sm font-black focus:ring-8 focus:ring-brand-red/5 focus:border-black outline-none transition-all duration-300 group-hover/input:border-slate-400 group-hover/input:bg-white"
                                            placeholder="••••••••"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center ml-1">
                                <label className="flex items-center cursor-pointer group/check">
                                    <div className="relative">
                                        <input
                                            id="remember"
                                            type="checkbox"
                                            className="peer sr-only"
                                        />
                                        <div className="w-6 h-6 bg-white border-2 border-slate-200 rounded-lg peer-checked:bg-brand-red peer-checked:border-brand-red transition-all duration-300 group-hover/check:border-brand-red/50"></div>
                                        <svg className="absolute top-1 left-1 w-4 h-4 text-white scale-0 peer-checked:scale-100 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7" />
                                        </svg>
                                    </div>
                                    <span className="ml-4 text-sm font-bold text-slate-500 group-hover/check:text-slate-800 transition-colors">Trust this device</span>
                                </label>
                            </div>

                            {error && (
                                <div className="p-5 bg-red-50 border-2 border-red-200 rounded-[1.5rem] text-sm font-black text-red-600 animate-shake flex items-center gap-4">
                                    <div className="w-2.5 h-2.5 bg-red-600 rounded-full animate-pulse shadow-[0_0_15px_rgba(226,29,29,0.6)]"></div>
                                    {error}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full flex items-center justify-center gap-4 py-6 bg-brand-charcoal hover:bg-black text-white rounded-[1.5rem] border-2 border-black font-black text-xl transition-all shadow-2xl shadow-brand-red/40 active:scale-[0.97] active:shadow-inner disabled:opacity-50 mt-4 group/btn"
                            >
                                {loading ? (
                                    <div className="flex items-center gap-3">
                                        <div className="w-5 h-5 border-3 border-white/30 border-t-white rounded-full animate-spin"></div>
                                        <span>Authenticated...</span>
                                    </div>
                                ) : (
                                    <>
                                        Sign In
                                        <ArrowRight size={22} className="group-hover/btn:translate-x-3 transition-transform duration-500" />
                                    </>
                                )}
                            </button>
                        </form>
                    </div>
                </div>

                <div className="mt-16 text-center text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] opacity-50 hover:opacity-100 transition-all duration-500 cursor-default">
                    &copy; {new Date().getFullYear()} E.M. Cayetano Trading &bull; Proprietary System
                </div>
            </div>
        </div>
    );
}
