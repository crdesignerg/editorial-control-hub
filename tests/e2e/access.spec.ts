import { test, expect } from '@playwright/test';
import { loadEnv } from 'vite';
const env = loadEnv('development',process.cwd(),'');
test('visitante não vê módulos e login inválido é recusado pelo Auth real', async ({page}) => {
  await page.goto('/');
  await expect(page.locator('#login-email')).toBeVisible();
  await expect(page.locator('#login-email')).toHaveValue('');
  await expect(page.locator('#login-password')).toHaveValue('');
  await page.locator('#login-email').fill('nonexistent-editorial-qa@example.invalid');
  await page.locator('#login-password').fill('InvalidPassword!123');
  const responsePromise=page.waitForResponse(r=>r.url().includes('/auth/v1/token'));
  await page.locator('form').getByRole('button',{name:/Entrar/}).click();
  const response=await responsePromise;
  expect(response.status()).toBe(400);
  await expect(page.getByText('E-mail ou senha incorretos.')).toBeVisible();
  await page.reload();
  await expect(page.locator('#login-email')).toBeVisible();
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.reload();
  await expect(page.locator('#login-email')).toBeVisible();
  await page.screenshot({path:'test-results/login-desktop.png',fullPage:true});
});
test('PostgREST real bloqueia leitura anônima nas três tabelas',async({request})=>{
  for(const table of ['profiles','clients','editorial_contents']){
    const result=await request.get(`${env.VITE_SUPABASE_URL}/rest/v1/${table}?select=id&limit=1`,{headers:{apikey:env.VITE_SUPABASE_ANON_KEY,Authorization:`Bearer ${env.VITE_SUPABASE_ANON_KEY}`}});
    expect([401,403]).toContain(result.status());
    expect((await result.json()).code).toBe('42501');
  }
});
test('login móvel preserva layout sem overflow horizontal',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.setViewportSize({width:390,height:844});await page.goto('/');
  await expect(page.locator('#login-email')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await page.screenshot({path:'test-results/login-mobile.png',fullPage:true});
});
