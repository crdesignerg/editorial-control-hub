// Reconstrução somente do schema public auditado; requer os dois catálogos reais.
import { readFileSync, writeFileSync } from 'node:fs';
const read = name => JSON.parse(readFileSync(new URL(`../snapshots/${name}`, import.meta.url), 'utf8').replace(/^\uFEFF/, ''));
const security = read('security-catalog.json');
const structure = read('structure-catalog.json');
const rows = kind => structure.filter(r=>r.kind===kind).map(r=>r.detail);
const q = s => '"'+s.replaceAll('"','""')+'"';
const literal = s => "'"+s.replaceAll("'","''")+"'";
const sql = ['-- Baseline LOCAL reconstruída de catálogos remotos READ ONLY em 18/11/2026.',
  '-- Não enviar ao remoto já provisionado. Não inclui schemas gerenciados Auth/Storage.',
  '-- Fonte: security-catalog + structure-catalog; PostgreSQL remoto 17.12.',
  'BEGIN;', 'SET LOCAL search_path = public, pg_catalog;'];
for (const name of [...new Set(rows('enum').map(e=>e.name))]) {
  sql.push(`CREATE TYPE public.${q(name)} AS ENUM (${rows('enum').filter(e=>e.name===name).sort((a,b)=>a.pos-b.pos).map(e=>literal(e.value)).join(', ')});`);
}
const tableNames = ['profiles','clients','editorial_contents'];
for (const name of tableNames) {
  const columns=rows('column').filter(c=>c.table===name).sort((a,b)=>a.pos-b.pos);
  if(!columns.length) throw new Error(`Catálogo incompleto: ${name}`);
  sql.push(`CREATE TABLE public.${q(name)} (\n${columns.map(c=>`  ${q(c.name)} ${c.type}${c.default===null?'':` DEFAULT ${c.default}`}${c.notnull?' NOT NULL':''}`).join(',\n')}\n);`);
}
const constraints=rows('constraint');
// PK/UNIQUE primeiro, pois FKs dependem delas.
for(const c of [...constraints].sort((a,b)=>Number(a.ddl.startsWith('FOREIGN KEY'))-Number(b.ddl.startsWith('FOREIGN KEY')))) {
  sql.push(`ALTER TABLE public.${q(c.table.replace(/^public\./,''))} ADD CONSTRAINT ${q(c.name)} ${c.ddl};`);
}
for(const i of rows('index')) {
  if(!constraints.some(c=>c.name===i.indexname)) sql.push(i.indexdef+';');
}
for(const f of security.filter(r=>r.kind==='function')) sql.push(f.detail.ddl+';');
for(const t of [...security.filter(r=>r.kind==='trigger').map(r=>r.detail),...rows('trigger')]) {
  if(t.enabled!=='O') throw new Error('Trigger não habilitado: revisão manual necessária');
  sql.push(t.ddl+';');
}
for(const t of rows('table')) {
  if(t.rls) sql.push(`ALTER TABLE public.${q(t.name)} ENABLE ROW LEVEL SECURITY;`);
  if(t.force) sql.push(`ALTER TABLE public.${q(t.name)} FORCE ROW LEVEL SECURITY;`);
}
for(const {detail:p} of security.filter(r=>r.kind==='policy')) {
  sql.push(`CREATE POLICY ${q(p.policyname)} ON public.${q(p.tablename)} AS ${p.permissive} FOR ${p.cmd} TO ${p.roles.map(q).join(', ')}${p.qual?` USING (${p.qual})`:''}${p.with_check?` WITH CHECK (${p.with_check})`:''};`);
}
for(const table of tableNames) sql.push(`REVOKE ALL ON public.${q(table)} FROM PUBLIC, anon, authenticated, service_role;`);
for(const g of rows('grant')) {
  sql.push(`GRANT ${g.privilege_type} ON public.${q(g.table_name)} TO ${g.grantee==='PUBLIC'?'PUBLIC':q(g.grantee)}${g.is_grantable==='YES'?' WITH GRANT OPTION':''};`);
}
// PostgreSQL 17: MAINTAIN aparece no ACL bruto, não em role_table_grants.
for (const t of rows('table')) for (const acl of t.acl ?? []) {
  const [role, permissions] = acl.split('=');
  if (permissions.split('/')[0].includes('m')) sql.push(`GRANT MAINTAIN ON public.${q(t.name)} TO ${role?q(role):'PUBLIC'};`);
}
sql.push('COMMIT;','');
writeFileSync(new URL('../migrations/20261118170000_initial_remote_schema.sql', import.meta.url), sql.join('\n'));
console.log('Baseline reconstruída; revisar SQL antes de executar.');
