import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate, Link } from 'react-router-dom';
import { Lock, Mail, ArrowRight } from 'lucide-react';
import AuthLayout from '../components/AuthLayout';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const navigate = useNavigate();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
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

    const handleGoogleLogin = async () => {
        try {
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: `${window.location.origin}/`,
                },
            });
            if (error) throw error;
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred during Google sign in');
        }
    };

    return (
        <AuthLayout
            title="Welcome back"
            subtitle="Please enter your details to sign in to your account."
            rightTitle="Manage your business with ease."
            rightSubtitle="The most trusted and leading secure platform for retail inventory and sales management."
        >
            <form className="space-y-5" onSubmit={handleLogin}>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1.5 ml-1">Email Address</label>
                        <div className="relative group">
                            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-brand-red transition-colors" size={18} />
                            <input
                                type="email"
                                required
                                className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-brand-red/20 focus:border-brand-red outline-none transition-all"
                                placeholder="Enter your email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1.5 ml-1">Password</label>
                        <div className="relative group">
                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-brand-red transition-colors" size={18} />
                            <input
                                type="password"
                                required
                                className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-brand-red/20 focus:border-brand-red outline-none transition-all"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                <div className="flex items-center justify-between">
                    <div className="flex items-center">
                        <input id="remember" type="checkbox" className="w-4 h-4 text-brand-red border-slate-300 rounded focus:ring-brand-red" />
                        <label htmlFor="remember" className="ml-2 text-xs font-bold text-slate-500">Remember for 30 days</label>
                    </div>
                    <button type="button" className="text-xs font-bold text-brand-red hover:text-brand-red-dark">Forgot password?</button>
                </div>

                {error && (
                    <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-xs font-bold text-red-600 animate-shake">
                        {error}
                    </div>
                )}

                <div className="space-y-3 pt-2">
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full flex items-center justify-center gap-2 py-3.5 bg-brand-charcoal hover:bg-black text-white rounded-2xl font-black text-sm transition-all shadow-lg active:scale-[0.98] disabled:opacity-50"
                    >
                        {loading ? 'Signing in...' : (
                            <>
                                Sign In
                                <ArrowRight size={18} />
                            </>
                        )}
                    </button>

                    <button
                        type="button"
                        onClick={handleGoogleLogin}
                        className="w-full flex items-center justify-center gap-3 py-3.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-2xl font-bold text-sm transition-all"
                    >
                        <img src="https://www.google.com/favicon.ico" alt="Google" className="w-4 h-4" />
                        Continue with Google
                    </button>
                </div>

                <p className="text-center text-sm text-slate-500 font-medium">
                    Don't have an account?{' '}
                    <Link to="/signup" className="text-brand-red font-black border-b-2 border-transparent hover:border-brand-red transition-all">Sign Up</Link>
                </p>
            </form>
        </AuthLayout>
    );
}
