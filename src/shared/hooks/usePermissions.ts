import { useAuth } from './useAuth';
import { getRolePermissions, type Permissions } from '../lib/permissions';

export const usePermissions = (): Permissions => {
    const { role } = useAuth();
    return getRolePermissions(role);
};
