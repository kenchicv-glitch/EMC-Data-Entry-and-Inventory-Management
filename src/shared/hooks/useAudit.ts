import { supabase } from '../lib/supabase';
import { useBranch } from '../lib/BranchContext';

export interface AuditLog {
    action: 'CREATE_SALE' | 'UPDATE_SALE' | 'DELETE_SALE' | 'CLOSE_DAY' | 'INV_ADJUST';
    table_name: string;
    record_id: string;
    old_data?: any;
    new_data?: any;
}

export function useAudit() {
    const { activeBranchId } = useBranch();
    const logAction = async (log: AuditLog) => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { error } = await supabase.from('audit_logs').insert({
                user_id: user.id,
                action: log.action,
                table_name: log.table_name,
                record_id: log.record_id,
                old_data: log.old_data,
                new_data: log.new_data,
                branch_id: activeBranchId
            });

            if (error) {
                console.error('Audit log failed:', error);
            }
        } catch (err) {
            console.error('Audit hook error:', err);
        }
    };

    return { logAction };
}
