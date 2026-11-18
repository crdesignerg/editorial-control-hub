// Checagem estática: não executa SQL, Docker ou comandos Supabase.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, delimiter } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
let failures = 0;
function check(ok, message) {
  console.log(`${ok ? 'OK' : 'BLOQUEADO'}: ${message}`);
  if (!ok) failures++;
}
const config = readFileSync(join(root, 'config.toml'), 'utf8');
const tests = readFileSync(join(root, 'tests/rls_security_audit.test.sql'), 'utf8');
const migrations = readdirSync(join(root, 'migrations')).filter(n => n.endsWith('.sql')).sort();
const baseline = migrations.filter(n => /^\d{14}_.+\.sql$/.test(n) && n < '20261118171000_last_admin_hardening.sql');
check(baseline.length > 0, 'Baseline anterior ao hardening presente (revisão SQL manual continua obrigatória).');
check(/\[db.seed\]\s*(?:#[^\n]*\n\s*)*enabled\s*=\s*false/.test(config), 'Seed automático desabilitado.');
const count = [...tests.matchAll(/^SELECT\s+(?:ok|is|is_empty|throws_ok)\s*\(/gm)].length;
const plan = Number(tests.match(/SELECT plan\((\d+)\)/)?.[1]);
check(count === plan && plan === 26, `Plano pgTAP ${plan}; asserções estáticas ${count}.`);
check(/SELECT \* FROM finish\(\);\s*ROLLBACK;\s*$/.test(tests), 'finish() e ROLLBACK presentes.');
for (const name of ['supabase', 'docker', 'psql', 'pg_dump']) {
  const extensions = process.platform === 'win32' ? ['.exe', '.cmd', '.bat'] : [''];
  const present = (process.env.PATH ?? '').split(delimiter).some(dir =>
    extensions.some(ext => existsSync(join(dir.replace(/^"|"$/g, ''), name + ext))));
  check(present, `${name} disponível no PATH (presença não garante funcionamento).`);
}
console.log('Esta checagem avalia a rota Docker/Supabase. Para QA portátil, consulte qa/run-local.mjs e docs/DATABASE_SECURITY_RESULTS.md.');
console.log('PENDENTE: stack Supabase completa, Auth/PostgREST reais e revisão antes de qualquer implantação remota.');
console.log('Nenhuma conexão ou migração executada por esta checagem.');
process.exitCode = failures ? 1 : 0;
