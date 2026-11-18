-- PREPARADO, NÃO EXECUTADO. Destino exclusivo: cjbwmoxqkrrlryonuenn.
-- O Project Ref é validado na chamada CLI; current_database() não identifica o projeto.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
LOCK TABLE auth.users IN SHARE MODE;
LOCK TABLE public.profiles IN SHARE ROW EXCLUSIVE MODE;

DO $bootstrap$
DECLARE
  item record;
  auth_before text;
  expected jsonb := '[
    {"id":"2b5e8df8-72b2-4b39-ab10-e5a2e0c9bd08","email":"crdesignerg@gmail.com","name":"Carlos Rocha","role":"CEO/Designer","access_level":"admin"},
    {"id":"534d1fd6-2d06-4360-ae43-2050ea14e9cd","email":"cadurochaemp@gmail.com","name":"Cadu","role":"Social Media & Conteúdo","access_level":"member"}
  ]';
BEGIN
  IF current_user <> 'postgres' THEN
    RAISE EXCEPTION 'Executor inesperado; interromper.';
  END IF;
  -- Comparação interna; não retorna dados ou credenciais de Auth.
  SELECT md5(coalesce(jsonb_agg(to_jsonb(u) ORDER BY u.id)::text,'[]'))
    INTO auth_before FROM auth.users u;

  FOR item IN SELECT * FROM jsonb_to_recordset(expected)
    AS x(id uuid,email text,name text,role text,access_level text)
  LOOP
    IF NOT EXISTS (SELECT 1 FROM auth.users u
                   WHERE u.id=item.id AND u.email=item.email) THEN
      RAISE EXCEPTION 'ID/email Auth divergente para %; interromper.', item.id;
    END IF;

    INSERT INTO public.profiles(id,name,email,role,access_level,is_active)
    SELECT item.id,item.name,item.email,item.role,
           item.access_level::public.user_access_level,true
    WHERE NOT EXISTS (SELECT 1 FROM public.profiles WHERE id=item.id);

    -- Perfil preexistente compatível é preservado; divergência reverte o lote.
    IF NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=item.id
      AND p.name=item.name AND p.email=item.email AND p.role=item.role
      AND p.access_level::text=item.access_level AND p.is_active=true) THEN
      RAISE EXCEPTION 'Perfil divergente para %; nenhuma atualização automática.',item.id;
    END IF;
  END LOOP;

  IF auth_before IS DISTINCT FROM (
    SELECT md5(coalesce(jsonb_agg(to_jsonb(u) ORDER BY u.id)::text,'[]'))
    FROM auth.users u
  ) THEN RAISE EXCEPTION 'Auth sofreu alteração; reverter.'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM editorial_security.admin_state s WHERE s.singleton
      AND s.active_count=(SELECT count(*) FROM public.profiles
                          WHERE access_level='admin' AND is_active)
      AND s.active_count>=1
  ) THEN RAISE EXCEPTION 'Contador administrativo inconsistente; reverter.'; END IF;
END;
$bootstrap$;
COMMIT;
