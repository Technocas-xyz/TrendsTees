'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import Link from 'next/link';
import {ArrowRight,Check,Heart,Minus,Plus,Ruler,ShoppingCart,Truck} from 'lucide-react';
import {getDesign,getDesigns,getVariants,toDesign,type ApiDesign,type ApiVariant} from '@/lib/api';
import {FREE_SHIPPING_LABEL,PRODUCTION_TIME,RETURN_DAYS,SHIPS_TO,SIZES,SIZE_CHART,isHiddenSize} from '@/lib/config';
import {ProductCard,ProductCardSkeleton} from '@/components/home/ProductCard';
import {Newsletter} from '@/components/home/HomeSections';
import {useApi} from '@/components/home/useApi';
import {saveRecent} from '@/components/listing/recent';
import {Breadcrumb,ColorTee,LoadState,errText,money} from './ShopBits';

type AddToCart=(code:string,variantId:number,quantity:number)=>Promise<void>;
const STAR='M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z';

// /designs/<code> (and the older /choose-product and /customize URLs, with ?product=<id> preselected)
export function DetailPage({code,initialProductId,onWish,wishlist,add}:{code:string;initialProductId?:string;onWish:(id:string)=>void;wishlist:string[];add:AddToCart}){
  const a=useApi(()=>getDesign(code),'design|'+code);
  // Recently Viewed (localStorage "ps-recent")
  useEffect(()=>{if(a.data)saveRecent(toDesign(a.data))},[a.data]);
  if(!a.data)return <main className="sh-page"><div className="sh-wrap"><LoadState error={a.error} retry={a.retry} label="Loading design…"/></div></main>;
  return <DesignView key={code} api={a.data} initialProductId={initialProductId} onWish={onWish} wishlist={wishlist} add={add}/>;
}

