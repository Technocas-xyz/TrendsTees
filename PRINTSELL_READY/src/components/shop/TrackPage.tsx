'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {ArrowRight,Check,Mail,MapPin,Package,Search,Truck} from 'lucide-react';
import {imageUrl,trackOrder,type ApiTrackedOrder} from '@/lib/api';
import {Breadcrumb,ColorTee,errText,money} from './ShopBits';

// Customer-facing steps. Each one covers one or more backend order statuses.
const STEPS:{label:string;statuses:string[]}[]=[
  {label:'Placed',statuses:['payment_pending','confirmed']},
  {label:'Processing',statuses:['printing']},
  {label:'Printed',statuses:['quality_check','packed']},
  {label:'Shipped',statuses:['shipped']},
  {label:'Delivered',statuses:['delivered']},
];
const stepIndex=(status:string)=>STEPS.findIndex(s=>s.statuses.includes(status));
const niceStatus=(s:string)=>s.replace(/_/g,' ').replace(/^./,c=>c.toUpperCase());
const dateText=(s:string)=>new Date(s).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
// Optional shipment details: the API does not send them yet, so they only show when present
type Shipment={tracking_number?:string|null;carrier?:string|null;tracking_url?:string|null};

// /track-order (optionally ?code=...&email=... to look up straight away)
export function TrackPage({initialCode='',initialEmail=''}:{initialCode?:string;initialEmail?:string}){
  const [code,setCode]=useState(initialCode),[email,setEmail]=useState(initialEmail);
  const [order,setOrder]=useState<ApiTrackedOrder|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  async function lookup(c:string,e:string){
    setBusy(true);setError('');setOrder(null);
    try{setOrder(await trackOrder(c.trim(),e.trim()))}catch(err){setError(errText(err))}finally{setBusy(false)}
  }
  useEffect(()=>{if(initialCode&&initialEmail)lookup(initialCode,initialEmail)},[]);

  return <main className="sh-page sh-tr">
    <div className="sh-wrap">
      <Breadcrumb items={[{label:'Track Order'}]}/>
      <section className="sh-card sh-tr-card" aria-labelledby="sh-tr-title">
        <span className="sh-tr-icon" aria-hidden="true"><Package size={28}/></span>
        <h1 id="sh-tr-title">Track Your Order</h1>
        <p className="sh-muted">Enter your order number and the email you used at checkout.</p>
        <form className="sh-tr-form" onSubmit={e=>{e.preventDefault();lookup(code,email)}}>
          <label className="sh-field">Order Number <i aria-hidden="true">*</i>
            <span className="sh-input"><Package aria-hidden="true"/><input required value={code} onChange={e=>setCode(e.target.value)} placeholder="Order number" autoComplete="off" aria-invalid={!!error}/></span></label>
          <label className="sh-field">Email Address <i aria-hidden="true">*</i>
            <span className="sh-input"><Mail aria-hidden="true"/><input required type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" aria-invalid={!!error}/></span></label>
          {error&&<p className="sh-form-err" role="alert">{error}</p>}
          <button className="ps-btn ps-btn-purple sh-tr-btn" type="submit" disabled={busy}><Search size={18} aria-hidden="true"/>{busy?'Searching…':'Track Order'}</button>
        </form>
      </section>
      {order&&<OrderResult order={order}/>}
      {order&&<div className="sh-tr-after"><Link className="sh-outline-btn" href="/">Back to home</Link><Link className="ps-btn ps-btn-purple" href="/designs">Continue shopping <ArrowRight size={16} aria-hidden="true"/></Link></div>}
    </div>
  </main>;
}

