import { supabase } from '../lib/supabase';
import { AppError } from '../lib/errors';
import type { Database } from '../types/database.types';
import type { Client, EditorialContent } from '../types/domain';
const clientColumns = 'id,name,segment,accent_color,monthly_goal,manager' as const;
const contentColumns = 'id,client_id,title,date,time,format,status,copy,art_text,briefing' as const;
type Tables = Database['public']['Tables'];
export function mapClient(row: Pick<Tables['clients']['Row'], 'id'|'name'|'segment'|'accent_color'|'monthly_goal'|'manager'>): Client {
  return { id: row.id, name: row.name, segment: row.segment, accentColor: row.accent_color, monthlyGoal: row.monthly_goal, manager: row.manager };
}
export function mapContent(row: Pick<Tables['editorial_contents']['Row'], 'id'|'client_id'|'title'|'date'|'time'|'format'|'status'|'copy'|'art_text'|'briefing'>): EditorialContent {
  return { id: row.id, clientId: row.client_id, title: row.title, date: row.date, time: row.time, format: row.format, status: row.status, copy: row.copy, artText: row.art_text, briefing: row.briefing };
}
export async function loadEditorialData() {
  // Paginar para não truncar silenciosamente os indicadores no limite da API.
  const clients: Client[] = [], contents: EditorialContent[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabase.from('clients').select(clientColumns).order('id').range(offset, offset + 499);
    if (error) throw error;
    clients.push(...data.map(mapClient)); if (data.length < 500) break;
  }
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabase.from('editorial_contents').select(contentColumns).order('date').order('time').order('id').range(offset, offset + 499);
    if (error) throw error;
    contents.push(...data.map(mapContent)); if (data.length < 500) break;
  }
  return { clients, contents };
}
export async function saveClient(input: Omit<Client, 'id'>, userId: string, id?: string) {
  if (!input.name.trim() || input.name.length > 150 || !Number.isInteger(input.monthlyGoal) || input.monthlyGoal < 1 || input.monthlyGoal > 500) throw new AppError('Informe nome e meta mensal inteira entre 1 e 500.');
  const payload = { name: input.name.trim(), segment: input.segment, accent_color: input.accentColor, monthly_goal: input.monthlyGoal, manager: input.manager };
  const query = id ? supabase.from('clients').update(payload).eq('id', id) : supabase.from('clients').insert({ ...payload, created_by: userId });
  const { data, error } = await query.select(clientColumns).single(); if (error) throw error; return mapClient(data);
}
export function contentPatch(input: Partial<EditorialContent>): Tables['editorial_contents']['Update'] {
  if (input.title !== undefined && (!input.title.trim() || input.title.length > 255)) throw new AppError('O título deve ter entre 1 e 255 caracteres.');
  if (input.time !== undefined && !/^([01]\d|2[0-3]):[0-5]\d$/.test(input.time)) throw new AppError('Informe um horário válido.');
  if (input.date !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(input.date)) throw new AppError('Informe uma data válida.');
  const patch: Tables['editorial_contents']['Update'] = {};
  if (input.clientId !== undefined) patch.client_id = input.clientId;
  if (input.title !== undefined) patch.title = input.title;
  if (input.date !== undefined) patch.date = input.date;
  if (input.time !== undefined) patch.time = input.time;
  if (input.format !== undefined) patch.format = input.format;
  if (input.status !== undefined) patch.status = input.status;
  if (input.copy !== undefined) patch.copy = input.copy;
  if (input.artText !== undefined) patch.art_text = input.artText;
  if (input.briefing !== undefined) patch.briefing = input.briefing;
  return patch;
}
export async function createContent(input: Omit<EditorialContent,'id'>, userId: string) {
  const patch = contentPatch(input);
  const { data, error } = await supabase.from('editorial_contents').insert({ ...patch, client_id: input.clientId, title: input.title, date: input.date, created_by: userId, updated_by: userId }).select(contentColumns).single();
  if (error) throw error; return mapContent(data);
}
export async function updateContent(id: string, patch: Partial<EditorialContent>, userId: string) {
  const { data, error } = await supabase.from('editorial_contents').update({ ...contentPatch(patch), updated_by: userId }).eq('id', id).select(contentColumns).single();
  if (error) throw error; return mapContent(data);
}
export async function deleteContent(id: string) {
  const { data, error } = await supabase.from('editorial_contents').delete().eq('id',id).select('id');
  if (error) throw error;
  if (data.length !== 1) throw new AppError('Publicação indisponível ou exclusão não permitida.');
}
