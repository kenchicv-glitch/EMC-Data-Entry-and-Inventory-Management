import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { UserCog, Users } from 'lucide-react';

interface Profile {
    id: string;
    full_name: string;
    role: 'admin' | 'encoder';
    updated_at: string;
}

export default function UsersPage() {
    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchProfiles = async () => {
        setLoading(true);
        const { data, error } = await supabase.from('profiles').select('*').order('full_name');
        if (error) {
            console.error('Error fetching profiles:', error);
            setProfiles([]);
        } else {
            setProfiles(data as Profile[] || []);
        }
        setLoading(false);
    };

    useEffect(() => {
        let mounted = true;
        const loadProfiles = async () => {
            setLoading(true);
            const { data, error } = await supabase.from('profiles').select('*').order('full_name');
            if (mounted) {
                if (error) {
                    console.error('Error fetching profiles:', error);
                    setProfiles([]);
                } else {
                    setProfiles(data as Profile[] || []);
                }
                setLoading(false);
            }
        };
        loadProfiles();
        return () => { mounted = false; };
    }, []);

    const toggleRole = async (id: string, currentRole: 'admin' | 'encoder') => {
        const newRole = currentRole === 'admin' ? 'encoder' : 'admin';
        const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', id);
        if (error) alert('Error updating role: ' + error.message);
        else fetchProfiles();
    };

    return (
        <div className="space-y-6 animate-fade-in">
            <div>
                <h1 className="text-2xl font-black text-brand-charcoal tracking-tight font-data">USER MANAGEMENT</h1>
                <p className="text-sm text-slate-500 mt-0.5">{profiles.length} registered users</p>
            </div>

            <div className="bento-card overflow-hidden">
                <table className="min-w-full">
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-100">
                            <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500">User</th>
                            <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500">Role</th>
                            <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500">Last Updated</th>
                            <th className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-slate-500">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {loading ? (
                            [1, 2, 3].map(i => (
                                <tr key={i}><td colSpan={4} className="px-5 py-3"><div className="h-10 skeleton rounded-lg" /></td></tr>
                            ))
                        ) : profiles.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="px-5 py-12 text-center">
                                    <div className="flex flex-col items-center gap-3">
                                        <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center">
                                            <Users size={20} className="text-slate-400" />
                                        </div>
                                        <p className="text-sm text-slate-500 font-medium">No users found</p>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            profiles.map((profile) => (
                                <tr key={profile.id} className="hover:bg-slate-50/80 transition-colors group">
                                    <td className="whitespace-nowrap px-5 py-3.5">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-full bg-brand-red flex items-center justify-center text-white text-sm font-black flex-shrink-0">
                                                {profile.full_name?.charAt(0).toUpperCase() || '?'}
                                            </div>
                                            <span className="text-sm font-semibold text-slate-800">{profile.full_name}</span>
                                        </div>
                                    </td>
                                    <td className="whitespace-nowrap px-5 py-3.5">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${profile.role === 'admin'
                                            ? 'bg-brand-charcoal text-brand-red'
                                            : 'bg-slate-100 text-slate-600'
                                            }`}>
                                            {profile.role.toUpperCase()}
                                        </span>
                                    </td>
                                    <td className="whitespace-nowrap px-5 py-3.5 text-xs text-slate-500 font-data">
                                        {profile.updated_at ? new Date(profile.updated_at).toLocaleDateString() : '—'}
                                    </td>
                                    <td className="whitespace-nowrap px-5 py-3.5 text-right">
                                        <button
                                            onClick={() => toggleRole(profile.id, profile.role)}
                                            className="flex items-center gap-1.5 ml-auto px-3 py-1.5 rounded-lg text-xs font-bold text-brand-red hover:bg-brand-red-light transition-all opacity-0 group-hover:opacity-100"
                                        >
                                            <UserCog size={13} />
                                            Toggle Role
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
