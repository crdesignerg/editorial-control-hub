import type { Database } from './database.types';
export type ContentFormat = Database['public']['Enums']['content_format_enum'];
export type ContentStatus = Database['public']['Enums']['content_status_enum'];
export interface AuthUser { id: string; name: string; email: string; role: string; accessLevel: 'admin' | 'member'; }
export interface Client { id: string; name: string; segment: string; accentColor: string; monthlyGoal: number; manager: string; }
export interface EditorialContent { id: string; clientId: string; title: string; date: string; time: string; format: ContentFormat; status: ContentStatus; copy: string; artText: string; briefing: string; }
