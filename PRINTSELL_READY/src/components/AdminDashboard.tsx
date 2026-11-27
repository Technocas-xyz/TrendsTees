'use client';
// Admin dashboard. Every number comes from GET /admin/dashboard; with no data the widgets show 0 or an empty state.
import {useState} from 'react';
import Link from 'next/link';
import {ArrowRight,ShoppingBag,Users,Shirt,CircleDollarSign,TriangleAlert,Activity,ArrowUp,ArrowDown,CircleCheck} from 'lucide-react';
import {getAdminDashboard,imageUrl,type ApiAdminDashboard,type ApiMe} from '@/lib/api';
import {useLoad,LoadState,StatusPill,when,label,can} from './AdminPanels';

const RANGES=[7,30,90];
const money=(n:string|number)=>'$'+Number(n).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
const short=(day:string)=>new Date(day+'T00:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'});
const STATUS_COLORS:Record<string,string>={payment_pending:'#f59e0b',confirmed:'#6937ed',printing:'#3b82f6',quality_check:'#06b6d4',packed:'#8b5cf6',shipped:'#0ea5e9',delivered:'#16a34a',cancelled:'#ef4444',refunded:'#9ca3af'};

// Status codes in audit text (moved from payment_pending to confirmed) read like the status badges
const readable=(text:string)=>text.replace(/(moved from )(\w+)( to )(\w+)/g,(_,a,x,b,y)=>a+label(x)+b+label(y));
function ago(s:string){const m=Math.max(0,Math.round((Date.now()-new Date(s).getTime())/60000));if(m<1)return 'just now';if(m<60)return m+' min ago';const h=Math.round(m/60);if(h<24)return h+(h===1?' hour ago':' hours ago');const d=Math.round(h/24);return d+(d===1?' day ago':' days ago')}

function Change({pct,days}:{pct:number|null;days:number}){
  if(pct===null)return <span className="adm-delta none">No data for the previous {days} days</span>;
  const up=pct>=0;
  return <span className={'adm-delta '+(up?'up':'down')}>{up?<ArrowUp size={12}/>:<ArrowDown size={12}/>}{up?'+':''}{pct}% <em>vs. previous {days} days</em></span>;
}

function Spark({values,color}:{values:number[];color:string}){
  const max=Math.max(...values,0),n=values.length;
  if(n<2||max===0)return <svg className="adm-spark" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true"><line x1="0" y1="38" x2="100" y2="38" stroke={color} strokeOpacity=".35" strokeWidth="2"/></svg>;
  const pts=values.map((v,i)=>[i/(n-1)*100,38-(v/max)*34]);
  const line=pts.map((p,i)=>(i?'L':'M')+p[0].toFixed(1)+' '+p[1].toFixed(1)).join(' ');
  return <svg className="adm-spark" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true"><path d={line+' L100 40 L0 40 Z'} fill={color} fillOpacity=".14"/><path d={line} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke"/></svg>;
}

function StatCard({title,value,change,days,color,icon,series}:{title:string;value:string;change:number|null;days:number;color:string;icon:React.ReactNode;series:number[]}){
  return <div className="adm-kpi"><div className="adm-kpi-icon" style={{background:color+'1f',color}}>{icon}</div><div className="adm-kpi-body"><small>{title}</small><strong>{value}</strong><Change pct={change} days={days}/></div><Spark values={series} color={color}/></div>;
}

function LineChart({points,money:isMoney}:{points:{day:string;v:number}[];money:boolean}){
  const [hover,setHover]=useState<number|null>(null);
  const W=700,H=300,L=48,B=26,T=10,R=10;
  const max=Math.max(...points.map(p=>p.v),0);
  const top=max===0?1:niceMax(max);
  const x=(i:number)=>L+(points.length<2?0:i/(points.length-1))*(W-L-R);
  const y=(v:number)=>T+(1-v/top)*(H-T-B);
  const line=points.map((p,i)=>(i?'L':'M')+x(i).toFixed(1)+' '+y(p.v).toFixed(1)).join(' ');
  const ticks=[0,.25,.5,.75,1].map(f=>f*top);
  const fmt=(v:number)=>isMoney?'$'+(v>=1000?(v/1000).toFixed(v%1000===0?0:1)+'k':v.toFixed(v<10&&v%1!==0?1:0)):String(Math.round(v*10)/10);
  const step=Math.max(1,Math.ceil(points.length/7));
  const h=hover!==null?points[hover]:null;
  return <div className="adm-chart">
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Chart" onMouseLeave={()=>setHover(null)} onMouseMove={e=>{const r=e.currentTarget.getBoundingClientRect(),px=(e.clientX-r.left)/r.width*W;setHover(Math.max(0,Math.min(points.length-1,Math.round((px-L)/(W-L-R)*(points.length-1)))))}}>
      <defs><linearGradient id="admfill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#6937ed" stopOpacity=".28"/><stop offset="1" stopColor="#6937ed" stopOpacity="0"/></linearGradient></defs>
      {ticks.map(t=><g key={t}><line x1={L} x2={W-R} y1={y(t)} y2={y(t)} stroke="#eceef5"/><text x={L-8} y={y(t)+4} textAnchor="end" fontSize="11" fill="#7a8399">{fmt(t)}</text></g>)}
      {points.map((p,i)=>i%step===0&&<text key={p.day} x={x(i)} y={H-6} textAnchor="middle" fontSize="11" fill="#7a8399">{short(p.day)}</text>)}
      {points.length>1&&<><path d={line+` L${x(points.length-1)} ${y(0)} L${x(0)} ${y(0)} Z`} fill="url(#admfill)"/><path d={line} fill="none" stroke="#6937ed" strokeWidth="2.5" strokeLinejoin="round"/></>}
      {h&&hover!==null&&<><line x1={x(hover)} x2={x(hover)} y1={T} y2={H-B} stroke="#6937ed" strokeOpacity=".3"/><circle cx={x(hover)} cy={y(h.v)} r="5" fill="#fff" stroke="#6937ed" strokeWidth="2.5"/></>}
    </svg>
    {h&&hover!==null&&<div className="adm-tip" style={{left:Math.min(80,Math.max(12,x(hover)/W*100))+'%'}}><small>{short(h.day)}</small><b>{isMoney?money(h.v):h.v}</b></div>}
  </div>;
}
function niceMax(v:number){const p=Math.pow(10,Math.floor(Math.log10(v))),f=v/p;return (f<=1?1:f<=2?2:f<=2.5?2.5:f<=5?5:10)*p}

