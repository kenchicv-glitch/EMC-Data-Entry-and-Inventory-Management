import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from './supabase';
import type { Session, User } from '@supabase/supabase-js';
import { AuthContext } from './AuthContextExports';
import type { AuthContextType } from './AuthContextExports';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [session, setSession] = useState<Session | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [role, setRole] = useState<'owner' | 'admin' | 'encoder' | null>(null);
    const [branchId, setBranchId] = useState<string | null>(null);
    const [displayName, setDisplayName] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    const handleAuthAction = useCallback(async (currSession: Session | null, mounted: boolean) => {
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
            } catch (err) {
                console.error('Auth check error:', err);
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
    }, []);

    useEffect(() => {
        let mounted = true;
        const timer = setTimeout(() => {
            if (mounted) setLoading(false);
        }, 5000);

        // Get initial session
        supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
            handleAuthAction(initialSession, mounted);
        }).catch(() => {
            if (mounted) setLoading(false);
        });

        // Listen for changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            handleAuthAction(session, mounted);
        });

        return () => {
            mounted = false;
            clearTimeout(timer);
            subscription.unsubscribe();
        };
    }, [handleAuthAction]);

    const signOut = async () => {
        await supabase.auth.signOut();
        localStorage.removeItem('emc-active-branch');
    };

    const value: AuthContextType = {
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
