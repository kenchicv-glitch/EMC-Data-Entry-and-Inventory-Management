import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
    ClipboardList,
    Plus,
    Download,
    CheckCircle,
    XCircle,
    Clock,
    AlertTriangle,
    ArrowLeft,
} from 'lucide-react';
import { format } from 'date-fns';
import { useBranch } from '../../../shared/hooks/useBranch';
import { useAuth } from '../../../shared/hooks/useAuth';
import {
    useStocktakeSessions,
    useStocktakeItems,
    useCreateStocktake,
    useUpdateStocktakeItem,
    useCompleteStocktake,
    useCancelStocktake,
} from '../hooks/useStocktake';
import StocktakeTable from '../components/StocktakeTable';
import { exportStocktakeSheet } from '../services/inventoryExportService';
import type { StocktakeSession } from '../types/product';

const STATUS_COLORS: Record<StocktakeSession['status'], string> = {
    draft:       'text-text-muted bg-bg-subtle border-border-default',
    in_progress: 'text-amber-500 bg-amber-500/10 border-amber-500/30',
    completed:   'text-emerald-500 bg-emerald-500/10 border-emerald-500/30',
    cancelled:   'text-red-500 bg-red-500/10 border-red-500/30',
};

const STATUS_ICONS: Record<StocktakeSession['status'], React.ReactNode> = {
    draft:       <Clock size={12} />,
    in_progress: <AlertTriangle size={12} />,
    completed:   <CheckCircle size={12} />,
    cancelled:   <XCircle size={12} />,
};

