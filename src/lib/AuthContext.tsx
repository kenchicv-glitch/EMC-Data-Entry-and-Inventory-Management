import React, { useEffect, useState } from 'react';
import { supabase } from './supabase';
import type { Session, User } from '@supabase/supabase-js';
import { AuthContext } from './auth-context';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [session, setSession] = useState<Session | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [role, setRole] = useState<'admin' | 'encoder' | null>(null);
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
                        .select('role')
                        .eq('id', currUser.id)
                        .maybeSingle();

                    if (mounted) {
                        if (error) {
                            console.error('Error fetching role:', error);
                            setRole('encoder');
                        } else {
                            setRole(data?.role as 'admin' | 'encoder' ?? 'encoder');
                        }
                    }
                } catch {
                    if (mounted) setRole('encoder');
                } finally {
                    if (mounted) setLoading(false);
                }
            } else {
                if (mounted) {
                    setRole(null);
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
    }, [loading]);

    const signOut = async () => {
        await supabase.auth.signOut();
    };

    const value = {
        session,
        user,
        role,
        loading,
        signOut,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
