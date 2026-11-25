'use client';
import {useState} from 'react';
import Link from 'next/link';
import {ArrowLeft,ArrowRight,Lock,Minus,Palette,Plus,RotateCcw,Shirt,ShoppingCart,Trash2,Truck} from 'lucide-react';
import {getCartQuote,getCartToken,getDesigns,imageUrl,toDesign,type ApiCart} from '@/lib/api';
import {FREE_SHIPPING_THRESHOLD,FREE_SHIPPING_LABEL,RETURN_DAYS} from '@/lib/config';
import {ProductCard} from '@/components/home/ProductCard';
import {useApi} from '@/components/home/useApi';
import {Breadcrumb,ColorTee,LoadState,PromoBox,errText,money} from './ShopBits';

// Progress toward free standard shipping (by cart subtotal, the same base the checkout uses before discounts)
export function FreeShippingBar({subtotal}:{subtotal:number}){
  const left=Math.max(0,FREE_SHIPPING_THRESHOLD-subtotal),pct=Math.min(100,subtotal/FREE_SHIPPING_THRESHOLD*100);
  return <div className={'sh-freebar'+(left===0?' done':'')}>
    <Truck aria-hidden="true"/>
    <div className="sh-freebar-body">
      <div className="sh-freebar-top">
        <b>{left>0?<>You&apos;re {money(left)} away from free shipping!</>:<>You&apos;ve unlocked free standard shipping!</>}</b>
        <span>{money(Math.min(subtotal,FREE_SHIPPING_THRESHOLD))} / {money(FREE_SHIPPING_THRESHOLD)}</span>
      </div>
      <div className="sh-freebar-track" role="progressbar" aria-label="Progress to free shipping" aria-valuemin={0} aria-valuemax={FREE_SHIPPING_THRESHOLD} aria-valuenow={Math.min(subtotal,FREE_SHIPPING_THRESHOLD)}>
        <span style={{width:pct+'%'}}/></div>
    </div>
  </div>;
}