export default function StocktakePage() {
    const { activeBranchId } = useBranch();
    const { user } = useAuth();
    const userId = user?.id ?? '';

    const { data: sessions = [] } = useStocktakeSessions(activeBranchId);
    const createMutation = useCreateStocktake();
    const updateItemMutation = useUpdateStocktakeItem();
    const completeMutation = useCompleteStocktake();
    const cancelMutation = useCancelStocktake();

    const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
    const [showUncountedOnly, setShowUncountedOnly] = useState(false);
    const [applyAdjustments, setApplyAdjustments] = useState(true);

    const { data: activeItems = [] } = useStocktakeItems(activeSessionId);
    const activeSession = sessions.find(s => s.id === activeSessionId);

    const handleCreate = () => {
        if (!activeBranchId || !userId) return;
        createMutation.mutate(
            { branchId: activeBranchId, userId },
            { onSuccess: (session) => setActiveSessionId(session.id) }
        );
    };

    const handleComplete = () => {
        if (!activeSessionId || !userId) return;
        const uncounted = activeItems.filter(i => i.counted_qty === null).length;
        if (uncounted > 0) {
            if (!confirm(`${uncounted} items have not been counted. Complete anyway?`)) return;
        }
        completeMutation.mutate(
            { sessionId: activeSessionId, userId, applyAdjustments },
            { onSuccess: () => setActiveSessionId(null) }
        );
    };

    const handleCancel = () => {
        if (!activeSessionId) return;
        if (!confirm('Cancel this stocktake session?')) return;
        cancelMutation.mutate(activeSessionId, { onSuccess: () => setActiveSessionId(null) });
    };

    const countedCount = activeItems.filter(i => i.counted_qty !== null).length;
    const varianceCount = activeItems.filter(i => i.variance !== null && i.variance !== 0).length;

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link
                        to="/inventory"
                        className="p-2 rounded-xl border border-border-default text-text-muted hover:text-text-primary hover:bg-bg-subtle transition-all"
                        title="Back to Inventory"
                    >
                        <ArrowLeft size={16} />
                    </Link>
                    <div>
                        <h2 className="text-base font-black text-text-primary">Physical Stocktake</h2>
                        <p className="text-xs text-text-muted">
                            {sessions.filter(s => s.status === 'in_progress').length} active sessions
                        </p>
                    </div>
                </div>
                {!activeSession && (
                    <button
                        onClick={handleCreate}
                        disabled={createMutation.isPending || !activeBranchId}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-red text-white text-sm font-bold hover:bg-brand-red/90 disabled:opacity-50 transition-all"
                    >
                        <Plus size={14} />
                        {createMutation.isPending ? 'Creating…' : 'New Stocktake'}
                    </button>
                )}
            </div>

            {/* Active session view */}
            {activeSession && (
                <div className="space-y-3 border border-amber-500/20 rounded-xl p-4 bg-amber-500/3">
                    {/* Session info bar */}
                    <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-3">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-bold ${STATUS_COLORS[activeSession.status]}`}>
                                {STATUS_ICONS[activeSession.status]}
                                {activeSession.status.replace('_', ' ')}
                            </span>
                            <span className="text-xs text-text-muted">
                                Started {format(new Date(activeSession.created_at), 'MMM d, h:mm a')}
                            </span>
                            <span className="text-xs font-semibold text-text-secondary">
                                {countedCount}/{activeItems.length} counted
                                {varianceCount > 0 && (
                                    <span className="ml-2 text-amber-500">· {varianceCount} variances</span>
                                )}
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => exportStocktakeSheet(activeItems, activeSession.id)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border-default text-xs font-semibold text-text-secondary hover:bg-bg-subtle transition-all"
                            >
                                <Download size={12} /> Export
                            </button>
                            <button
                                onClick={() => setShowUncountedOnly(v => !v)}
                                className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
                                    showUncountedOnly
                                        ? 'bg-brand-red/10 border-brand-red/30 text-brand-red'
                                        : 'border-border-default text-text-secondary hover:bg-bg-subtle'
                                }`}
                            >
                                Uncounted only
                            </button>
                            {activeSession.status === 'in_progress' && (
                                <>
                                    <label className="flex items-center gap-1.5 text-xs text-text-secondary cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={applyAdjustments}
                                            onChange={e => setApplyAdjustments(e.target.checked)}
                                            className="accent-brand-red"
                                        />
                                        Apply adjustments
                                    </label>
                                    <button
                                        onClick={handleCancel}
                                        className="px-3 py-1.5 rounded-xl border border-red-500/30 text-xs font-semibold text-red-500 hover:bg-red-500/10 transition-all"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleComplete}
                                        disabled={completeMutation.isPending}
                                        className="px-4 py-1.5 rounded-xl bg-brand-red text-white text-xs font-bold hover:bg-brand-red/90 disabled:opacity-50 transition-all"
                                    >
                                        {completeMutation.isPending ? 'Completing…' : 'Complete'}
                                    </button>
                                </>
                            )}
                            <button
                                onClick={() => setActiveSessionId(null)}
                                className="px-3 py-1.5 rounded-xl border border-border-default text-xs font-semibold text-text-muted hover:bg-bg-subtle transition-all"
                            >
                                ← Sessions
                            </button>
                        </div>
                    </div>

                    <StocktakeTable
                        items={activeItems}
                        countedById={userId}
                        onUpdateCount={(itemId, countedQty, countedBy) =>
                            updateItemMutation.mutate({ itemId, countedQty, countedBy })
                        }
                        isUpdating={updateItemMutation.isPending}
                        showUncountedOnly={showUncountedOnly}
                    />
                </div>
            )}

            {/* Sessions list */}
            {!activeSession && (
                <div className="border border-border-default rounded-xl overflow-hidden">
                    {sessions.length === 0 ? (
                        <div className="text-center py-12">
                            <ClipboardList size={32} className="mx-auto mb-3 text-text-muted" />
                            <p className="text-sm font-semibold text-text-secondary">No stocktake sessions yet</p>
                            <p className="text-xs text-text-muted mt-1">Start a new session to count physical stock</p>
                        </div>
                    ) : (
                        <>
                            <div className="grid grid-cols-[1fr_140px_120px_auto] text-[11px] font-black text-text-muted uppercase tracking-wider px-4 py-2.5 bg-bg-surface border-b border-border-default">
                                <span>Date</span>
                                <span>Status</span>
                                <span>Notes</span>
                                <span />
                            </div>
                            {sessions.map(session => (
                                <div
                                    key={session.id}
                                    className="grid grid-cols-[1fr_140px_120px_auto] items-center px-4 py-3 border-b border-border-default hover:bg-bg-subtle transition-colors"
                                >
                                    <div>
                                        <p className="text-sm font-semibold text-text-primary">
                                            {format(new Date(session.created_at), 'MMMM d, yyyy')}
                                        </p>
                                        <p className="text-xs text-text-muted">
                                            {format(new Date(session.created_at), 'h:mm a')}
                                        </p>
                                    </div>
                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-bold w-fit ${STATUS_COLORS[session.status]}`}>
                                        {STATUS_ICONS[session.status]}
                                        {session.status.replace('_', ' ')}
                                    </span>
                                    <span className="text-xs text-text-muted truncate">{session.notes ?? '—'}</span>
                                    <button
                                        onClick={() => setActiveSessionId(session.id)}
                                        className="px-3 py-1.5 rounded-xl border border-border-default text-xs font-semibold text-text-secondary hover:bg-bg-subtle hover:text-text-primary transition-all"
                                    >
                                        {session.status === 'in_progress' ? 'Continue' : 'View'}
                                    </button>
                                </div>
                            ))}
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
