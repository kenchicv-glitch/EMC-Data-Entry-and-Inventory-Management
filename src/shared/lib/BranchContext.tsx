import React, { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { useAuth } from '../hooks/useAuth';

import { BranchContext } from './BranchContextExports';
import type { BranchContextType, Branch } from './BranchContextExports';

export const BranchProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { role, branchId } = useAuth();
    const [branches, setBranches] = useState<Branch[]>([]);
    const [activeBranchId, setActiveBranchId] = useState<string | null>(() => localStorage.getItem('emc-active-branch') || branchId);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchBranches = async () => {
            const { data } = await supabase.from('branches').select('id, name').order('name');
            if (data) setBranches(data);
            setLoading(false);
        };
        fetchBranches();
    }, []);

    useEffect(() => {
        // Enforcers/Managers are locked to their profile branch
        if (role !== 'owner' && branchId && activeBranchId !== branchId) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setActiveBranchId(branchId);
        }
    }, [role, branchId, activeBranchId]);

    useEffect(() => {
        if (activeBranchId) {
            localStorage.setItem('emc-active-branch', activeBranchId);
        }
    }, [activeBranchId]);

    const currentBranchName = branches.find(b => b.id === (activeBranchId || branchId))?.name || 'Main Branch';

    const contextValue: BranchContextType = {
        branches,
        activeBranchId,
        setActiveBranchId,
        currentBranchName,
        loading
    };

    return (
        <BranchContext.Provider value={contextValue}>
            {children}
        </BranchContext.Provider>
    );
};

