import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
    createStocktake,
    getStocktakeSessions,
    getStocktakeItems,
    updateStocktakeItemCount,
    completeStocktake,
    cancelStocktake,
} from '../services/stocktakeService';

export const stocktakeKeys = {
    all:      ['inventory', 'stocktakes'] as const,
    sessions: (branchId: string) => ['inventory', 'stocktakes', 'sessions', branchId] as const,
    items:    (sessionId: string) => ['inventory', 'stocktakes', 'items', sessionId] as const,
};

export function useStocktakeSessions(branchId: string | null) {
    return useQuery({
        queryKey: stocktakeKeys.sessions(branchId ?? ''),
        queryFn:  () => getStocktakeSessions(branchId!),
        enabled:  Boolean(branchId),
    });
}

export function useStocktakeItems(sessionId: string | null) {
    return useQuery({
        queryKey: stocktakeKeys.items(sessionId ?? ''),
        queryFn:  () => getStocktakeItems(sessionId!),
        enabled:  Boolean(sessionId),
    });
}

export function useCreateStocktake() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({
            branchId,
            userId,
            notes,
        }: {
            branchId: string;
            userId: string;
            notes?: string;
        }) => createStocktake(branchId, userId, notes),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: stocktakeKeys.all });
            toast.success('Stocktake session started');
        },
        onError: (e: Error) => toast.error(e.message),
    });
}

export function useUpdateStocktakeItem() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({
            itemId,
            countedQty,
            countedBy,
        }: {
            itemId: string;
            countedQty: number;
            countedBy: string;
        }) => updateStocktakeItemCount(itemId, countedQty, countedBy),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['inventory', 'stocktakes', 'items'] });
        },
        onError: (e: Error) => toast.error(e.message),
    });
}

export function useCompleteStocktake() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({
            sessionId,
            userId,
            applyAdjustments,
        }: {
            sessionId: string;
            userId: string;
            applyAdjustments: boolean;
        }) => completeStocktake(sessionId, userId, applyAdjustments),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: stocktakeKeys.all });
            qc.invalidateQueries({ queryKey: ['products'] });
            toast.success('Stocktake completed successfully');
        },
        onError: (e: Error) => toast.error(e.message),
    });
}

export function useCancelStocktake() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: cancelStocktake,
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: stocktakeKeys.all });
            toast.success('Stocktake cancelled');
        },
        onError: (e: Error) => toast.error(e.message),
    });
}
