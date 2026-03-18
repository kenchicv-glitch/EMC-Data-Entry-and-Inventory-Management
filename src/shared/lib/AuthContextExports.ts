import { createContext } from 'react';
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
