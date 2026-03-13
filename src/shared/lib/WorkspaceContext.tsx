import React, { createContext, useContext, useState } from 'react';

export type Workspace = 'systems' | 'bir' | 'admin' | null;

interface WorkspaceContextType {
    currentWorkspace: Workspace;
    setWorkspace: (workspace: Workspace) => void;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

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

    return (
        <WorkspaceContext.Provider value={{ currentWorkspace, setWorkspace }}>
            {children}
        </WorkspaceContext.Provider>
    );
};

export const useWorkspace = () => {
    const context = useContext(WorkspaceContext);
    if (context === undefined) {
        throw new Error('useWorkspace must be used within a WorkspaceProvider');
    }
    return context;
};
