// Teste do wiring React com transporte simulado. NÃO homologa Auth/RLS remotos.
import { test, expect } from '@playwright/test';
test('UI: sessão, clientes, publicações e salvamento persistem no transporte de teste',async({page})=>{
  const id='11111111-1111-4111-8111-111111111111';
  const user={id,email:'ui@qa.invalid',aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{},created_at:new Date().toISOString()};
  const jwt=[{alg:'HS256',typ:'JWT'},{sub:id,role:'authenticated',exp:Math.floor(Date.now()/1000)+3600},'signature'].map((x)=>Buffer.from(typeof x==='string'?x:JSON.stringify(x)).toString('base64url')).join('.');
  const clients:Record<string,unknown>[]=[];const contents:Record<string,unknown>[]=[];
  await page.route('https://cjbwmoxqkrrlryonuenn.supabase.co/**',async route=>{
    const request=route.request(), url=new URL(request.url());
    if(url.pathname.endsWith('/token'))return route.fulfill({json:{access_token:jwt,refresh_token:'test-refresh',token_type:'bearer',expires_in:3600,user}});
    if(url.pathname.endsWith('/logout'))return route.fulfill({status:204});
    if(url.pathname.endsWith('/user'))return route.fulfill({json:user});
    if(url.pathname.endsWith('/profiles'))return route.fulfill({json:{id,name:'Pessoa QA',email:user.email,role:'QA',access_level:'admin',is_active:true}});
    const rows=url.pathname.endsWith('/clients')?clients:contents;
    if(request.method()==='GET')return route.fulfill({json:rows});
    if(request.method()==='POST'){
      const data=request.postDataJSON(); const row={id:crypto.randomUUID(),...data};rows.push(row);return route.fulfill({status:201,json:row});
    }
    if(request.method()==='PATCH'){
      const row=rows.find(r=>r.id===url.searchParams.get('id')?.slice(3));Object.assign(row!,request.postDataJSON());return route.fulfill({json:row});
    }
    throw new Error(`Requisição não prevista: ${request.method()} ${url.pathname}`);
  });
  await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/');
  await page.locator('#login-email').fill(user.email);await page.locator('#login-password').fill('FakeTestOnly!123');
  await page.locator('form').getByRole('button',{name:/Entrar/}).click();
  await expect(page.getByText('Pessoa QA')).toBeVisible();
  await page.getByRole('button',{name:'Clientes',exact:true}).click();
  await page.getByRole('button',{name:/Novo Cliente/i}).click();
  await page.getByPlaceholder('Ex: Horizonte Imóveis').fill('Cliente UI QA');
  await page.getByRole('button',{name:'Cadastrar Cliente',exact:true}).click();
  await expect.poll(()=>clients.length).toBe(1);
  await page.getByTitle('Editar cliente').click();
  await page.getByPlaceholder('Ex: Horizonte Imóveis').fill('Cliente UI Editado');
  await page.getByRole('button',{name:'Salvar Alterações',exact:true}).click();
  await expect.poll(()=>clients[0].name).toBe('Cliente UI Editado');
  await page.getByRole('button',{name:'Calendário Editorial',exact:true}).click();
  await page.getByRole('button',{name:/Nova Publicação/i}).first().click();
  const form=page.locator('form');
  await form.locator('input[type="text"]').fill('Publicação UI QA');
  await form.getByRole('button',{name:'Criar Publicação',exact:true}).click();
  await expect.poll(()=>contents.length).toBe(1);
  await page.reload();await expect(page.getByText('Pessoa QA')).toBeVisible();
  await expect(page.getByText('Publicação UI QA').first()).toBeVisible();
  await page.getByText('Publicação UI QA').first().click();
  await page.locator('input[value="Publicação UI QA"]').fill('Publicação UI Revisada');
  await page.getByRole('button',{name:'Concluir Edição',exact:true}).click();
  await expect.poll(()=>contents[0].title).toBe('Publicação UI Revisada');
  await page.screenshot({path:'test-results/editorial-desktop.png',fullPage:true});
  await page.getByRole('button',{name:'Encerrar sessão',exact:true}).click();
  await expect(page.locator('#login-email')).toBeVisible();
  await page.reload();await expect(page.locator('#login-email')).toBeVisible();
});