export function CartPage({cart,error,retry,update,remove,onWish,wishlist}:{cart:ApiCart|null;error:string;retry:()=>void;update:(id:number,qty:number)=>Promise<void>;remove:(id:number)=>Promise<void>;onWish:(id:string)=>void;wishlist:string[]}){
  const [problem,setProblem]=useState(''),[pending,setPending]=useState<number|null>(null);
  // Order summary from the server (same rules as checkout); reloads whenever the items or quantities change
  const token=getCartToken();
  const signature=cart?cart.items.map(x=>x.cart_item_id+':'+x.quantity).join(','):'';
  const quote=useApi(async()=>cart&&token&&cart.items.length?await getCartQuote(token):null,'cart-quote|'+signature,true);
  const run=(id:number,job:Promise<void>)=>{setProblem('');setPending(id);job.catch(e=>setProblem(errText(e))).finally(()=>setPending(null))};

  if(!cart)return <main className="sh-page"><div className="sh-wrap"><LoadState error={error} retry={retry} label="Loading your cart…"/></div></main>;
  const subtotal=Number(cart.subtotal),count=cart.item_count;
  const q=quote.data;

  return <main className="sh-page">
    <div className="sh-wrap">
      <Breadcrumb items={[{label:'Your Cart'}]}/>
      {cart.items.length===0?<div className="sh-empty">
        <ShoppingCart size={48} strokeWidth={1.5} aria-hidden="true"/>
        <h1>Your cart is empty</h1><p>Find a design you love and add it to your cart.</p>
        <Link className="ps-btn ps-btn-purple" href="/designs">Browse all designs <ArrowRight size={16}/></Link>
      </div>:<div className="sh-two">
        <div className="sh-col-main">
          <header className="sh-head"><h1>Your Cart ({count})</h1><p>Review your items, update quantities, and get ready to rock your new tees.</p></header>
          <FreeShippingBar subtotal={subtotal}/>
          {problem&&<p className="error" role="alert">{problem}</p>}
          <ul className="sh-lines">{cart.items.map(x=>{
            const busy=pending===x.cart_item_id,href='/designs/'+encodeURIComponent(x.public_design_code);
            return <li key={x.cart_item_id} className={'sh-line'+(busy?' busy':'')}>
              <Link className="sh-line-pic" href={href} tabIndex={-1} aria-hidden="true"><ColorTee hex={x.color_hex} colorName={x.color_name} image={imageUrl(x.preview_url)}/></Link>
              <div className="sh-line-info">
                <Link className="sh-line-title" href={href}>{x.title}</Link>
                <span className="sh-line-sub">{x.product_name}</span>
                <span className="sh-line-price">{money(x.unit_price)}</span>
                <div className="sh-chips">
                  <span className="sh-chip"><span className="sh-chip-dot" style={{background:x.color_hex||'#D1D5DB'}} aria-hidden="true"/>Color: {x.color_name}</span>
                  <span className="sh-chip">Size: {x.size_code}</span>
                </div>
                <button type="button" className="sh-remove" disabled={busy} onClick={()=>run(x.cart_item_id,remove(x.cart_item_id))} aria-label={'Remove '+x.title+' from your cart'}><Trash2 size={16} aria-hidden="true"/> Remove</button>
              </div>
              <div className="sh-line-qty"><span className="sh-qty-label">Qty</span>
                <div className="sh-qty small">
                  <button type="button" aria-label={'Decrease quantity of '+x.title} disabled={busy||x.quantity<=1} onClick={()=>run(x.cart_item_id,update(x.cart_item_id,x.quantity-1))}><Minus size={15}/></button>
                  <span aria-live="polite">{x.quantity}</span>
                  <button type="button" aria-label={'Increase quantity of '+x.title} disabled={busy||x.quantity>=100} onClick={()=>run(x.cart_item_id,update(x.cart_item_id,x.quantity+1))}><Plus size={15}/></button>
                </div>
              </div>
              <b className="sh-line-total">{money(x.line_total)}</b>
            </li>;
          })}</ul>
          <Link className="sh-outline-btn" href="/designs"><ArrowLeft size={16} aria-hidden="true"/> Continue Shopping</Link>
        </div>

        <aside className="sh-col-side">
          <section className="sh-card sh-summary" aria-labelledby="sh-sum-title">
            <h2 id="sh-sum-title">Order Summary</h2>
            {quote.error&&!q?<><p className="error" role="alert">{quote.error}</p><button type="button" className="sh-link" onClick={quote.retry}>Try again</button></>:<>
              <div className="sh-row"><span>Subtotal ({count} {count===1?'item':'items'})</span><b>{money(q?q.subtotal:subtotal)}</b></div>
              {q&&Number(q.discount_total)>0&&<div className="sh-row disc"><span>{q.discount_name||'Discount'}</span><b>−{money(q.discount_total)}</b></div>}
              <div className="sh-row"><span>Shipping (Standard)</span><b>{q?Number(q.shipping_amount)===0?'FREE':money(q.shipping_amount):'…'}</b></div>
              <div className="sh-row"><span>Estimated Tax</span><b>{q?money(q.tax_total):'…'}</b></div>
              <div className="sh-row total"><span>Total</span><b>{q?money(q.total):'…'}</b></div>
              <p className="sh-tiny">Faster shipping can be chosen at checkout.</p>
            </>}
            <Link className="ps-btn ps-btn-purple sh-checkout-btn" href="/checkout/shipping"><Lock size={17} aria-hidden="true"/> Proceed to Checkout <ArrowRight size={16} aria-hidden="true"/></Link>
            <div className="sh-divider"/>
            <PromoBox/>
            <div className="sh-free-note"><Truck aria-hidden="true"/><div><b>Free Shipping at {FREE_SHIPPING_LABEL}</b><small>{subtotal>=FREE_SHIPPING_THRESHOLD?'Your order ships free with Standard Shipping.':'Add '+money(FREE_SHIPPING_THRESHOLD-subtotal)+' more to get free standard shipping.'}</small></div></div>
          </section>
          <section className="sh-card sh-confidence" aria-labelledby="sh-conf-title">
            <h2 id="sh-conf-title">Shop with Confidence</h2>
            <ul>
              <li><Palette aria-hidden="true"/><div><b>Designed In-House</b><small>Original designs by the PrintSteez team.</small></div></li>
              <li><Shirt aria-hidden="true"/><div><b>Printed to Order</b><small>Each tee is printed just for you.</small></div></li>
              <li><RotateCcw aria-hidden="true"/><div><b>Easy Returns</b><small>{RETURN_DAYS}-day returns for misprints and defects.</small></div></li>
            </ul>
          </section>
        </aside>
      </div>}
      <AlsoLike onWish={onWish} wishlist={wishlist} exclude={cart.items.map(x=>x.public_design_code)}/>
    </div>
  </main>;
}

function AlsoLike({onWish,wishlist,exclude}:{onWish:(id:string)=>void;wishlist:string[];exclude:string[]}){
  const a=useApi(async()=>(await getDesigns({sort:'popular',limit:10})).map(toDesign),'cart-also');
  const list=(a.data||[]).filter(x=>!exclude.includes(x.id)).slice(0,5);
  if(list.length===0)return null;
  return <section className="sh-related" aria-labelledby="sh-also-title">
    <div className="ps-head"><div><h2 id="sh-also-title">You Might Also Like</h2><p>Popular graphic tees from the PrintSteez team.</p></div>
      <Link className="ps-viewall" href="/designs?sort=popular">View more tees <ArrowRight size={15} strokeWidth={2.4}/></Link></div>
    <div className="sh-related-grid">{list.map((x,i)=><ProductCard key={x.id} design={x} index={i} wished={wishlist.includes(x.id)} onWish={onWish}/>)}</div>
  </section>;
}
