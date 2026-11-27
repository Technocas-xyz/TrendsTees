'use client';
// Top bar search: orders by order number or email, designs by title (only what the user may view)
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {Search} from 'lucide-react';
import {getAdminOrders,getAdminDesigns,type ApiMe} from '@/lib/api';
import {can} from './AdminPanels';

type Hit={href:string;title:string;note:string};
export function AdminSearch({me}:{me:ApiMe}){
  const [q,setQ]=useState(''),[open,setOpen]=useState(false),[orders,setOrders]=useState<Hit[]>([]),[designs,setDesigns]=useState<Hit[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const box=useRef<HTMLDivElement>(null);
  const canOrders=can(me,'orders.view'),canDesigns=can(me,'designs.view');
  useEffect(()=>{
    const term=q.trim();
    if(term.length<2){setOrders([]);setDesigns([]);setBusy(false);setError('');return}
    setBusy(true);setError('');
    let live=true;
    const t=setTimeout(()=>{
      Promise.all([
        canOrders?getAdminOrders({search:term,limit:5}):Promise.resolve(null),
        canDesigns?getAdminDesigns({search:term,limit:5}):Promise.resolve(null),
      ]).then(([o,d])=>{
        if(!live)return;
        setOrders(o?o.items.map(x=>({href:'/admin/orders?order='+encodeURIComponent(x.order_public_code),title:x.order_public_code,note:x.customer_name||x.contact_email})):[]);
        setDesigns(d?d.items.map(x=>({href:'/admin/designs/'+encodeURIComponent(x.public_design_code),title:x.title,note:x.design_status})):[]);
        setBusy(false);
      }).catch(e=>{if(live){setError(e instanceof Error?e.message:String(e));setBusy(false)}});
    },250);
    return()=>{live=false;clearTimeout(t)};
  },[q,canOrders,canDesigns]);
  useEffect(()=>{const close=(e:MouseEvent)=>{if(box.current&&!box.current.contains(e.target as Node))setOpen(false)};document.addEventListener('mousedown',close);return()=>document.removeEventListener('mousedown',close)},[]);
  if(!canOrders&&!canDesigns)return <div className="adm-top-spacer"/>;
  const placeholder=[canOrders&&'orders',canDesigns&&'designs'].filter(Boolean).join(' and ');
  const group=(name:string,hits:Hit[])=>hits.length>0&&<div className="adm-results-group"><small>{name}</small>{hits.map(h=><Link key={h.href} href={h.href} onClick={()=>{setOpen(false);setQ('')}}><b>{h.title}</b><span>{h.note}</span></Link>)}</div>;
  return <div className="adm-top-search" ref={box}><Search size={18}/><input aria-label="Search" placeholder={'Search '+placeholder+'…'} value={q} onChange={e=>{setQ(e.target.value);setOpen(true)}} onFocus={()=>setOpen(true)}/>
    {open&&q.trim().length>=2&&<div className="adm-results">{error?<p className="adm-muted">{error}</p>:busy?<p className="adm-muted">Searching…</p>:orders.length+designs.length===0?<p className="adm-muted">No matches.</p>:<>{group('Orders',orders)}{group('Designs',designs)}</>}</div>}</div>;
}
