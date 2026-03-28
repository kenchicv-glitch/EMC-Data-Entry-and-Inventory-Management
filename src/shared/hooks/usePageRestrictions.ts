import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export function usePageRestrictions() {
    const [restrictedPaths, setRestrictedPaths] = useState<string[]>([]);
    const [loadingRestrictions, setLoadingRestrictions] = useState(true);

    const fetchRestrictions = async () => {
        try {
            const { data, error } = await supabase
                .from('page_restrictions')
                .select('pathname')
                .eq('is_restricted', true);

            if (error) throw error;
            setRestrictedPaths(data.map(r => r.pathname));
        } catch (error) {
            console.error('Error fetching page restrictions:', error);
        } finally {
            setLoadingRestrictions(false);
        }
    };

    useEffect(() => {
        fetchRestrictions();

        // Subscribe to real-time changes if someone toggles it
        const channel = supabase.channel('page_restrictions_changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'page_restrictions' }, () => {
                fetchRestrictions();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const toggleRestriction = async (pathname: string, isNowRestricted: boolean) => {
        try {
            // Optimistic update
            if (isNowRestricted) {
                setRestrictedPaths(prev => [...new Set([...prev, pathname])]);
            } else {
                setRestrictedPaths(prev => prev.filter(p => p !== pathname));
            }

            if (isNowRestricted) {
                const { error } = await supabase.from('page_restrictions').upsert({
                    pathname,
                    is_restricted: true
                });
                if (error) throw error;
            } else {
                const { error } = await supabase.from('page_restrictions').delete().eq('pathname', pathname);
                if (error) throw error;
            }
        } catch (error) {
            console.error('Error toggling restriction:', error);
            // Revert on failure
            fetchRestrictions();
        }
    };

    const batchToggleRestriction = async (paths: string[], isNowRestricted: boolean) => {
        try {
            // Optimistic update
            if (isNowRestricted) {
                setRestrictedPaths(prev => [...new Set([...prev, ...paths])]);
            } else {
                setRestrictedPaths(prev => prev.filter(p => !paths.includes(p)));
            }

            if (isNowRestricted) {
                const updates = paths.map(pathname => ({ pathname, is_restricted: true }));
                const { error } = await supabase.from('page_restrictions').upsert(updates);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('page_restrictions').delete().in('pathname', paths);
                if (error) throw error;
            }
        } catch (error) {
            console.error('Error toggling restrictions:', error);
            fetchRestrictions();
            throw error;
        }
    };

    return { restrictedPaths, loadingRestrictions, toggleRestriction, batchToggleRestriction };
}
