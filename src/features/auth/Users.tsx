import { useUsers } from './hooks/useUsers';
import { UserCog, Users } from 'lucide-react';
import { useAuth } from '../../shared/hooks/useAuth';

export default function UsersPage() {
    const { role } = useAuth();
    const { users: profiles, isLoading: loading, updateRole } = useUsers();

    const toggleRole = async (id: string, currentRole: 'admin' | 'encoder') => {
        const newRole = currentRole === 'admin' ? 'encoder' : 'admin';
        await updateRole({ id, role: newRole });
    };

    return (
        <div className="space-y-6 animate-fade-in pb-10">
            <div>
                <h1 className="text-2xl font-black text-text-primary tracking-tight font-data uppercase">User Management</h1>
                <p className="text-sm text-text-muted mt-0.5">{profiles.length} registered users</p>
            </div>

            <div className="bg-bg-surface rounded-3xl border border-border-muted shadow-sm overflow-hidden">
                <table className="min-w-full">
                    <thead>
                        <tr className="bg-bg-subtle/50 border-b border-border-muted">
                            <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-text-muted">User</th>
                            <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-text-muted">Role</th>
                            <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-text-muted">Last Updated</th>
                            <th className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-text-muted">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border-muted/30">
                        {loading ? (
                            [1, 2, 3].map(i => (
                                <tr key={i}><td colSpan={4} className="px-5 py-3"><div className="h-10 skeleton rounded-lg" /></td></tr>
                            ))
                        ) : profiles.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="px-5 py-12 text-center">
                                    <div className="flex flex-col items-center gap-3">
                                        <div className="w-12 h-12 bg-bg-subtle rounded-full flex items-center justify-center">
                                            <Users size={20} className="text-text-muted" />
                                        </div>
                                        <p className="text-sm text-text-muted font-medium">No users found</p>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            profiles.map((profile) => (
                                <tr key={profile.id} className="hover:bg-bg-subtle/50 transition-colors group">
                                    <td className="whitespace-nowrap px-5 py-3.5">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-full bg-brand-red flex items-center justify-center text-white text-sm font-black flex-shrink-0 shadow-red/20 shadow-lg">
                                                {profile.full_name?.charAt(0).toUpperCase() || '?'}
                                            </div>
                                            <span className="text-sm font-semibold text-text-primary">{profile.full_name}</span>
                                        </div>
                                    </td>
                                    <td className="whitespace-nowrap px-5 py-3.5">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-widest ${profile.role === 'admin'
                                            ? 'bg-brand-red/10 text-brand-red border border-brand-red/20'
                                            : 'bg-bg-subtle text-text-muted border border-border-muted/50'
                                            }`}>
                                            {profile.role.toUpperCase()}
                                        </span>
                                    </td>
                                    <td className="whitespace-nowrap px-5 py-3.5 text-xs text-text-muted font-data">
                                        {profile.updated_at ? new Date(profile.updated_at).toLocaleDateString() : '—'}
                                    </td>
                                     <td className="whitespace-nowrap px-5 py-3.5 text-right">
                                        {role === 'owner' && (
                                            <button
                                                onClick={() => toggleRole(profile.id, profile.role)}
                                                className="flex items-center gap-1.5 ml-auto px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-text-muted hover:text-brand-red hover:bg-brand-red/10 transition-all opacity-0 group-hover:opacity-100"
                                            >
                                                <UserCog size={13} />
                                                Toggle Role
                                            </button>
                                        )}
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
