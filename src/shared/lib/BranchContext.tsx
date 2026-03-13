import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from './supabase';
import { useAuth } from '../hooks/useAuth';

interface Branch {
    id: string;
    name: string;
}

interface BranchContextType {
    branches: Branch[];
    activeBranchId: string | null;
    setActiveBranchId: (id: string | null) => void;
    currentBranchName: string;
    loading: boolean;
}

const BranchContext = createContext<BranchContextType | undefined>(undefined);

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
        if (role !== 'owner' && branchId) {
            setActiveBranchId(branchId);
        }
    }, [role, branchId]);

    useEffect(() => {
        if (activeBranchId) {
            localStorage.setItem('emc-active-branch', activeBranchId);
        }
    }, [activeBranchId]);

    const currentBranchName = branches.find(b => b.id === (activeBranchId || branchId))?.name || 'Main Branch';

    return (
        <BranchContext.Provider value={{ branches, activeBranchId, setActiveBranchId, currentBranchName, loading }}>
            {children}
        </BranchContext.Provider>
    );
};

export const useBranch = () => {
    const context = useContext(BranchContext);
    if (context === undefined) {
        throw new Error('useBranch must be used within a BranchProvider');
    }
    return context;
};
