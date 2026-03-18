import { createContext } from 'react';

export interface Branch {
    id: string;
    name: string;
}

export interface BranchContextType {
    branches: Branch[];
    activeBranchId: string | null;
    setActiveBranchId: (id: string | null) => void;
    currentBranchName: string;
    loading: boolean;
}

export const BranchContext = createContext<BranchContextType | undefined>(undefined);
