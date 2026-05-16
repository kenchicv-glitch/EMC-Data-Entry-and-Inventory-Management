import { createContext } from 'react';

export type Workspace = 'systems' | 'bir' | 'admin' | 'dsc' | null;

export interface WorkspaceContextType {
    currentWorkspace: Workspace;
    setWorkspace: (workspace: Workspace) => void;
}

export const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);
