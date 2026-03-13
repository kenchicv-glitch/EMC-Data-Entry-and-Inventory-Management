import { useState, useEffect } from 'react';
import { supabase } from '../../shared/lib/supabase';
import {
    Settings as SettingsIcon,
    Users as UsersIcon,
    Trash2,
    ShieldCheck,
    AlertTriangle
} from 'lucide-react';
import { useAuth } from '../../shared/hooks/useAuth';

interface Profile {
    id: string;
    full_name: string;
    email?: string;
    role: 'owner' | 'admin' | 'encoder';
    branch_id?: string;
    updated_at: string;
}

export default function Settings() {
    const { role, user } = useAuth();
    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [loading, setLoading] = useState(true);
    const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

    const fetchProfiles = async () => {
        setLoading(true);
        const { data, error } = await supabase.from('profiles').select('*').order('full_name');
        if (error) console.error('Error fetching profiles:', error);
        else setProfiles(data as Profile[] || []);
        setLoading(false);
    };

    useEffect(() => {
        fetchProfiles();
    }, []);

    const handleRoleChange = async (id: string, newRole: string) => {
        // Try RPC first (updates both profiles AND auth.users metadata)
        const { error: rpcError } = await supabase.rpc('update_user_role', {
            target_user_id: id,
            new_role: newRole
        });

        if (rpcError) {
            // Fallback: update profiles table directly
            console.warn('RPC not available, falling back to direct update:', rpcError.message);
            const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', id);
            if (error) {
                alert('Error updating role: ' + error.message);
                return;
            }
        }
        fetchProfiles();
    };

    const handleDeleteAccount = async (id: string, name: string) => {
        if (id === user?.id) {
            alert('You cannot delete your own account.');
            return;
        }
        if (!window.confirm(`Are you sure you want to remove "${name}"? This will permanently delete their account from the system.`)) return;

        // Try RPC first (deletes from both profiles AND auth.users)
        const { error: rpcError } = await supabase.rpc('delete_user_account', {
            target_user_id: id
        });

        if (rpcError) {
            // Fallback: delete from profiles only
            console.warn('RPC not available, falling back to direct delete:', rpcError.message);
            const { error } = await supabase.from('profiles').delete().eq('id', id);
            if (error) {
                alert('Error removing account: ' + error.message);
                return;
            }
        }
        setConfirmDelete(null);
        fetchProfiles();
    };

    const roleColors: Record<string, string> = {
        owner: 'bg-brand-red/10 text-brand-red border-brand-red/20',
        admin: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
        encoder: 'bg-bg-subtle text-text-muted border-border-default'
    };

    return (
        <div className="space-y-6 animate-fade-in pb-12">
            <div className="flex items-center gap-3">
                <div className="w-11 h-11 bg-bg-surface rounded-[18px] flex items-center justify-center shadow-lg border border-border-default">
                    <SettingsIcon className="text-brand-red" size={24} />
                </div>
                <div>
                    <h1 className="text-xl font-black text-text-primary tracking-tight">Branch Management</h1>
                    <p className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em]">Manage accounts, roles & access control</p>
                </div>
            </div>

            {/* User Access Table */}
            <div className="bg-bg-surface rounded-[24px] border border-border-default shadow-sm overflow-hidden">
                <div className="p-5 border-b border-border-default flex items-center justify-between bg-bg-subtle/30">
                    <h3 className="text-xs font-black text-text-primary uppercase tracking-widest flex items-center gap-2">
                        <UsersIcon size={14} className="text-brand-red" /> Registered Accounts
                    </h3>
                    <span className="px-3 py-1 bg-brand-red/10 text-brand-red text-[10px] font-black rounded-full uppercase tracking-widest border border-brand-red/20">
                        {profiles.length} accounts
                    </span>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full">
                        <thead>
                            <tr className="bg-bg-subtle/30 border-b border-border-default">
                                <th className="px-5 py-3 text-left text-[9px] font-black uppercase tracking-widest text-text-muted">User</th>
                                <th className="px-5 py-3 text-left text-[9px] font-black uppercase tracking-widest text-text-muted">Role</th>
                                <th className="px-5 py-3 text-center text-[9px] font-black uppercase tracking-widest text-text-muted">Change Role</th>
                                <th className="px-5 py-3 text-right text-[9px] font-black uppercase tracking-widest text-text-muted">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border-default/30">
                            {loading ? (
                                [1, 2, 3].map(i => (
                                    <tr key={i}><td colSpan={4} className="px-5 py-4"><div className="h-12 skeleton rounded-xl" /></td></tr>
                                ))
                            ) : profiles.map((p) => {
                                const isCurrentUser = p.id === user?.id;
                                return (
                                    <tr key={p.id} className="hover:bg-bg-subtle/50 transition-colors group">
                                        <td className="px-5 py-3.5 whitespace-nowrap">
                                            <div className="flex items-center gap-3">
                                                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-red to-brand-red-dark flex items-center justify-center text-white text-xs font-black shadow-md">
                                                    {p.full_name?.charAt(0).toUpperCase() || '?'}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-black text-text-primary flex items-center gap-1.5">
                                                        {p.full_name || 'Unknown'}
                                                        {isCurrentUser && <span className="text-[8px] font-black text-brand-red">(You)</span>}
                                                    </span>
                                                    <span className="text-[9px] text-text-muted font-data">{p.id.slice(0, 12)}...</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-5 py-3.5 whitespace-nowrap">
                                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${roleColors[p.role] || roleColors.encoder}`}>
                                                {p.role === 'owner' && <ShieldCheck size={10} />}
                                                {p.role}
                                            </span>
                                        </td>
                                        <td className="px-5 py-3.5 text-center whitespace-nowrap">
                                            {role === 'owner' && !isCurrentUser ? (
                                                <select
                                                    value={p.role}
                                                    onChange={(e) => handleRoleChange(p.id, e.target.value)}
                                                    className="bg-bg-subtle border border-border-default rounded-xl px-3 py-1.5 text-[10px] font-black text-text-primary uppercase tracking-widest cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-red/30 transition-all"
                                                >
                                                    <option value="encoder">Encoder</option>
                                                    <option value="admin">Admin</option>
                                                    <option value="owner">Owner</option>
                                                </select>
                                            ) : (
                                                <span className="text-[9px] text-text-muted font-bold">—</span>
                                            )}
                                        </td>
                                        <td className="px-5 py-3.5 text-right whitespace-nowrap">
                                            {role === 'owner' && !isCurrentUser ? (
                                                confirmDelete === p.id ? (
                                                    <div className="flex items-center gap-2 justify-end animate-fade-in">
                                                        <button
                                                            onClick={() => handleDeleteAccount(p.id, p.full_name)}
                                                            className="flex items-center gap-1 px-3 py-1.5 bg-red-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-red-700 transition-all active:scale-95"
                                                        >
                                                            <AlertTriangle size={10} /> Confirm
                                                        </button>
                                                        <button
                                                            onClick={() => setConfirmDelete(null)}
                                                            className="px-3 py-1.5 bg-bg-subtle text-text-muted rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-bg-muted transition-all"
                                                        >
                                                            Cancel
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={() => setConfirmDelete(p.id)}
                                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-bg-subtle border border-border-default hover:border-red-500/30 rounded-xl text-[9px] font-black uppercase tracking-widest text-text-muted hover:text-red-600 transition-all active:scale-95"
                                                    >
                                                        <Trash2 size={12} /> Remove
                                                    </button>
                                                )
                                            ) : (
                                                <span className="text-[9px] text-text-muted font-bold">—</span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
