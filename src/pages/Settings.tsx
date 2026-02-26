import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import {
    Settings as SettingsIcon,
    UserCog,
    Users as UsersIcon,
    Lock
} from 'lucide-react';

interface Profile {
    id: string;
    full_name: string;
    role: 'admin' | 'encoder';
    updated_at: string;
}

export default function Settings() {
    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'users' | 'security'>('users');

    const fetchProfiles = async () => {
        setLoading(true);
        const { data, error } = await supabase.from('profiles').select('*').order('full_name');
        if (error) console.error('Error fetching profiles:', error);
        else setProfiles(data as Profile[] || []);
        setLoading(false);
    };

    useEffect(() => {
        let mounted = true;
        if (activeTab === 'users') {
            const load = async () => {
                setLoading(true);
                const { data, error } = await supabase.from('profiles').select('*').order('full_name');
                if (mounted) {
                    if (error) console.error('Error fetching profiles:', error);
                    else setProfiles(data as Profile[] || []);
                    setLoading(false);
                }
            };
            load();
        }
        return () => { mounted = false; };
    }, [activeTab]);

    const toggleRole = async (id: string, currentRole: 'admin' | 'encoder') => {
        const newRole = currentRole === 'admin' ? 'encoder' : 'admin';
        const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', id);
        if (error) alert('Error updating role: ' + error.message);
        else fetchProfiles();
    };

    return (
        <div className="space-y-8 animate-fade-in pb-12">
            <div>
                <h1 className="text-3xl font-black text-brand-charcoal tracking-tight flex items-center gap-3">
                    <div className="w-12 h-12 bg-brand-charcoal rounded-2xl flex items-center justify-center shadow-lg border border-white/5">
                        <SettingsIcon className="text-brand-red" size={24} />
                    </div>
                    Account Settings
                </h1>
                <p className="text-sm text-slate-500 mt-2 font-medium">Manage system access and account security</p>
            </div>

            <div className="flex flex-col lg:flex-row gap-8">
                {/* Sidebar Navigation */}
                <div className="w-full lg:w-64 space-y-2">
                    <button
                        onClick={() => setActiveTab('users')}
                        className={`w-full flex items-center gap-3 px-5 py-4 rounded-2xl text-sm font-black transition-all ${activeTab === 'users' ? 'bg-brand-red text-white shadow-red' : 'bg-white text-slate-500 border border-slate-200 hover:border-brand-red/30'}`}
                    >
                        <UsersIcon size={18} /> User Access
                    </button>
                    <button
                        onClick={() => setActiveTab('security')}
                        className={`w-full flex items-center gap-3 px-5 py-4 rounded-2xl text-sm font-black transition-all ${activeTab === 'security' ? 'bg-brand-red text-white shadow-red' : 'bg-white text-slate-500 border border-slate-200 hover:border-brand-red/30'}`}
                    >
                        <Lock size={18} /> Security
                    </button>
                </div>

                {/* Content Area */}
                <div className="flex-1 space-y-6">
                    {activeTab === 'users' && (
                        <div className="bento-card overflow-hidden animate-slide-up">
                            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                                <h3 className="text-sm font-black text-brand-charcoal uppercase tracking-widest flex items-center gap-2">
                                    <UsersIcon size={16} className="text-brand-red" /> Register Members
                                </h3>
                                <span className="px-3 py-1 bg-brand-red/5 text-brand-red text-[10px] font-black rounded-full uppercase tracking-widest">{profiles.length} total profiles</span>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="min-w-full">
                                    <thead>
                                        <tr className="bg-slate-50 border-b border-slate-100">
                                            <th className="px-5 py-4 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500">User Profile</th>
                                            <th className="px-5 py-4 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500">Privileges</th>
                                            <th className="px-5 py-4 text-right text-[10px] font-bold uppercase tracking-widest text-slate-500">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {loading ? (
                                            [1, 2, 3].map(i => (
                                                <tr key={i}><td colSpan={3} className="px-5 py-4"><div className="h-12 skeleton rounded-xl" /></td></tr>
                                            ))
                                        ) : profiles.map((p) => (
                                            <tr key={p.id} className="hover:bg-slate-50/50 transition-colors group">
                                                <td className="px-5 py-4 whitespace-nowrap">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-red to-brand-red-dark flex items-center justify-center text-white text-sm font-black shadow-md">
                                                            {p.full_name?.charAt(0).toUpperCase()}
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="text-sm font-black text-brand-charcoal">{p.full_name}</span>
                                                            <span className="text-[10px] text-slate-400 font-data">ID: {p.id.slice(0, 8)}...</span>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-5 py-4 whitespace-nowrap">
                                                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${p.role === 'admin'
                                                        ? 'bg-brand-charcoal text-brand-red border border-brand-red/20'
                                                        : 'bg-slate-100 text-slate-600'}`}>
                                                        {p.role}
                                                    </span>
                                                </td>
                                                <td className="px-5 py-4 text-right whitespace-nowrap">
                                                    <button
                                                        onClick={() => toggleRole(p.id, p.role)}
                                                        className="inline-flex items-center gap-2 bg-white border border-slate-200 hover:border-brand-red/30 p-2 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-600 transition-all active:scale-95"
                                                    >
                                                        <UserCog size={14} className="text-brand-red" /> Change Role
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {activeTab === 'security' && (
                        <div className="bento-card p-12 text-center animate-slide-up bg-slate-50/50 border-dashed">
                            <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center shadow-xl border border-white/5 mx-auto mb-6">
                                <Lock className="text-brand-red" size={32} />
                            </div>
                            <h3 className="text-lg font-black text-brand-charcoal uppercase tracking-tight">Security Hardening</h3>
                            <p className="text-sm text-slate-500 font-medium max-w-md mx-auto mt-2">
                                Advanced security protocols and access logs are being synchronized. Multi-factor authentication will be available in the next core update.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