function DesignView({api,initialProductId,onWish,wishlist,add}:{api:ApiDesign;initialProductId?:string;onWish:(id:string)=>void;wishlist:string[];add:AddToCart}){
  const d=useMemo(()=>toDesign(api),[api]);
  const products=api.products||[];
  const [productId,setProductId]=useState(()=>String((products.find(p=>String(p.product_id)===initialProductId)||products[0])?.product_id||''));
  const product=products.find(p=>String(p.product_id)===productId)||null;
  const wished=wishlist.includes(d.id);
  const [tab,setTab]=useState<'description'|'size'|'shipping'>('description');
  const tabsRef=useRef<HTMLDivElement>(null);
  const openSizeGuide=()=>{setTab('size');tabsRef.current?.scrollIntoView({behavior:'smooth',block:'start'})};

  return <main className="sh-page">
    <div className="sh-wrap">
      <Breadcrumb items={[{label:'Designs',href:'/designs'},...(api.category_slug?[{label:api.category_name||'Interest',href:'/designs?category='+encodeURIComponent(api.category_slug)}]:[]),{label:d.name}]}/>
      {product?<Buy key={product.product_id} d={d} productId={product.product_id} productName={product.product_name} products={products} setProductId={setProductId} wished={wished} onWish={onWish} add={add} openSizeGuide={openSizeGuide}/>:
        <div className="sh-detail">
          <div className="sh-gallery"><div className="sh-main-pic"><ColorTee image={d.image} alt={d.name}/></div></div>
          <div className="sh-buy"><h1 className="sh-title">{d.name}</h1><p className="sh-muted">This design is not available on any product yet.</p>
            <Link className="ps-btn ps-btn-purple" href="/designs">Browse all designs <ArrowRight size={16}/></Link></div>
        </div>}

      <section className="sh-tabs" ref={tabsRef} aria-label="Product information">
        <div role="tablist" aria-label="Product information" className="sh-tablist" onKeyDown={e=>{
          const order=['description','size','shipping'] as const;const i=order.indexOf(tab);
          if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();const n=order[(i+(e.key==='ArrowRight'?1:2))%3];setTab(n);document.getElementById('sh-tab-'+n)?.focus()}
        }}>
          {([['description','Description'],['size','Size guide'],['shipping','Shipping & returns']] as const).map(([k,label])=>
            <button key={k} id={'sh-tab-'+k} type="button" role="tab" aria-selected={tab===k} aria-controls={'sh-panel-'+k} tabIndex={tab===k?0:-1} className={'sh-tab'+(tab===k?' on':'')} onClick={()=>setTab(k)}>{label}</button>)}
        </div>
        <div className="sh-tabpanel" role="tabpanel" id={'sh-panel-'+tab} aria-labelledby={'sh-tab-'+tab}>
          {tab==='description'&&<div className="sh-prose">
            <h2>About this design</h2>
            <p>{d.description||`${d.name} is an original graphic designed in-house by the PrintSteez team.`}</p>
            <ul className="sh-ticks">
              <li><Check aria-hidden="true"/>Original artwork by the PrintSteez in-house design team</li>
              <li><Check aria-hidden="true"/>Printed to order{product?' on the '+product.product_name:''}, just for you</li>
              <li><Check aria-hidden="true"/>Available in {products.map(p=>p.product_name).join(' and ')||'several products'}</li>
            </ul>
          </div>}
          {tab==='size'&&<div className="sh-prose">
            <h2>Size guide</h2>
            <p>Unisex regular fit. If you&apos;re between sizes, or like a roomier look, choose the larger size.</p>
            {SIZE_CHART.length>0?<table className="sh-table"><thead><tr><th scope="col">Size</th><th scope="col">Chest width (in)</th><th scope="col">Length (in)</th></tr></thead>
              <tbody>{SIZE_CHART.filter(r=>!isHiddenSize(r.size)).map(r=><tr key={r.size}><td>{r.size}</td><td>{r.chest}</td><td>{r.length}</td></tr>)}</tbody></table>:
              <p><b>Sizes:</b> {SIZES.join(', ')}. Exact measurements are coming soon. Need them now? <Link href="/contact">Contact us</Link>.</p>}
            <h3>How to measure</h3>
            <p>Lay a tee that fits you well flat. <b>Chest:</b> measure straight across, 1 inch below the armpits. <b>Length:</b> measure from the highest point of the shoulder to the bottom hem.</p>
          </div>}
          {tab==='shipping'&&<div className="sh-prose">
            <h2>Shipping &amp; returns</h2>
            <p><b>Free shipping on orders over {FREE_SHIPPING_LABEL}</b> with Standard Shipping. We ship to {SHIPS_TO}.</p>
            <p>Every item is printed to order, usually in {PRODUCTION_TIME}, then shipped. The estimated delivery date is shown at checkout. <Link href="/shipping">Shipping details</Link></p>
            <p>Misprinted or defective? Tell us within {RETURN_DAYS} days and we&apos;ll replace or refund it. Because items are made just for you, we can&apos;t take back items for size or change of mind. <Link href="/returns">Returns &amp; exchanges</Link></p>
          </div>}
        </div>
      </section>

      <Related categorySlug={api.category_slug||''} categoryName={api.category_name||''} exclude={d.id} onWish={onWish} wishlist={wishlist}/>
    </div>
    <Newsletter/>
  </main>;
}

