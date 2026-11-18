import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const expected = env.VITE_APP_ENV === 'homologation' ? 'cjbwmoxqkrrlryonuenn' : env.VITE_APP_ENV === 'production' ? 'ejinklwazxjzdsiwbadw' : null;
  const key = env.VITE_SUPABASE_ANON_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!expected || env.VITE_SUPABASE_URL !== `https://${expected}.supabase.co` || !key) {
    throw new Error('Ambiente e URL pública do Supabase incompatíveis ou ausentes.');
  }
  if (process.env.VERCEL_ENV === 'production' && env.VITE_APP_ENV !== 'production') {
    throw new Error('Deploy Vercel Production não pode utilizar banco de homologação. Use Preview.');
  }
  if (key.startsWith('sb_secret_')) throw new Error('Chave secreta proibida no frontend.');
  if (key.split('.').length === 3) {
    const claim = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString());
    if (claim.role !== 'anon' || claim.ref !== expected) throw new Error('Use somente a chave pública anon do projeto correto.');
  } else if (!key.startsWith('sb_publishable_')) throw new Error('Chave pública inválida.');
  return {
  plugins: [react()],
  server: {
    port: 5173,
    open: true
  }
  };
});
