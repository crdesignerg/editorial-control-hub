BEGIN READ ONLY;
SELECT jsonb_build_object(
  'profiles',(SELECT jsonb_agg(jsonb_build_object(
    'id',p.id,'name',p.name,'email',p.email,'role',p.role,
    'access_level',p.access_level,'is_active',p.is_active,
    'auth_link_matches',u.id=p.id AND u.email=p.email) ORDER BY p.name)
    FROM public.profiles p JOIN auth.users u ON u.id=p.id
    WHERE p.id IN ('2b5e8df8-72b2-4b39-ab10-e5a2e0c9bd08',
                   '534d1fd6-2d06-4360-ae43-2050ea14e9cd')),
  'auth_users_total',(SELECT count(*) FROM auth.users),
  'profiles_total',(SELECT count(*) FROM public.profiles),
  'active_admins',(SELECT count(*) FROM public.profiles
                   WHERE access_level='admin' AND is_active),
  'guard_count',(SELECT active_count FROM editorial_security.admin_state WHERE singleton)
) AS bootstrap_verification;
ROLLBACK;
