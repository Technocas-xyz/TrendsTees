import {useEffect,useState} from 'react';

// Runs an API call when `key` changes; retry() runs it again. Each section uses its own copy, so one failing request does not block the page.
// keepPrevious: keep showing the last result while the next one loads (listing filters), instead of going back to "loading".
// `loading` is true while a request is running.
export function useApi<T>(load:()=>Promise<T>,key:string,keepPrevious=false){
  const [data,setData]=useState<T|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true),[tick,setTick]=useState(0);
  useEffect(()=>{
    let live=true;
    if(!keepPrevious)setData(null);
    setError('');setLoading(true);
    load().then(r=>{if(live)setData(r)}).catch(e=>{if(live)setError(e instanceof Error?e.message:String(e))}).finally(()=>{if(live)setLoading(false)});
    return()=>{live=false};
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[key,tick]);
  return {data,error,loading,retry:()=>setTick(t=>t+1)};
}