// Right column: product type, color, size, quantity, add to cart. Variants (with stock) come from GET /products/{id}/variants.
function Buy({d,productId,productName,products,setProductId,wished,onWish,add,openSizeGuide}:{d:ReturnType<typeof toDesign>;productId:number;productName:string;products:{product_id:number;product_name:string;starting_price:string|number|null}[];setProductId:(id:string)=>void;wished:boolean;onWish:(id:string)=>void;add:AddToCart;openSizeGuide:()=>void}){
  const v=useApi(()=>getVariants(productId),'variants|'+productId);
  const variants=useMemo(()=>(v.data?.variants||[]).filter(x=>!isHiddenSize(x.size_code)),[v.data]);
  // one entry per color, in API order
  const colors=useMemo(()=>variants.filter((x,i)=>variants.findIndex(y=>y.color_name===x.color_name)===i),[variants]);
  const [color,setColor]=useState(''),[size,setSize]=useState(''),[qty,setQty]=useState(1);
  const [view,setView]=useState<'tee'|'art'>('tee');
  const [busy,setBusy]=useState(false),[added,setAdded]=useState(false),[error,setError]=useState(''),[needSize,setNeedSize]=useState(false);
  // first color that has something in stock
  useEffect(()=>{if(!color&&colors.length){const c=colors.find(c=>variants.some(x=>x.color_name===c.color_name&&x.in_stock!==false))||colors[0];setColor(c.color_name)}},[colors]);
  const forColor=variants.filter(x=>x.color_name===color);
  const bySize=(s:string)=>forColor.find(x=>x.size_code.toUpperCase()===s);
  const variant=size?bySize(size):undefined;
  const sizes=[...SIZES,...forColor.map(x=>x.size_code.toUpperCase()).filter(s=>!SIZES.includes(s))];
  const colorInfo=colors.find(c=>c.color_name===color);
  const prices=(forColor.length?forColor:variants).map(x=>Number(x.customer_price));
  const price=variant?Number(variant.customer_price):prices.length?Math.min(...prices):d.price;
  const reset=()=>{setAdded(false);setError('')};
  const pickColor=(c:string)=>{setColor(c);setView('tee');setSize(s=>{const x=variants.find(y=>y.color_name===c&&y.size_code.toUpperCase()===s);return x&&x.in_stock!==false?s:''});reset()};
  const pickQty=(n:number)=>{setQty(Math.min(100,Math.max(1,Math.round(n)||1)));reset()};
  async function addToCart(){
    if(!variant||variant.in_stock===false){setNeedSize(true);return}
    setBusy(true);reset();
    try{await add(d.id,variant.product_variant_id,qty);setAdded(true)}catch(e){setError(errText(e))}finally{setBusy(false)}
  }
  const shown=colors.slice(0,6);

  return <div className="sh-detail">
    {/* gallery: thumbnails (one per color + the artwork) and the large mockup */}
    <div className="sh-gallery">
      <div className="sh-thumbs" role="list" aria-label="Views">
        {shown.map(c=><button key={c.color_name} type="button" role="listitem" className={'sh-thumb'+(view==='tee'&&c.color_name===color?' on':'')} onClick={()=>pickColor(c.color_name)} aria-label={c.color_name+' tee'}>
          <ColorTee hex={c.color_hex} colorName={c.color_name} image={d.image}/></button>)}
        {d.image&&<button type="button" role="listitem" className={'sh-thumb art'+(view==='art'?' on':'')} onClick={()=>setView('art')} aria-label="Artwork only"><img src={d.image} alt=""/></button>}
      </div>
      <div className="sh-main-pic">
        {view==='art'&&d.image?<img className="sh-art" src={d.image} alt={d.name+' artwork'}/>:<ColorTee hex={colorInfo?.color_hex} colorName={color||null} image={d.image} alt={d.name+(color?' on a '+color.toLowerCase()+' '+productName.toLowerCase():'')}/>}
        <button type="button" className="ps-heart sh-heart" aria-pressed={wished} aria-label={(wished?'Remove from wishlist: ':'Add to wishlist: ')+d.name} onClick={()=>onWish(d.id)}>
          <Heart size={18} strokeWidth={2.2} fill={wished?'#e11d48':'none'} color={wished?'#e11d48':'#111827'}/></button>
      </div>
    </div>

    <div className="sh-buy">
      <h1 className="sh-title">{d.name}</h1>
      {/* no reviews yet: empty stars, no numbers */}
      <div className="sh-stars" aria-label="No reviews yet">{[1,2,3,4,5].map(i=><svg key={i} width="17" height="17" viewBox="0 0 24 24" aria-hidden="true"><path d={STAR} fill="#E5E7EB"/></svg>)}<span>No reviews yet</span></div>
      <p className="sh-price">{!variant&&prices.length>1&&new Set(prices).size>1?'From ':''}{money(price)}</p>

      {products.length>0&&<div className="sh-opt">
        <span className="sh-opt-label">Product Type</span>
        <div className="sh-types">{products.map(p=><button key={p.product_id} type="button" className={'sh-type'+(p.product_id===productId?' on':'')} aria-pressed={p.product_id===productId} onClick={()=>{if(p.product_id!==productId)setProductId(String(p.product_id))}}>{p.product_name}</button>)}</div>
      </div>}

      {v.error?<LoadState error={v.error} retry={v.retry}/>:!v.data?<p className="sh-muted" aria-busy="true">Loading options…</p>:variants.length===0?<p className="sh-note">This product has no sizes available right now.</p>:<>
        <div className="sh-opt">
          <span className="sh-opt-label">Color: <b>{color||'Choose a color'}</b></span>
          <div className="sh-colors" role="radiogroup" aria-label="Color">{colors.map(c=>{
            const any=variants.some(x=>x.color_name===c.color_name&&x.in_stock!==false);
            return <button key={c.color_name} type="button" role="radio" aria-checked={c.color_name===color} aria-label={c.color_name+(any?'':' (sold out)')} title={c.color_name+(any?'':' (sold out)')} disabled={!any}
              className={'sh-color'+(c.color_name===color?' on':'')} style={{background:c.color_hex||'#D1D5DB'}} onClick={()=>pickColor(c.color_name)}/>;
          })}</div>
        </div>

        <div className="sh-opt">
          <div className="sh-opt-row"><span className="sh-opt-label">Size: <b>{size||'Choose a size'}</b></span>
            <button type="button" className="sh-link" onClick={openSizeGuide}><Ruler size={15} aria-hidden="true"/> Size Guide</button></div>
          <div className="sh-sizes" role="radiogroup" aria-label="Size">{sizes.map(s=>{
            const x=bySize(s),out=!x||x.in_stock===false;
            return <button key={s} type="button" role="radio" aria-checked={s===size} disabled={out} title={!x?s+' is not made in '+color:out?s+' is sold out':s}
              className={'sh-size'+(s===size?' on':'')+(out?' out':'')} onClick={()=>{setSize(s);setNeedSize(false);reset()}}>{s}</button>;
          })}</div>
          {needSize&&<p className="sh-warn" role="alert">Please choose a size.</p>}
        </div>

        <div className="sh-opt sh-qty-row">
          <span className="sh-opt-label">Quantity</span>
          <div className="sh-qty">
            <button type="button" aria-label="Decrease quantity" disabled={qty<=1} onClick={()=>pickQty(qty-1)}><Minus size={16}/></button>
            <input type="number" min={1} max={100} value={qty} aria-label="Quantity" onChange={e=>pickQty(Number(e.target.value))}/>
            <button type="button" aria-label="Increase quantity" disabled={qty>=100} onClick={()=>pickQty(qty+1)}><Plus size={16}/></button>
          </div>
        </div>
      </>}

      <div className="sh-actions">
        <button type="button" className="ps-btn ps-btn-purple sh-add" disabled={busy||!v.data||variants.length===0} onClick={addToCart}>
          <ShoppingCart size={19} aria-hidden="true"/>{busy?'Adding…':'Add to Cart'}</button>
        <button type="button" className="sh-wish" aria-pressed={wished} onClick={()=>onWish(d.id)}>
          <Heart size={18} fill={wished?'#e11d48':'none'} color={wished?'#e11d48':'currentColor'} aria-hidden="true"/>{wished?'In Your Wishlist':'Add to Wishlist'}</button>
      </div>
      {error&&<p className="error" role="alert">{error}</p>}
      {added&&<p className="sh-added" role="status"><Check size={17} aria-hidden="true"/> Added to cart. <Link href="/cart">View cart <ArrowRight size={14}/></Link></p>}

      <div className="sh-ship-box">
        <Truck aria-hidden="true"/>
        <div><b>Free shipping on orders over {FREE_SHIPPING_LABEL}</b><small>Printed to order in {PRODUCTION_TIME} · Ships to {SHIPS_TO}</small></div>
      </div>
    </div>
  </div>;
}

