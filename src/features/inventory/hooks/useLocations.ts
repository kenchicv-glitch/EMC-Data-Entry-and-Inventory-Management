import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
    getAllLocations,
    createLocation,
    updateLocation,
    deleteLocation,
} from '../services/locationService';
import type { InventoryLocation } from '../types/product';

export const locationKeys = {
    all:  ['inventory', 'locations'] as const,
    list: (branchId: string | null) => ['inventory', 'locations', 'list', branchId] as const,
};

export function useLocations(branchId?: string | null) {
    return useQuery({
        queryKey: locationKeys.list(branchId ?? null),
        queryFn:  () => getAllLocations(branchId),
    });
}

export function useCreateLocation() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (input: Omit<InventoryLocation, 'id' | 'created_at' | 'children'>) =>
            createLocation(input),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: locationKeys.all });
            toast.success('Location created');
        },
        onError: (e: Error) => toast.error(e.message),
    });
}

export function useUpdateLocation() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, input }: { id: string; input: Parameters<typeof updateLocation>[1] }) =>
            updateLocation(id, input),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: locationKeys.all });
            toast.success('Location updated');
        },
        onError: (e: Error) => toast.error(e.message),
    });
}

export function useDeleteLocation() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: deleteLocation,
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: locationKeys.all });
            toast.success('Location deleted');
        },
        onError: (e: Error) => toast.error(e.message),
    });
}
