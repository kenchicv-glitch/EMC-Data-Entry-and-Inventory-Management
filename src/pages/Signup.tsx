import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate, Link } from 'react-router-dom';
import { Lock, Mail, User, ArrowRight } from 'lucide-react';
import AuthLayout from '../components/AuthLayout';

export default function Signup() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const navigate = useNavigate();

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const { error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: { full_name: fullName },
                    emailRedirectTo: `${window.location.origin}/login`,
                },
            });
            if (error) throw error;
            alert('Verification email sent! Please check your inbox.');
            navigate('/login');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred during sign up');
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
            title="Create an account"
            subtitle="Let's get started with your 30 days free trial."
            rightTitle="Join the leading platform."
            rightSubtitle="Thousands of retail businesses trust EMC Trading for their inventory and financial analysis."
        >
            <form className="space-y-5" onSubmit={handleSignup}>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1.5 ml-1">Full Name</label>
                        <div className="relative group">
                            <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-brand-red transition-colors" size={18} />
                            <input
                                type="text"
                                required
                                className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-brand-red/20 focus:border-brand-red outline-none transition-all"
                                placeholder="Your full name"
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1.5 ml-1">Email Address</label>
                        <div className="relative group">
                            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-brand-red transition-colors" size={18} />
                            <input
                                type="email"
                                required
                                className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-brand-red/20 focus:border-brand-red outline-none transition-all"
                                placeholder="Your email address"
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
                                placeholder="Create a password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>
                    </div>
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
                        {loading ? 'Creating account...' : (
                            <>
                                Create Account
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
                    Already have an account?{' '}
                    <Link to="/login" className="text-brand-red font-black border-b-2 border-transparent hover:border-brand-red transition-all">Sign In</Link>
                </p>
            </form>
        </AuthLayout>
    );
}
