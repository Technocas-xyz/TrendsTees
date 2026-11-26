'use client';
import {useState} from 'react';
import Link from 'next/link';
import {ArrowRight,Mail,Palette,RotateCcw,Send,ShieldCheck,Truck} from 'lucide-react';
import {getActiveProducts,getDesigns,toDesign,type ApiInterest,type DesignParams} from '@/lib/api';
import {COLLECTIONS,FREE_SHIPPING_LABEL,PRODUCT_TYPES,collectionHref,collectionImage,productTypeHref} from '@/lib/config';
import {ProductCard,ProductCardSkeleton} from './ProductCard';
import {Flame,InterestIcon} from './interestIcons';
import {useApi} from './useApi';

type Wish={onWish:(id:string)=>void;wishlist:string[]};

function SectionHead({id,title,subtitle,href,linkText,flame}:{id:string;title:string;subtitle?:string;href?:string;linkText?:string;flame?:boolean}){
  return <div className="ps-head">
    <div><h2 id={id}>{title}{flame&&<Flame/>}</h2>{subtitle&&<p>{subtitle}</p>}</div>
    {href&&linkText&&<Link href={href} className="ps-viewall">{linkText} <ArrowRight size={15} strokeWidth={2.4}/></Link>}
  </div>;
}

export function SectionError({error,retry}:{error:string;retry:()=>void}){
  return <div className="ps-error"><p className="error">{error}</p><button type="button" className="ps-btn ps-btn-purple" onClick={retry}>Retry</button></div>;
}

// ---- Shop by Interest ----
export function InterestsSection({interests,error,retry}:{interests:ApiInterest[]|null;error:string;retry:()=>void}){
  return <section className="ps-section" aria-labelledby="ps-interest-title">
    <SectionHead id="ps-interest-title" title="Shop by Interest" href="/designs" linkText="View All Categories"/>
    {error?<SectionError error={error} retry={retry}/>:!interests?
      <div className="ps-interests" aria-hidden="true">{Array.from({length:12},(_,i)=><span key={i} className="ps-interest ps-skel-box"/>)}</div>:
      <div className="ps-interests">{interests.slice(0,12).map(x=><Link key={x.category_id} href={'/designs?category='+encodeURIComponent(x.category_slug)} className="ps-interest"><InterestIcon slug={x.category_slug}/><span>{x.category_name}</span></Link>)}</div>}
  </section>;
}

// ---- Trending / Bestsellers / New Arrivals ----
export function DesignRow({id,title,subtitle,href,linkText,params,badge,flame,hideWhenEmpty=false,onWish,wishlist}:{id:string;title:string;subtitle:string;href:string;linkText:string;params:DesignParams&{limit:number};badge?:'New'|'Bestseller';flame?:boolean;hideWhenEmpty?:boolean}&Wish){
  const a=useApi(async()=>(await getDesigns(params)).map(toDesign),'row|'+JSON.stringify(params));
  if(a.data&&a.data.length===0&&hideWhenEmpty)return null;
  return <section className="ps-section" aria-labelledby={id}>
    <SectionHead id={id} title={title} subtitle={subtitle} href={href} linkText={linkText} flame={flame}/>
    {a.error?<SectionError error={a.error} retry={a.retry}/>:!a.data?
      <div className="ps-row" aria-busy="true">{Array.from({length:params.limit},(_,i)=><ProductCardSkeleton key={i}/>)}</div>:
      a.data.length===0?<p className="ps-muted">No designs yet. Check back soon.</p>:
      <div className="ps-row">{a.data.map((d,i)=><ProductCard key={d.id} design={d} index={i} badge={badge} wished={wishlist.includes(d.id)} onWish={onWish}/>)}</div>}
  </section>;
}

// ---- Shop by Product Type ----
// Types with an active product link to /designs?product_type=<slug>. The others are not links and show "Coming soon".
const TYPE_TEXT:Record<string,{text:string;img:string}>={
  tshirt:{text:'Classic graphic tees for every style.',img:'/products/tshirt.png'},
  hoodie:{text:'Cozy comfort with bold designs.',img:'/products/hoodie.png'},
  longsleeve:{text:'Graphic styles for cooler days.',img:'/products/longsleeve.png'},
  sweatshirt:{text:'Everyday comfort, original designs.',img:'/products/sweatshirt.png'},
};
export function ProductTypes(){
  const a=useApi(()=>getActiveProducts(),'product-types');
  const sold=new Set((a.data||[]).map(p=>p.product_type));
  return <section className="ps-section" aria-labelledby="ps-types-title">
    <SectionHead id="ps-types-title" title="Shop by Product Type" subtitle="More than just tees. Find your perfect fit."/>
    {a.error?<SectionError error={a.error} retry={a.retry}/>:!a.data?
      <div className="ps-types" aria-hidden="true">{PRODUCT_TYPES.map(t=><span key={t.slug} className="ps-type ps-skel-box"/>)}</div>:
      <div className="ps-types">{PRODUCT_TYPES.map(t=>{
        const on=sold.has(t.api),info=TYPE_TEXT[t.slug];
        const body=<><img src={info.img} alt="" loading="lazy"/><span className="ps-type-text"><b>{t.label}</b><small>{info.text}</small>{on?<span className="ps-circle" aria-hidden="true"><ArrowRight size={14} strokeWidth={2.6}/></span>:<span className="ps-soon">Coming soon</span>}</span></>;
        return on?<Link key={t.slug} href={productTypeHref(t.slug)} className="ps-type">{body}</Link>:<div key={t.slug} className="ps-type soon">{body}</div>;
      })}</div>}
  </section>;
}

