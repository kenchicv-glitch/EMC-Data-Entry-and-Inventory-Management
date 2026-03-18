import { useContext } from 'react';
import { AuthContext } from '../lib/AuthContextExports';
import type { AuthContextType } from '../lib/AuthContextExports';

export const useAuth = (): AuthContextType => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
