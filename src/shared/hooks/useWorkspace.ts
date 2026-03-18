import { useContext } from 'react';
import { WorkspaceContext } from '../lib/WorkspaceContextExports';
import type { WorkspaceContextType } from '../lib/WorkspaceContextExports';

export const useWorkspace = (): WorkspaceContextType => {
    const context = useContext(WorkspaceContext);
    if (context === undefined) {
        throw new Error('useWorkspace must be used within a WorkspaceProvider');
    }
    return context;
};
