import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import { useBranch } from './useBranch';

export interface Notification {
    id: string;
    target_user_id?: string;
    target_branch_id?: number;
    title: string;
    message: string;
    type: string;
    reference_id?: string;
    is_read: boolean;
    created_at: string;
}

export const useNotifications = () => {
    const { user } = useAuth();
    const { activeBranchId } = useBranch();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);
    const [unreadCount, setUnreadCount] = useState(0);

    const fetchNotifications = async () => {
        if (!user) return;
        try {
            let query = supabase
                .from('notifications')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(20);

            // Filter by branch or direct user
            if (activeBranchId) {
                query = query.or(`target_branch_id.eq.${activeBranchId},target_user_id.eq.${user.id}`);
            } else {
                query = query.eq('target_user_id', user.id);
            }

            const { data, error } = await query;
            if (error) throw error;
            setNotifications(data || []);
            setUnreadCount(data?.filter(n => !n.is_read).length || 0);
        } catch (err) {
            console.error('Error fetching notifications:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchNotifications();

        if (!user) return;

        // Subscribe to real-time changes
        const channel = supabase
            .channel('public:notifications')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'notifications'
            }, (payload) => {
                const newNote = payload.new as Notification;
                // Only add if it's for us or our branch
                if (newNote.target_user_id === user.id || (activeBranchId && newNote.target_branch_id === Number(activeBranchId))) {
                    setNotifications(prev => [newNote, ...prev]);
                    setUnreadCount(prev => prev + 1);
                }
            })
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'notifications'
            }, fetchNotifications) 
            .on('postgres_changes', {
                event: 'DELETE',
                schema: 'public',
                table: 'notifications'
            }, fetchNotifications)
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user, activeBranchId]);

    const markAsRead = async (id: string) => {
        try {
            const { error } = await supabase
                .from('notifications')
                .update({ is_read: true })
                .eq('id', id);
            if (error) throw error;
            // State will be updated via real-time subscription
        } catch (err) {
            console.error('Error marking notification as read:', err);
        }
    };

    const markAllAsRead = async () => {
        if (!activeBranchId || !user) return;
        try {
            const { error } = await supabase
                .from('notifications')
                .update({ is_read: true })
                .or(`target_branch_id.eq.${activeBranchId},target_user_id.eq.${user.id}`)
                .eq('is_read', false);
            if (error) throw error;
        } catch (err) {
            console.error('Error marking all notifications as read:', err);
        }
    };

    const deleteNotification = async (id: string) => {
        try {
            const { error } = await supabase
                .from('notifications')
                .delete()
                .eq('id', id);
            if (error) throw error;
        } catch (err: any) {
            console.error('Error deleting notification:', err);
            throw new Error(`Failed to delete notification: ${err.message || 'Access Denied'}`);
        }
    };

    return {
        notifications,
        loading,
        unreadCount,
        markAsRead,
        markAllAsRead,
        deleteNotification,
        refresh: fetchNotifications
    };
};
