import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { userService } from '../services/userService';
import { queryKeys } from '../lib/queryKeys';
import type { User } from '../types';

export const useUsers = () => {
    const queryClient = useQueryClient();

    const usersQuery = useQuery({
        queryKey: queryKeys.users.list(),
        queryFn: userService.getAll,
    });

    const updateUserMutation = useMutation({
        mutationFn: ({ id, user }: { id: string; user: Partial<Omit<User, 'id'>> }) =>
            userService.update(id, user),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
        },
    });

    return {
        users: usersQuery.data ?? [],
        isLoading: usersQuery.isLoading,
        error: usersQuery.error,
        updateUser: updateUserMutation.mutateAsync,
        isUpdating: updateUserMutation.isPending,
    };
};
