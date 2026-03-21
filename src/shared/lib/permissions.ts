export type Role = 'owner' | 'admin' | 'encoder';

export interface Permissions {
    canAccessMaster: boolean;
    canAccessBranchManagement: boolean;
    canAccessUserManagement: boolean;
    canMutateData: boolean; // Add, Edit, Delete, Void
    canViewDashboard: boolean;
    canViewReports: boolean;
    canViewTaxDashboard: boolean;
}

export const getRolePermissions = (role: Role | null): Permissions => {
    switch (role) {
        case 'owner':
            return {
                canAccessMaster: true,
                canAccessBranchManagement: true,
                canAccessUserManagement: true,
                canMutateData: true,
                canViewDashboard: true,
                canViewReports: true,
                canViewTaxDashboard: true,
            };
        case 'admin':
            return {
                canAccessMaster: false,
                canAccessBranchManagement: false,
                canAccessUserManagement: false,
                canMutateData: false, // Read-only
                canViewDashboard: true,
                canViewReports: true,
                canViewTaxDashboard: true,
            };
        case 'encoder':
            return {
                canAccessMaster: false,
                canAccessBranchManagement: false,
                canAccessUserManagement: false,
                canMutateData: true,
                canViewDashboard: true,
                canViewReports: true,
                canViewTaxDashboard: true,
            };
        default:
            return {
                canAccessMaster: false,
                canAccessBranchManagement: false,
                canAccessUserManagement: false,
                canMutateData: false,
                canViewDashboard: false,
                canViewReports: false,
                canViewTaxDashboard: false,
            };
    }
};
