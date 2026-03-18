import { useContext } from 'react';
import { BranchContext } from '../lib/BranchContextExports';
import type { BranchContextType } from '../lib/BranchContextExports';

export const useBranch = (): BranchContextType => {
    const context = useContext(BranchContext);
    if (context === undefined) {
        throw new Error('useBranch must be used within a BranchProvider');
    }
    return context;
};
