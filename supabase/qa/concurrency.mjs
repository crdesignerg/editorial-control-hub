import pg from 'pg';
import assert from 'node:assert/strict';
const ids=['71111111-1111-1111-1111-111111111111','72222222-2222-2222-2222-222222222222'];
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
export async function runConcurrency(connection,observer) {
  assert.equal(connection.host,'127.0.0.1');
  assert.equal(connection.port,55439);
  const results=[];
  for(const isolation of ['READ COMMITTED','REPEATABLE READ','SERIALIZABLE']) {
    for(const first of ['demote','delete','auth-delete']) for(const second of ['demote','delete','auth-delete']) {
      await observer.query("INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES ($1,'race1@example.test','{\"name\":\"Race One\"}'),($2,'race2@example.test','{\"name\":\"Race Two\"}') ON CONFLICT(id) DO NOTHING",ids);
      // DELETE de profiles mantém auth.users: recriar perfil faltante na preparação.
      await observer.query("INSERT INTO public.profiles(id,name,email) VALUES ($1,'Race One','race1@example.test'),($2,'Race Two','race2@example.test') ON CONFLICT(id) DO NOTHING",ids);
      await observer.query("UPDATE public.profiles SET access_level='admin',is_active=true WHERE id=ANY($1::uuid[])",[ids]);
      const a=new pg.Client(connection),b=new pg.Client(connection);
      await a.connect(); await b.connect();
      try {
        for(const [c,id,op] of [[a,ids[0],first],[b,ids[1],second]]) {
          await c.query(`BEGIN ISOLATION LEVEL ${isolation}`);
          await c.query("SET LOCAL statement_timeout='10s'");
          await c.query(`SET LOCAL ROLE ${op==='auth-delete'?'supabase_auth_admin':'authenticated'}`);
          await c.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[op==='auth-delete'?'':id]);
          // Congela snapshot B ANTES do commit A, inclusive no modo RR.
          await c.query('SELECT count(*) FROM pg_catalog.pg_class');
        }
        const mutate=(c,op,id)=>c.query(op==='demote'?"UPDATE public.profiles SET access_level='member' WHERE id=$1":op==='delete'?'DELETE FROM public.profiles WHERE id=$1':'DELETE FROM auth.users WHERE id=$1',[id]);
        const pid=(await b.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
        await mutate(a,first,ids[0]);
        let settled=false;
        const pending=mutate(b,second,ids[1]).then(()=>({code:'COMMITTED_CANDIDATE'}),e=>({code:e.code,message:e.message})).finally(()=>{settled=true;});
        let blocked=false;
        for(let attempt=0;attempt<100 && !settled;attempt++) {
          blocked=(await observer.query('SELECT cardinality(pg_blocking_pids($1))>0 AS blocked',[pid])).rows[0].blocked;
          if(blocked) break;
          await pause(20);
        }
        assert.equal(blocked,true,'B deve aguardar lock real de A');
        await a.query('COMMIT');
        const outcome=await pending;
        assert.ok(['P0001','40001'].includes(outcome.code),`${first}/${second} ${isolation}: ${JSON.stringify(outcome)}`);
        await b.query('ROLLBACK');
        const counts=(await observer.query("SELECT (SELECT count(*)::integer FROM public.profiles WHERE access_level='admin' AND is_active) AS actual,(SELECT active_count::integer FROM editorial_security.admin_state) AS tracked")).rows[0];
        assert.deepEqual(counts,{actual:1,tracked:1});
        results.push({isolation,first,second,blocked:true,rejected:outcome.code,activeAdmins:1,result:'PASS'});
      } finally {
        await a.query('ROLLBACK').catch(()=>{}); await b.query('ROLLBACK').catch(()=>{});
        await a.end(); await b.end();
      }
    }
  }
  return results;
}
