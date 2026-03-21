import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { userService } from '../services/userService';
import { queryKeys } from '../../../shared/lib/queryKeys';
import { toast } from 'sonner';

export const useUsers = () => {
    const queryClient = useQueryClient();

    const usersQuery = useQuery({
        queryKey: queryKeys.users.list(),
        queryFn: userService.getAll,
    });

    const updateRoleMutation = useMutation({
        mutationFn: ({ id, role }: { id: string; role: 'admin' | 'encoder' }) => 
            userService.updateRole(id, role),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
            toast.success('User role updated successfully');
        },
        onError: (error: Error) => {
            toast.error(`Failed to update role: ${error.message}`);
        }
    });

    return {
        users: usersQuery.data ?? [],
        isLoading: usersQuery.isLoading,
        error: usersQuery.error,
        updateRole: updateRoleMutation.mutateAsync,
        isUpdating: updateRoleMutation.isPending,
    };
};
