import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { getProfile, signOut } from '../services/auth';
import { errorMessage } from '../lib/errors';
import type { AuthUser } from '../types/domain';
export function useSession() {
  const [user,setUser] = useState<AuthUser|null>(null);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState<string|null>(null);
  const [recovery,setRecovery] = useState(false);
  const generation = useRef(0);
  useEffect(() => {
    let alive = true;
    async function refresh() {
      const version = ++generation.current;
      try {
        const {data,error} = await supabase.auth.getSession();
        if (error) throw error;
        const profile = data.session ? await getProfile(data.session.user.id) : null;
        if (alive && generation.current===version) { setUser(profile); setError(null); }
      } catch(e) {
        if (alive && generation.current===version) { setUser(null); setError(errorMessage(e)); }
      } finally { if(alive && generation.current===version) setLoading(false); }
    }
    const {data:{subscription}} = supabase.auth.onAuthStateChange((event) => {
      if (!alive) return;
      if (event==='PASSWORD_RECOVERY') setRecovery(true);
      if (event==='SIGNED_OUT') { ++generation.current; setUser(null); setRecovery(false); setLoading(false); }
      else setTimeout(() => { if(alive) void refresh(); },0);
    });
    void refresh();
    const onFocus = () => void refresh();
    window.addEventListener('focus',onFocus);
    return () => { alive=false; ++generation.current; subscription.unsubscribe(); window.removeEventListener('focus',onFocus); };
  },[]);
  return {user,loading,error,recovery,finishRecovery:()=>setRecovery(false),logout:signOut};
}
