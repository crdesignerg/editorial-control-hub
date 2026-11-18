import { supabase, setRememberSession } from '../lib/supabase';
import { AppError } from '../lib/errors';
import type { AuthUser } from '../types/domain';
export async function getProfile(id: string): Promise<AuthUser> {
  const { data, error } = await supabase.from('profiles').select('id,name,email,role,access_level,is_active').eq('id', id).maybeSingle();
  if (error) throw error;
  if (!data || !data.is_active) throw new AppError('Seu perfil não está disponível ou está inativo. Contate o administrador.', 'PROFILE_DENIED');
  return { id: data.id, name: data.name, email: data.email, role: data.role, accessLevel: data.access_level };
}
export async function signIn(email: string, password: string, remember: boolean) {
  setRememberSession(remember);
  const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw error;
  try { return await getProfile(data.user.id); }
  catch (e) { await supabase.auth.signOut({ scope: 'local' }); throw e; }
}
export async function signOut() {
  const { error } = await supabase.auth.signOut({ scope: 'local' });
  if (error) throw error;
}
export async function requestRecovery(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin });
  if (error) throw error;
}
export async function resetPassword(password: string) {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
}
