import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/database.types';

const url = import.meta.env.VITE_APP_ENV === 'homologation'
  ? import.meta.env.VITE_SUPABASE_HOMOLOGATION_URL || import.meta.env.VITE_SUPABASE_URL
  : import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) throw new Error('Configure as variáveis públicas do Supabase.');
const preference = 'editorial-remember-session';
export function setRememberSession(remember: boolean) {
  localStorage.setItem(preference, String(remember));
}
const storage = {
  getItem: (name: string) => localStorage.getItem(name) ?? sessionStorage.getItem(name),
  setItem: (name: string, value: string) => {
    const persistent = localStorage.getItem(preference) !== 'false';
    (persistent ? sessionStorage : localStorage).removeItem(name);
    (persistent ? localStorage : sessionStorage).setItem(name, value);
  },
  removeItem: (name: string) => { localStorage.removeItem(name); sessionStorage.removeItem(name); },
};
export const supabase = createClient<Database>(url, key, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storage },
});
