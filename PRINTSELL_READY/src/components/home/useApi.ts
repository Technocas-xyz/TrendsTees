import {useEffect,useState} from 'react';

// Runs an API call when `key` changes; retry() runs it again. Each Home section uses its own copy, so one failing request does not block the page.
export function useApi<T>(load:()=>Promise<T>,key:string){
  const [data,setData]=useState<T|null>(null),[error,setError]=useState(''),[tick,setTick]=useState(0);
  useEffect(()=>{
    let live=true;
    setData(null);setError('');
    load().then(r=>{if(live)setData(r)}).catch(e=>{if(live)setError(e instanceof Error?e.message:String(e))});
    return()=>{live=false};
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[key,tick]);
  return {data,error,retry:()=>setTick(t=>t+1)};
}
