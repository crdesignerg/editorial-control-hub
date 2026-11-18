import { useCallback, useEffect, useRef, useState } from 'react';
import type { Client, EditorialContent } from '../types/domain';
import * as api from '../services/editorial';
import { errorMessage } from '../lib/errors';
export function useEditorial(userId?: string) {
  const [clients,setClients] = useState<Client[]>([]);
  const [contents,setContents] = useState<EditorialContent[]>([]);
  const [error,setError] = useState<string|null>(null);
  const [loading,setLoading] = useState(false);
  const [saving,setSaving] = useState(false);
  const epoch = useRef(0);
  const pending = useRef(new Map<string,Partial<EditorialContent>>());
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const running = useRef<Promise<void>|null>(null);
  const reload = useCallback(async () => {
    if(!userId) return;
    const version=epoch.current; setLoading(true);
    try { const data=await api.loadEditorialData(); if(version===epoch.current){setClients(data.clients);setContents(data.contents);setError(null);} }
    catch(e){if(version===epoch.current)setError(errorMessage(e));}
    finally{if(version===epoch.current)setLoading(false);}
  },[userId]);
  useEffect(()=>{
    ++epoch.current; pending.current.clear(); clearTimeout(timer.current);
    setClients([]);setContents([]);setError(null);setSaving(false);
    if(userId)void reload();
    return ()=>{++epoch.current;clearTimeout(timer.current);};
  },[userId,reload]);
  const flush = useCallback(async ():Promise<void> => {
    clearTimeout(timer.current);
    if(running.current){ await running.current; if(pending.current.size) return flush(); return; }
    if(!userId || !pending.current.size)return;
    const version=epoch.current; setSaving(true);
    const task=(async()=>{
      while(pending.current.size && version===epoch.current){
        const [id,patch]=pending.current.entries().next().value!;
        pending.current.delete(id);
        try {
          const saved=await api.updateContent(id,patch,userId);
          if(version===epoch.current)setContents(rows=>rows.map(row=>row.id===id?{...saved,...pending.current.get(id)}:row));
        }catch(e){
          if(version===epoch.current){pending.current.set(id,{...patch,...pending.current.get(id)});setError(errorMessage(e));}
          throw e;
        }
      }
      if(version===epoch.current)setError(null);
    })();
    running.current=task;
    try{await task;}finally{running.current=null;if(version===epoch.current)setSaving(pending.current.size>0);}
  },[userId]);
  useEffect(()=>{
    const warn=(e:BeforeUnloadEvent)=>{if(pending.current.size||running.current){e.preventDefault();}};
    window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);
  },[]);
  function update(id:string,patch:Partial<EditorialContent>){
    setContents(rows=>rows.map(row=>row.id===id?{...row,...patch}:row));
    pending.current.set(id,{...pending.current.get(id),...patch});setSaving(true);
    clearTimeout(timer.current);timer.current=setTimeout(()=>void flush().catch(()=>{}),650);
  }
  async function create(input:Omit<EditorialContent,'id'>){
    if(!userId)throw new Error('Sem sessão');
    const version=epoch.current;
    const row=await api.createContent(input,userId);if(version===epoch.current)setContents(rows=>[...rows,row]);
  }
  async function saveClient(input:Omit<Client,'id'>,id?:string){
    if(!userId)throw new Error('Sem sessão');
    const version=epoch.current;
    const row=await api.saveClient(input,userId,id);if(version===epoch.current)setClients(rows=>id?rows.map(c=>c.id===id?row:c):[...rows,row]);
  }
  async function remove(id:string){const version=epoch.current;await flush();if(version!==epoch.current)return;await api.deleteContent(id);if(version===epoch.current)setContents(rows=>rows.filter(row=>row.id!==id));}
  return {clients,contents,error,loading,saving,reload,flush,update,create,saveClient,remove};
}