function Donut({by}:{by:Record<string,number>}){
  const entries=Object.entries(by).filter(([,n])=>n>0),total=entries.reduce((a,[,n])=>a+n,0);
  const R=62,C=2*Math.PI*R;let off=0;
  return <div className="adm-donut">
    <div className="adm-donut-ring"><svg viewBox="0 0 160 160" aria-hidden="true"><circle cx="80" cy="80" r={R} fill="none" stroke="#eef0f6" strokeWidth="22"/>
      {entries.map(([s,n])=>{const len=n/total*C,el=<circle key={s} cx="80" cy="80" r={R} fill="none" stroke={STATUS_COLORS[s]||'#9ca3af'} strokeWidth="22" strokeDasharray={`${len} ${C-len}`} strokeDashoffset={-off} transform="rotate(-90 80 80)"/>;off+=len;return el})}</svg>
      <div><strong>{total}</strong><small>Total Orders</small></div></div>
    {total===0?<p className="adm-muted">No orders in this period.</p>:<ul>{entries.map(([s,n])=><li key={s}><i style={{background:STATUS_COLORS[s]||'#9ca3af'}}/><span>{label(s)}</span><b>{n}</b><em>{(n/total*100).toFixed(1)}%</em></li>)}</ul>}
  </div>;
}

function Pic({url,title}:{url:string|null;title:string}){
  return <span className="adm-tee"><img className="adm-tee-img" src="/mockups/tee-black.png" alt="" loading="lazy"/>{url&&<img className="adm-tee-art" src={imageUrl(url)!} alt={title} loading="lazy"/>}</span>;
}

