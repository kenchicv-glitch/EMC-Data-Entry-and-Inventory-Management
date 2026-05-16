import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Plus, Pencil, Trash2, ArrowLeft } from 'lucide-react';
import { useBranch } from '../../../shared/hooks/useBranch';
import { useLocations, useCreateLocation, useUpdateLocation, useDeleteLocation } from '../hooks/useLocations';
import LocationFormModal from '../components/LocationFormModal';
import type { InventoryLocation } from '../types/product';

export default function InventoryLocationsPage() {
    const { activeBranchId } = useBranch();
    const { data: locations = [], isLoading } = useLocations(activeBranchId);
    const createMutation = useCreateLocation();
    const updateMutation = useUpdateLocation();
    const deleteMutation = useDeleteLocation();

    const [modalOpen, setModalOpen] = useState(false);
    const [editLocation, setEditLocation] = useState<InventoryLocation | null>(null);

    const openCreate = () => { setEditLocation(null); setModalOpen(true); };
    const openEdit = (loc: InventoryLocation) => { setEditLocation(loc); setModalOpen(true); };
    const handleClose = () => { setModalOpen(false); setEditLocation(null); };

    const handleSubmit = (data: Omit<InventoryLocation, 'id' | 'created_at' | 'children'>) => {
        if (editLocation) {
            updateMutation.mutate({ id: editLocation.id, input: data }, { onSuccess: handleClose });
        } else {
            createMutation.mutate(data, { onSuccess: handleClose });
        }
    };

    const handleDelete = (loc: InventoryLocation) => {
        if (!confirm(`Delete location "${loc.code} — ${loc.name}"?`)) return;
        deleteMutation.mutate(loc.id);
    };

    const topLevel = locations.filter(l => !l.parent_id);
    const children = (parentId: string) => locations.filter(l => l.parent_id === parentId);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-2 border-brand-red/20 border-t-brand-red rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-4">
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
                        <h2 className="text-base font-black text-text-primary">Stock Locations</h2>
                        <p className="text-xs text-text-muted">{locations.length} locations</p>
                    </div>
                </div>
                <button
                    onClick={openCreate}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-red text-white text-sm font-bold hover:bg-brand-red/90 transition-all"
                >
                    <Plus size={14} /> New Location
                </button>
            </div>

            {locations.length === 0 ? (
                <div className="border border-border-default rounded-xl p-12 text-center">
                    <MapPin size={32} className="mx-auto mb-3 text-text-muted" />
                    <p className="text-sm font-semibold text-text-secondary">No locations yet</p>
                    <p className="text-xs text-text-muted mt-1">Add shelves, bins, and zones to track where products live</p>
                </div>
            ) : (
                <div className="border border-border-default rounded-xl overflow-hidden">
                    <div className="grid grid-cols-[80px_1fr_2fr_auto] text-[11px] font-black text-text-muted uppercase tracking-wider px-4 py-2.5 bg-bg-surface border-b border-border-default">
                        <span>Code</span>
                        <span>Name</span>
                        <span>Description</span>
                        <span />
                    </div>
                    {topLevel.map(loc => (
                        <React.Fragment key={loc.id}>
                            <div className="grid grid-cols-[80px_1fr_2fr_auto] items-center px-4 py-2.5 border-b border-border-default bg-bg-subtle/30">
                                <span className="font-mono text-sm font-bold text-text-primary">{loc.code}</span>
                                <span className="font-semibold text-text-primary text-sm">{loc.name}</span>
                                <span className="text-xs text-text-muted">{loc.description ?? '—'}</span>
                                <div className="flex items-center gap-1">
                                    <button onClick={() => openEdit(loc)} className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-subtle transition-all"><Pencil size={13} /></button>
                                    <button onClick={() => handleDelete(loc)} className="p-1.5 rounded-lg text-text-muted hover:text-red-500 hover:bg-red-500/10 transition-all"><Trash2 size={13} /></button>
                                </div>
                            </div>
                            {children(loc.id).map(child => (
                                <div key={child.id} className="grid grid-cols-[80px_1fr_2fr_auto] items-center px-4 py-2 border-b border-border-default/50 bg-bg-subtle/10 pl-8">
                                    <span className="font-mono text-xs text-text-muted ml-4">{child.code}</span>
                                    <span className="text-sm text-text-secondary">{child.name}</span>
                                    <span className="text-xs text-text-muted">{child.description ?? '—'}</span>
                                    <div className="flex items-center gap-1">
                                        <button onClick={() => openEdit(child)} className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-subtle transition-all"><Pencil size={12} /></button>
                                        <button onClick={() => handleDelete(child)} className="p-1.5 rounded-lg text-text-muted hover:text-red-500 hover:bg-red-500/10 transition-all"><Trash2 size={12} /></button>
                                    </div>
                                </div>
                            ))}
                        </React.Fragment>
                    ))}
                </div>
            )}

            <LocationFormModal
                isOpen={modalOpen}
                onClose={handleClose}
                onSubmit={handleSubmit}
                isPending={createMutation.isPending || updateMutation.isPending}
                editLocation={editLocation}
                branchId={activeBranchId}
                existingLocations={locations}
            />
        </div>
    );
}
