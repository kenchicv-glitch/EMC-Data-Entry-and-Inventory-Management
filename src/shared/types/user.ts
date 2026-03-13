export type UserRole = 'admin' | 'encoder';

export interface User {
    id: string;
    full_name: string | null;
    role: UserRole | null;
    updated_at: string | null;
}
