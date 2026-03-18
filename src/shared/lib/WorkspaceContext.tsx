import React, { useState } from 'react';

import { WorkspaceContext } from './WorkspaceContextExports';
import type { WorkspaceContextType, Workspace } from './WorkspaceContextExports';

export const WorkspaceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [currentWorkspace, setCurrentWorkspace] = useState<Workspace>(() => {
        const saved = localStorage.getItem('emc_workspace');
        return (saved as Workspace) || null;
    });

    const setWorkspace = (workspace: Workspace) => {
        setCurrentWorkspace(workspace);
        if (workspace) {
            localStorage.setItem('emc_workspace', workspace);
        } else {
            localStorage.removeItem('emc_workspace');
        }
    };

    const contextValue: WorkspaceContextType = {
        currentWorkspace,
        setWorkspace
    };

    return (
        <WorkspaceContext.Provider value={contextValue}>
            {children}
        </WorkspaceContext.Provider>
    );
};

