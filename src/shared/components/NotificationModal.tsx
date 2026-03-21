import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Bell, Clock, Building2, ExternalLink } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import type { Notification } from '../hooks/useNotifications';
import { toast } from 'sonner';

interface NotificationModalProps {
    isOpen: boolean;
    onClose: () => void;
    notifications: Notification[];
    onMarkAsRead: (id: string) => void;
    onMarkAllAsRead: () => void;
    onDeleteNotification: (id: string) => Promise<void>;
}

export default function NotificationModal({ isOpen, onClose, notifications, onMarkAsRead, onMarkAllAsRead, onDeleteNotification }: NotificationModalProps) {
    const navigate = useNavigate();
    
    // Lock body scroll when modal is open
    useEffect(() => {
        if (isOpen) {
            document.body.classList.add('modal-open');
        } else {
            document.body.classList.remove('modal-open');
        }
        return () => {
            document.body.classList.remove('modal-open');
        };
    }, [isOpen]);

    if (!isOpen) return null;

    const handleAction = (note: Notification) => {
        if (!note.is_read) {
            onMarkAsRead(note.id);
        }
        
        if (note.type === 'transfer_request' || note.type === 'transfer_shipped' || note.type === 'transfer_received' || note.type === 'transfer_cancelled') {
            navigate('/transfers');
            onClose();
        }
    };

    return createPortal(
        <div className="fixed inset-0 z-[10000] flex items-start justify-end px-4 py-20 pointer-events-none">
            <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px] pointer-events-auto" onClick={onClose} />
            
            <div className="relative w-full max-w-sm bg-surface shadow-2xl rounded-2xl border border-border-default overflow-hidden animate-slide-in-right pointer-events-auto flex flex-col max-h-[80vh]">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-border-muted bg-subtle/50">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-brand-red/10 rounded-lg flex items-center justify-center text-brand-red">
                            <Bell size={16} />
                        </div>
                        <h2 className="text-sm font-bold text-text-primary">Notifications</h2>
                    </div>
                    <div className="flex items-center gap-2">
                        {notifications.some(n => !n.is_read) && (
                            <button 
                                onClick={onMarkAllAsRead}
                                className="text-[10px] font-black text-brand-red hover:text-brand-red-dark uppercase tracking-widest transition-colors"
                            >
                                Mark all as read
                            </button>
                        )}
                        <button onClick={onClose} className="p-1.5 hover:bg-muted rounded-lg text-text-muted transition-colors">
                            <X size={16} />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto scrollbar-hide py-2">
                    {notifications.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center px-6">
                            <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center text-text-muted mb-3">
                                <Bell size={20} />
                            </div>
                            <p className="text-xs font-bold text-text-primary uppercase tracking-widest mb-1">Silence is Golden</p>
                            <p className="text-[10px] text-text-muted">You're all caught up with your branch coordination.</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-border-muted/50">
                            {notifications.map((note) => (
                                <div 
                                    key={note.id} 
                                    className={`relative p-5 hover:bg-subtle/50 transition-all cursor-pointer group ${!note.is_read ? 'bg-brand-red/[0.02]' : ''}`}
                                    onClick={() => handleAction(note)}
                                >
                                    {!note.is_read && (
                                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-brand-red" />
                                    )}

                                    {/* Delete Button - Top Left */}
                                        <button 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                toast.promise(onDeleteNotification(note.id), {
                                                    loading: 'Deleting...',
                                                    success: 'Notification removed',
                                                    error: (err) => err.message || 'Failed to delete'
                                                });
                                            }}
                                            className="absolute top-3 left-3 p-1.5 bg-surface border border-border-default hover:bg-danger-subtle text-text-muted hover:text-danger rounded-md opacity-0 group-hover:opacity-100 transition-all z-10 shadow-sm"
                                            title="Delete notification"
                                        >
                                            <X size={12} />
                                        </button>
                                    
                                    <div className="flex flex-col gap-2 pl-4">
                                        <div className="flex justify-between items-start gap-2">
                                            <h3 className={`text-xs font-bold leading-tight ${!note.is_read ? 'text-text-primary' : 'text-text-secondary'}`}>
                                                {note.title}
                                            </h3>
                                            <span className="text-[9px] font-medium text-text-muted whitespace-nowrap flex items-center gap-1">
                                                <Clock size={10} /> {formatDistanceToNow(new Date(note.created_at), { addSuffix: true })}
                                            </span>
                                        </div>
                                        
                                        <p className="text-[11px] text-text-secondary leading-normal">
                                            {note.message}
                                        </p>

                                        <div className="flex items-center justify-between mt-1">
                                            <div className="flex items-center gap-3">
                                                <div className="flex items-center gap-1 text-[9px] font-black text-brand-orange uppercase tracking-tighter">
                                                    <Building2 size={10} /> {note.message.split('Branch ')[1]?.split(' is')[0] || 'Unknown Branch'}
                                                </div>
                                                <div className="text-[8px] font-medium text-text-muted">
                                                    {format(new Date(note.created_at), 'MMM d, h:mm a')}
                                                </div>
                                            </div>
                                            
                                            {note.type.startsWith('transfer_') && (
                                                <div className="p-1 px-2 bg-brand-red/10 rounded-md text-brand-red text-[8px] font-black uppercase tracking-widest flex items-center gap-1 group-hover:bg-brand-red group-hover:text-white transition-all">
                                                    View Request <ExternalLink size={8} />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-3 bg-subtle/50 border-t border-border-muted flex justify-center">
                    <p className="text-[9px] font-black text-text-muted uppercase tracking-[0.2em]">Coordination Center</p>
                </div>
            </div>
        </div>,
        document.body
    );
}