export function AdminDashboard({me}:{me:ApiMe}){
  const [days,setDays]=useState(30),[tab,setTab]=useState<'revenue'|'orders'|'customers'>('revenue');
  const a=useLoad(()=>getAdminDashboard(days),'dash|'+days);
  const first=me.full_name.trim().split(/\s+/)[0]||'there';
  const head=<div className="adm-welcome"><div><h1>Welcome back, {first}! <span aria-hidden="true">👋</span></h1><p>Here&apos;s what&apos;s happening on PrintSteez today.</p></div>
    <label className="adm-range"><span className="adm-sr">Date range</span><select value={days} onChange={e=>setDays(Number(e.target.value))}>{RANGES.map(d=><option key={d} value={d}>Last {d} Days</option>)}</select></label></div>;
  if(!a.data)return <>{head}<LoadState error={a.error} retry={a.retry}/></>;
  const d:ApiAdminDashboard=a.data,s=d.stats,showRevenue=s.revenue!==null;
  const active=tab==='revenue'&&!showRevenue?'orders':tab;
  const points=d.series.map(p=>({day:p.day,v:Number(active==='revenue'?p.revenue??0:active==='orders'?p.orders:p.customers)}));
  const sum=points.reduce((x,p)=>x+p.v,0);
  const tabs:[typeof tab,string][]=[...(showRevenue?[['revenue','Revenue'] as [typeof tab,string]]:[]),['orders','Orders'],['customers','Customers']];
  const sc=(k:'revenue'|'orders'|'customers')=>d.series.map(p=>Number(k==='revenue'?p.revenue??0:p[k]));
  const canOrders=can(me,'orders.view'),canDesigns=can(me,'designs.view');
  return <>
    {head}
    <div className="adm-kpis">
      {showRevenue&&<StatCard title="Total Revenue" value={money(s.revenue!.value)} change={s.revenue!.change_pct} days={d.days} color="#6937ed" icon={<CircleDollarSign/>} series={sc('revenue')}/>}
      <StatCard title="Total Orders" value={String(s.orders.value)} change={s.orders.change_pct} days={d.days} color="#f97316" icon={<ShoppingBag/>} series={sc('orders')}/>
      <StatCard title="New Customers" value={String(s.customers.value)} change={s.customers.change_pct} days={d.days} color="#7c5cf0" icon={<Users/>} series={sc('customers')}/>
      <StatCard title="Published Designs" value={String(s.designs.value)} change={s.designs.change_pct} days={d.days} color="#f97316" icon={<Shirt/>} series={[]}/>
    </div>
    <div className="adm-row two">
      <section className="adm-panel"><div className="adm-chart-head"><div><h2>{label(active)}</h2><strong className="adm-big">{active==='revenue'?money(sum):sum}</strong><span className="adm-muted"> in the last {d.days} days</span></div>
        <div className="adm-seg">{tabs.map(([k,n])=><button key={k} className={active===k?'on':''} onClick={()=>setTab(k)}>{n}</button>)}</div></div>
        <LineChart points={points} money={active==='revenue'}/></section>
      <section className="adm-panel"><div className="adm-panel-head"><h2>Order Status</h2>{canOrders&&<Link href="/admin/orders" className="adm-link">View Orders <ArrowRight size={14}/></Link>}</div><Donut by={d.orders_by_status}/></section>
    </div>
    <div className="adm-row two">
      <section className="adm-panel"><div className="adm-panel-head"><h2>Recent Orders</h2>{canOrders&&<Link href="/admin/orders" className="adm-link">View All Orders <ArrowRight size={14}/></Link>}</div>
        {d.recent_orders.length===0?<div className="adm-empty">No orders yet.</div>:<div className="adm-scroll"><table className="adm-table adm-fixed"><colgroup><col style={{width:112}}/><col style={{width:96}}/><col/><col style={{width:70}}/><col style={{width:142}}/><col style={{width:58}}/></colgroup><thead><tr><th>Order #</th><th>Customer</th><th>Product</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead><tbody>
          {d.recent_orders.map(o=><tr key={o.order_public_code}><td><b className="adm-code">#{o.order_public_code}</b></td><td className="adm-ell" title={o.customer}>{o.customer}</td>
            <td><div className="adm-prod"><Pic url={o.preview_url} title={o.title||''}/><span><b title={o.title||undefined}>{o.title||'Order items'}</b><small>{[[o.size_code,o.color_name].filter(Boolean).join(' / '),o.item_count>1?'+'+(o.item_count-1)+' more':''].filter(Boolean).join(' · ')}</small></span></div></td>
            <td>{money(o.order_total)}</td><td><StatusPill status={o.order_status}/></td><td>{new Date(o.placed_at).toLocaleDateString('en-US',{month:'short',day:'numeric'})}</td></tr>)}
        </tbody></table></div>}</section>
      <section className="adm-panel"><div className="adm-panel-head"><h2>Top Products</h2>{canDesigns&&<Link href="/admin/designs" className="adm-link">View All Designs <ArrowRight size={14}/></Link>}</div>
        {d.top_products.length===0?<div className="adm-empty">No sales in this period.</div>:<ul className="adm-top">{d.top_products.map(t=><li key={t.design_id}><Pic url={t.preview_url} title={t.title||''}/><div><b>{t.title||'Design'}</b><small>{t.units} sold</small></div>{t.revenue!==null&&<strong>{money(t.revenue)}</strong>}</li>)}</ul>}</section>
    </div>
    <div className={'adm-row '+(d.inventory.has_inventory?'two even':'one')+(d.inventory.has_inventory&&d.inventory.low_stock.length===0?' top':'')}>
      <section className="adm-panel"><div className="adm-panel-head"><h2>Recent Activity</h2></div>
        {d.activity.length===0?<div className="adm-empty">No activity yet.</div>:<ul className="adm-activity">{d.activity.map((x,i)=><li key={i}><span className="adm-act-icon">{x.kind==='order'?<ShoppingBag size={15}/>:<Activity size={15}/>}</span><span>{readable(x.text)}</span><small title={when(x.at)}>{ago(x.at)}</small></li>)}</ul>}</section>
      {d.inventory.has_inventory&&<section className="adm-panel"><div className="adm-panel-head"><h2>Inventory Alerts</h2></div>
        {d.inventory.low_stock.length===0?<div className="adm-allgood"><CircleCheck size={18}/> All stock levels look good</div>:<ul className="adm-alerts">{d.inventory.low_stock.map((v,i)=><li key={i}><span className="adm-alert-icon"><TriangleAlert size={16}/></span><div><b>Low stock: {v.product_name}{[v.color_name,v.size_code].filter(Boolean).length>0&&' ('+[v.color_name,v.size_code].filter(Boolean).join(' / ')+')'}</b><small>{v.available} units remaining</small></div><span className="adm-count">{v.available}</span></li>)}</ul>}</section>}
    </div>
  </>;
}