// "You may also like": other designs from the same interest
function Related({categorySlug,categoryName,exclude,onWish,wishlist}:{categorySlug:string;categoryName:string;exclude:string;onWish:(id:string)=>void;wishlist:string[]}){
  const a=useApi(async()=>(await getDesigns({categorySlug:categorySlug||undefined,sort:'popular',limit:6})).map(toDesign).filter(x=>x.id!==exclude).slice(0,5),'related|'+categorySlug+'|'+exclude);
  if(a.error||(a.data&&a.data.length===0))return null;
  return <section className="sh-related" aria-labelledby="sh-related-title">
    <div className="ps-head"><div><h2 id="sh-related-title">You May Also Like</h2>{categoryName&&<p>More {categoryName} designs from the PrintSteez team.</p>}</div>
      <Link className="ps-viewall" href={categorySlug?'/designs?category='+encodeURIComponent(categorySlug):'/designs'}>View all <ArrowRight size={15} strokeWidth={2.4}/></Link></div>
    <div className="sh-related-grid">{a.data?a.data.map((x,i)=><ProductCard key={x.id} design={x} index={i} wished={wishlist.includes(x.id)} onWish={onWish}/>):Array.from({length:5},(_,i)=><ProductCardSkeleton key={i}/>)}</div>
  </section>;
}
