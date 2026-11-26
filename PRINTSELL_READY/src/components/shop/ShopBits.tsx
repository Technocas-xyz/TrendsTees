'use client';
import {useState} from 'react';
import Link from 'next/link';
import {Check,Shirt,Tag} from 'lucide-react';

export const money=(n:number|string)=>'$'+Number(n).toFixed(2);
export const errText=(e:unknown)=>e instanceof Error?e.message:String(e);

// Relative brightness 0..1 of "#rrggbb" (null when not a hex color)
function brightness(hex:string|null|undefined){
  const m=/^#?([0-9a-f]{6})$/i.exec((hex||'').trim());
  if(!m)return null;
  const v=parseInt(m[1],16);
  return (0.299*(v>>16&255)+0.587*(v>>8&255)+0.114*(v&255))/255;
}

// Blank tee in any color with the design printed on the chest.
// Black uses the black mockup; every other color tints the white mockup: a layer in the color, cut to the shirt
// shape with a CSS mask, then the white shirt photo on top with "multiply" so its folds and shadows stay.
export function ColorTee({hex,colorName,image,alt='',className=''}:{hex?:string|null;colorName?:string|null;image?:string|null;alt?:string;className?:string}){
  const b=brightness(hex);
  const black=(colorName||'').trim().toLowerCase()==='black'||(b!==null&&b<0.08)||(!hex&&!colorName);
  const white=!black&&(b===null||b>0.93);
  const tee=black?'black':'white';
  return <span className={'ps-tee sh-tee '+tee+' '+className}>
    {!black&&!white&&<span className="sh-tee-tint" style={{background:hex!}} aria-hidden="true"/>}
    <img className={'ps-tee-img'+(!black&&!white?' sh-tee-shade':'')} src={'/mockups/tee-'+tee+'.png'} alt="" draggable={false}/>
    {image?<img className="ps-tee-design" src={image} alt={alt}/>:<Shirt className="ps-tee-empty" size={26} strokeWidth={1.4} aria-hidden="true"/>}
  </span>;
}

export function Breadcrumb({items}:{items:{label:string;href?:string}[]}){
  return <nav className="sh-crumb" aria-label="Breadcrumb">
    <Link href="/">Home</Link>
    {items.map((x,i)=><span key={i}><span className="sh-crumb-sep" aria-hidden="true">›</span>{x.href?<Link href={x.href}>{x.label}</Link>:<span aria-current="page">{x.label}</span>}</span>)}
  </nav>;
}

// Cart → Checkout → Review & Pay → Order Complete. `active` is the current step (0-3).
const STEPS=['Cart','Checkout','Review & Pay','Order Complete'];
const STEP_LINKS=['/cart','/checkout/shipping',null,null];
export function CheckoutSteps({active}:{active:number}){
  return <ol className="sh-steps" aria-label="Checkout progress">
    {STEPS.map((s,i)=>{
      const done=i<active,current=i===active;
      const body=<><span className="sh-step-dot" aria-hidden="true">{done?<Check size={16} strokeWidth={3}/>:i+1}</span><span className="sh-step-label">{s}</span></>;
      return <li key={s} className={'sh-step'+(done?' done':'')+(current?' current':'')} aria-current={current?'step':undefined}>
        {done&&STEP_LINKS[i]?<Link href={STEP_LINKS[i]!}>{body}</Link>:body}
      </li>;
    })}
  </ol>;
}

// Loading / error block with Retry
export function LoadState({error,retry,label='Loading…'}:{error:string;retry:()=>void;label?:string}){
  return <div className="sh-load">{error?<><p className="error">{error}</p><button type="button" className="ps-btn ps-btn-purple" onClick={retry}>Retry</button></>:<p className="sh-muted" aria-busy="true">{label}</p>}</div>;
}

// Promo code box (no promo system yet: Apply only shows a message)
export function PromoBox(){
  const [code,setCode]=useState(''),[msg,setMsg]=useState('');
  return <form className="sh-promo" onSubmit={e=>{e.preventDefault();setMsg('Promo codes coming soon.')}}>
    <label className="sh-promo-field"><Tag size={16} aria-hidden="true"/><input value={code} onChange={e=>{setCode(e.target.value);setMsg('')}} placeholder="Enter promo code" aria-label="Promo code" maxLength={40}/></label>
    <button type="submit" className="sh-promo-apply">Apply</button>
    {msg&&<p className="sh-promo-msg" role="status">{msg}</p>}
  </form>;
}