// ---- Curated Collections (id="collections") ----
// The banner images already contain the title, subtitle and "Shop Collection" button, so nothing is drawn on top.
export function Collections(){
  return <section className="ps-section" id="collections" aria-labelledby="ps-collections-title">
    <SectionHead id="ps-collections-title" title="Curated Collections" subtitle="Themed drops and handpicked favorites." href="/designs" linkText="Browse All Collections"/>
    <div className="ps-collections">{COLLECTIONS.map(c=><Link key={c.slug} href={collectionHref(c)} className="ps-collection" aria-label={'Shop the '+c.name}><img src={collectionImage(c)} alt={c.alt} loading="lazy"/></Link>)}</div>
  </section>;
}

// ---- Why Shop PrintSteez ----
export function WhyShop(){
  const items=[
    {icon:<Truck/>,title:'Free Shipping',text:'On orders '+FREE_SHIPPING_LABEL+'+'},
    {icon:<ShieldCheck/>,title:'Premium Quality',text:'Soft, durable, and made to last'},
    {icon:<Palette/>,title:'Designed In-House',text:'Original designs by the PrintSteez team'},
    {icon:<RotateCcw/>,title:'Easy Returns',text:'Hassle-free returns'},
  ];
  return <section className="ps-why" aria-labelledby="ps-why-title">
    <div className="ps-why-title">
      <h2 id="ps-why-title">Why Shop<br/>PrintSteez?</h2>
      <svg className="ps-brush" viewBox="0 0 120 16" preserveAspectRatio="none" aria-hidden="true"><path d="M3 7.5C30 3.5 70 2.5 116 4.5" stroke="#F97316" strokeWidth="4.5" strokeLinecap="round" fill="none"/><path d="M6 12.5c28-3 58-3.6 92-2.4" stroke="#F97316" strokeWidth="3" strokeLinecap="round" fill="none"/></svg>
    </div>
    <ul>{items.map(i=><li key={i.title}><span className="ps-why-icon" aria-hidden="true">{i.icon}</span><div><b>{i.title}</b><small>{i.text}</small></div></li>)}</ul>
  </section>;
}

// ---- Newsletter (no backend yet: the address is checked, then nothing is sent or saved) ----
const EMAIL=/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export function Newsletter(){
  const [done,setDone]=useState(false),[email,setEmail]=useState(''),[error,setError]=useState('');
  function subscribe(e:React.FormEvent){
    e.preventDefault();
    const value=email.trim();
    if(!EMAIL.test(value)||value.length>254){setError('Please enter a valid email address, like name@example.com.');return}
    setError('');setDone(true);
  }
  return <section className="ps-news" aria-labelledby="ps-news-title">
    <svg className="ps-news-brush" viewBox="0 0 240 120" preserveAspectRatio="none" aria-hidden="true">
      <path d="M70 135 L250 -5" stroke="#F97316" strokeWidth="30" strokeLinecap="round"/>
      <path d="M140 140 L262 40" stroke="#FB923C" strokeWidth="16" strokeLinecap="round"/>
      <path d="M40 128 L175 18" stroke="#F97316" strokeWidth="7" strokeLinecap="round" opacity=".75"/>
      <path d="M20 112 L110 40" stroke="#F97316" strokeWidth="3" strokeLinecap="round" opacity=".55"/>
    </svg>
    <div className="ps-news-inner">
      <Send size={50} strokeWidth={1.5} className="ps-news-icon" aria-hidden="true"/>
      <div className="ps-news-text"><h2 id="ps-news-title">Stay in the Loop</h2><p>Get new drops and exclusive deals<br/>straight to your inbox.</p></div>
      {done?<p className="ps-news-done" role="status">Thanks for subscribing! You&apos;ll hear from us about new drops soon.</p>:
        <form className="ps-news-form" onSubmit={subscribe} noValidate>
          <div className="ps-news-col">
            <label className="ps-news-field"><Mail size={18} aria-hidden="true"/><input type="email" required placeholder="Enter your email address" aria-label="Email address" autoComplete="email" maxLength={254}
              value={email} onChange={e=>{setEmail(e.target.value);setError('')}} aria-invalid={!!error} aria-describedby={error?'ps-news-error':undefined}/></label>
            {error&&<p id="ps-news-error" className="ps-news-error" role="alert">{error}</p>}
          </div>
          <button type="submit" className="ps-btn ps-btn-orange">Subscribe</button>
        </form>}
    </div>
  </section>;
}
