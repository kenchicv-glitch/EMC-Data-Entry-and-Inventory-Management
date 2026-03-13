import React, { createContext, useEffect, useState } from 'react';
import { supabase } from './supabase';
import type { Session, User } from '@supabase/supabase-js';

export interface AuthContextType {
    session: Session | null;
    user: User | null;
    role: 'owner' | 'admin' | 'encoder' | null;
    branchId: string | null;
    displayName: string | null;
    loading: boolean;
    signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [session, setSession] = useState<Session | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [role, setRole] = useState<'owner' | 'admin' | 'encoder' | null>(null);
    const [branchId, setBranchId] = useState<string | null>(null);
    const [displayName, setDisplayName] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let mounted = true;

        // Safety timeout to ensure loading screen eventually clears
        const timer = setTimeout(() => {
            if (mounted && loading) {
                console.warn('Auth loading timed out, forcing completion');
                setLoading(false);
            }
        }, 5000);

        const handleAuthAction = async (currSession: Session | null) => {
            if (!mounted) return;

            const currUser = currSession?.user ?? null;
            setSession(currSession);
            setUser(currUser);

            if (currUser) {
                try {
                    const { data, error } = await supabase
                        .from('profiles')
                        .select('role, branch_id, display_name')
                        .eq('id', currUser.id)
                        .maybeSingle();

                    if (mounted) {
                        if (error) {
                            console.error('Error fetching profile:', error);
                            setRole('encoder');
                            setBranchId(null);
                            setDisplayName(currUser.email?.split('@')[0] || 'User');
                        } else {
                            setRole(data?.role as 'owner' | 'admin' | 'encoder' ?? 'encoder');
                            setBranchId(data?.branch_id || null);
                            setDisplayName(data?.display_name || currUser.email?.split('@')[0] || 'User');
                        }
                    }
                } catch {
                    if (mounted) {
                        setRole('encoder');
                        setBranchId(null);
                    }
                } finally {
                    if (mounted) setLoading(false);
                }
            } else {
                if (mounted) {
                    setRole(null);
                    setBranchId(null);
                    setDisplayName(null);
                    setLoading(false);
                }
            }
        };

        // Get initial session
        supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
            handleAuthAction(initialSession);
        }).catch(() => {
            if (mounted) setLoading(false);
        });

        // Listen for changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            handleAuthAction(session);
        });

        return () => {
            mounted = false;
            clearTimeout(timer);
            subscription.unsubscribe();
        };
    }, []); // Removed loading dependency to prevent infinite loops if loading changes

    const signOut = async () => {
        await supabase.auth.signOut();
        localStorage.removeItem('emc-active-branch'); // Clear active branch on logout as per SOP
    };

    const value = {
        session,
        user,
        role,
        branchId,
        displayName,
        loading,
        signOut,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