function OrderResult({order}:{order:ApiTrackedOrder}){
  const idx=stepIndex(order.order_status);
  const ship=order as ApiTrackedOrder&Shipment;
  const disc=Number(order.discount_total),shipTotal=Number(order.shipping_total);
  // when each step was reached (first status-history entry that belongs to the step)
  const reached=(i:number)=>order.status_history.find(h=>STEPS[i].statuses.includes(h.status_code))?.changed_at;
  const count=order.items.reduce((s,x)=>s+x.quantity,0);
  return <div className="sh-tr-result" aria-live="polite">
    <section className="sh-card sh-tr-head">
      <div><small>Order Number</small><b>{order.order_public_code}</b></div>
      <div><small>Placed</small><b>{dateText(order.placed_at)}</b></div>
      <div><small>Items</small><b>{count}</b></div>
      <div><small>Total</small><b>{money(order.order_total)}</b></div>
      <div><small>Status</small><span className={'sh-tr-pill'+(idx<0?' other':'')}>{idx>=0?STEPS[idx].label:niceStatus(order.order_status)}</span></div>
    </section>

    <section className="sh-card sh-tr-sec" aria-labelledby="sh-tr-prog">
      <h2 id="sh-tr-prog">Order Progress</h2>
      {idx>=0?<ol className="sh-tl">
        {STEPS.map((s,i)=>{
          const when=reached(i);
          return <li key={s.label} className={'sh-tl-step'+(i<idx?' done':'')+(i===idx?' current':'')} aria-current={i===idx?'step':undefined}>
            <span className="sh-tl-dot" aria-hidden="true">{i<=idx?<Check size={i===idx?18:16} strokeWidth={3}/>:i+1}</span>
            <span className="sh-tl-label">{s.label}</span>
            <small>{when?dateText(when):i<=idx?'':'Pending'}</small>
          </li>;
        })}
      </ol>:<p className="sh-muted">Current status: <b>{niceStatus(order.order_status)}</b></p>}
      {(ship.tracking_number||ship.carrier)&&<div className="sh-tr-ship"><Truck aria-hidden="true"/>
        <div>{ship.carrier&&<span>Carrier: <b>{ship.carrier}</b></span>}{ship.tracking_number&&<span>Tracking number: <b>{ship.tracking_url?<a href={ship.tracking_url} target="_blank" rel="noopener noreferrer">{ship.tracking_number}</a>:ship.tracking_number}</b></span>}</div></div>}
    </section>

    <div className="sh-tr-cols">
      <section className="sh-card sh-tr-sec" aria-labelledby="sh-tr-items">
        <h2 id="sh-tr-items">Order Items</h2>
        <ul className="sh-sum-items sh-tr-items">{order.items.map((x,i)=><li key={i}>
          <span className="sh-sum-pic"><ColorTee colorName={x.color_name} image={imageUrl(x.preview_url)}/></span>
          <div><b>{x.title}</b>{x.product_name&&<small>{x.product_name}</small>}<small>{[x.size_code&&'Size: '+x.size_code,x.color_name&&'Color: '+x.color_name].filter(Boolean).join('  ')}</small><small className="sh-sum-q">Qty: {x.quantity}</small></div>
          <b className="sh-sum-total">{money(x.line_total)}</b>
        </li>)}</ul>
      </section>
      <div className="sh-tr-side">
        {order.shipping_address&&<section className="sh-card sh-tr-sec" aria-labelledby="sh-tr-addr">
          <h2 id="sh-tr-addr">Shipping Address</h2>
          <p className="sh-tr-addr"><MapPin aria-hidden="true"/><span>{order.shipping_address.recipient_name}<br/>{order.shipping_address.city}, {order.shipping_address.country_code}</span></p>
        </section>}
        <section className="sh-card sh-tr-sec" aria-labelledby="sh-tr-sum">
          <h2 id="sh-tr-sum">Order Summary</h2>
          <div className="sh-row"><span>Subtotal</span><b>{money(order.item_subtotal)}</b></div>
          {disc>0&&<div className="sh-row disc"><span>{order.discount_name||'Discount'}</span><b>−{money(disc)}</b></div>}
          <div className="sh-row"><span>Shipping</span><b>{shipTotal===0?'FREE':money(shipTotal)}</b></div>
          <div className="sh-row"><span>Tax</span><b>{money(order.tax_total)}</b></div>
          <div className="sh-row total"><span>Total</span><b>{money(order.order_total)}</b></div>
        </section>
      </div>
    </div>
  </div>;
}
