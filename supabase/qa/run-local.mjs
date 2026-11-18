// Apenas cluster novo e isolado. Não aceita URLs, credenciais ou banco remoto.
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { randomBytes, createHash } from 'node:crypto';
import pg from 'pg';
import { runConcurrency } from './concurrency.mjs';
const here=fileURLToPath(new URL('.',import.meta.url));
const root=fileURLToPath(new URL('../',import.meta.url));
const native=join(here,'node_modules/@embedded-postgres/windows-x64/native');
const bin=join(native,'bin');
const runDir=join(here,'runtime',new Date().toISOString().replace(/[:.]/g,'-'));
mkdirSync(runDir,{recursive:true});
const data=join(runDir,'data');
const password=randomBytes(24).toString('hex');
const passfile=join(runDir,'init-password');
writeFileSync(passfile,password);
// pgTAP 1.3.4 oficial é SQL puro. Registrar como extensão neste runtime privado.
const tapSource=readFileSync(join(here,'vendor/pgtap.sql.in'));
if(createHash('sha256').update(tapSource).digest('hex')!=='383ecd73edfd1c7ed5f3b835134ee1fe74e201ee31599346c92ea029b65dcdce') throw new Error('pgTAP não corresponde à fonte revisada');
const tap=tapSource.toString('utf8').replaceAll('__VERSION__','1.3').replaceAll('__OS__','MSWin32');
writeFileSync(join(native,'share/extension/pgtap--1.3.4.sql'),tap);
writeFileSync(join(native,'share/extension/pgtap.control'),"comment = 'pgTAP 1.3.4 local QA'\ndefault_version = '1.3.4'\nrelocatable = true\n");
const port=55439;
function command(exe,args) {
  const result=spawnSync(join(bin,exe+'.exe'),args,{encoding:'utf8',windowsHide:true,timeout:60000});
  if(result.status!==0) throw new Error(`${exe}: ${result.error?.message??result.stderr??result.stdout}`);
  return result.stdout;
}
const report={startedAt:new Date().toISOString(),scope:'PostgreSQL portátil; schema public extraído do remoto; Auth mínimo emulado; não é stack Supabase completa',migrations:[],tests:[],concurrency:[]};
let started=false, client;
const connection={host:'127.0.0.1',port,user:'postgres',password,database:'postgres',connectionTimeoutMillis:5000};
try {
  command('initdb',['-D',data,'-U','postgres','--pwfile',passfile,'--auth=scram-sha-256','--encoding=UTF8','--locale=C']);
  // Nenhuma porta pública; não modifica serviços do Windows.
  command('pg_ctl',['-D',data,'-l',join(runDir,'postgres.log'),'-o',`-p ${port} -h 127.0.0.1`,'-w','start']);
  started=true;
  client=new pg.Client(connection); await client.connect();
  report.version=(await client.query('SHOW server_version')).rows[0].server_version;
  await client.query(readFileSync(join(here,'platform-fixture.sql'),'utf8'));
  for(const name of readdirSync(join(root,'migrations')).filter(n=>n.endsWith('.sql')).sort()) {
    await client.query(readFileSync(join(root,'migrations',name),'utf8'));
    report.migrations.push({file:name,result:'PASS',sha256:createHash('sha256').update(readFileSync(join(root,'migrations',name))).digest('hex')});
    console.log('MIGRATION PASS',name);
    if(name.includes('initial_remote_schema')) {
      report.remoteAclReproduction=(await client.query("SELECT has_table_privilege('anon','public.clients','TRUNCATE') AS anon_truncate,has_table_privilege('authenticated','public.clients','SELECT') AS member_select")).rows[0];
    }
  }
  for(const file of readdirSync(join(root,'tests')).filter(n=>n.endsWith('.test.sql')).sort()) {
    try {
      const result=await client.query(readFileSync(join(root,'tests',file),'utf8'));
      const lines=(Array.isArray(result)?result:[result]).flatMap(r=>r.rows.flatMap(row=>Object.values(row).filter(v=>typeof v==='string')));
      const failures=lines.filter(line=>/^not ok|^# (Looks like|Failed)/m.test(line));
      const count=lines.filter(line=>/^ok \d+/m.test(line)).length;
      writeFileSync(join(runDir,file+'.tap'),lines.join('\n'));
      if(!count || failures.length || !lines.some(l=>/^1\.\.\d+/m.test(l))) throw new Error(failures.join('\n')||'TAP sem plano/resultados');
      report.tests.push({file,result:'PASS',assertions:count});
      writeFileSync(join(runDir,file+'.tap'),lines.join('\n'));
      console.log('PGTAP PASS',file,count);
    } catch(error) {
      report.tests.push({file,result:'FAIL',error:error.message});
      await client.query('ROLLBACK'); await client.query('RESET ROLE');
      throw error;
    }
  }
  report.concurrency=await runConcurrency(connection,client);
  console.log('CONCURRENCY PASS',report.concurrency.length);
} catch(error) {
  report.error=error.message; process.exitCode=1; console.error(error);
} finally {
  if(client) await client.end().catch(()=>{});
  if(started) command('pg_ctl',['-D',data,'-m','fast','-w','stop']);
  // Eliminar somente a senha efêmera deste cluster recém-criado.
  writeFileSync(passfile,'');
  report.stopped=started;
  report.finishedAt=new Date().toISOString();
  mkdirSync(join(root,'reports'),{recursive:true});
  writeFileSync(join(root,'reports/latest-local-security.json'),JSON.stringify(report,null,2)+'\n');
  console.log('Relatório: supabase/reports/latest-local-security.json');
}
