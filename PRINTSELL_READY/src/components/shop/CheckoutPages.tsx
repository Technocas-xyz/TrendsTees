'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {ArrowLeft,ArrowRight,Check,CreditCard,Lock,Mail,MapPin,Package,PenLine,Phone,ShieldCheck,Truck,UserRound} from 'lucide-react';
import {ApiError,createCheckout,getCartQuote,getCartToken,getCities,getCountries,getMe,getShippingMethods,getStates,imageUrl,placeOrder,type ApiCart,type ApiQuote} from '@/lib/api';
import type {Shipping} from '@/components/data';
import {FREE_SHIPPING_LABEL,RETURN_DAYS} from '@/lib/config';
import {useApi} from '@/components/home/useApi';
import {CheckoutSteps,ColorTee,PromoBox,errText,money} from './ShopBits';

// Checkout state (server quote + address form) lives in sessionStorage so the Review & Pay step and a refresh can read it.
// Key names are unchanged from the previous checkout pages.
const CHECKOUT_KEY='printsell-checkout',LAST_ORDER_KEY='printsell-last-order';
type CheckoutState={quote:ApiQuote;form:Shipping};
function readSession<T>(key:string):T|null{try{const x=sessionStorage.getItem(key);return x?JSON.parse(x) as T:null}catch{return null}}
function writeSession(key:string,value:unknown){try{sessionStorage.setItem(key,JSON.stringify(value))}catch{}}
function clearSession(key:string){try{sessionStorage.removeItem(key)}catch{}}
const blankShipping:Shipping={fullName:'',email:'',phone:'',country:'',stateId:'',state:'',city:'',address:'',apartment:'',zip:'',shippingMethod:'standard'};
// "2026-11-20" -> "Nov 20" (date-only strings are read as local time so the day does not shift)
const shortDate=(s:string)=>new Date(/^\d{4}-\d{2}-\d{2}$/.test(s)?s+'T00:00:00':s).toLocaleDateString(undefined,{month:'short',day:'numeric'});
// "Alex Rivera" -> ["Alex","Rivera"]; the backend stores one full name
const splitName=(full:string):[string,string]=>{const t=full.trim(),i=t.indexOf(' ');return i<0?[t,'']:[t.slice(0,i),t.slice(i+1).trim()]};

function CheckoutHero(){
  return <section className="sh-co-hero">
    <div className="sh-wrap sh-co-hero-in">
      <div><h1>Checkout</h1><p>Secure checkout for your PrintSteez order</p></div>
      <div className="sh-co-hero-art" aria-hidden="true">
        <svg viewBox="0 0 400 160" preserveAspectRatio="none"><path d="M120 190 L330 -30" stroke="#6D28D9" strokeWidth="60" strokeLinecap="round"/><path d="M210 200 L400 0" stroke="#F97316" strokeWidth="34" strokeLinecap="round"/><path d="M300 210 L420 80" stroke="#FB923C" strokeWidth="14" strokeLinecap="round"/></svg>
        <img src="/mockups/tee-black.png" alt=""/>
      </div>
    </div>
  </section>;
}

function Section({n,title,sub,children}:{n:number;title:string;sub?:string;children:React.ReactNode}){
  return <section className="sh-card sh-co-sec" aria-labelledby={'sh-co-'+n}>
    <header className="sh-co-sec-head"><span className="sh-co-num" aria-hidden="true">{n}</span><div><h2 id={'sh-co-'+n}>{title}</h2>{sub&&<p>{sub}</p>}</div></header>
    {children}
  </section>;
}

// Order summary items: thumbnails from the cart (it has each variant's color)
function SummaryItems({items}:{items:{key:string;title:string;product:string;color:string|null;hex?:string|null;size:string|null;qty:number;total:string|number;image:string|null}[]}){
  return <ul className="sh-sum-items">{items.map(x=><li key={x.key}>
    <span className="sh-sum-pic"><ColorTee hex={x.hex} colorName={x.color} image={x.image}/><span className="sh-sum-qty" aria-label={'Quantity '+x.qty}>{x.qty}</span></span>
    <div><b>{x.title}</b><small>{x.product}</small><small>{[x.size&&'Size: '+x.size,x.color&&'Color: '+x.color].filter(Boolean).join('  ')}</small></div>
    <b className="sh-sum-total">{money(x.total)}</b>
  </li>)}</ul>;
}

// ---------- Step 2: contact, address, shipping method (POST /checkout makes the server quote) ----------
export function CheckoutShippingPage({cart}:{cart:ApiCart|null}){
  const router=useRouter();
  const methods=useApi(getShippingMethods,'shipping-methods');
  const [form,setForm]=useState<Shipping>(blankShipping),[first,setFirst]=useState(''),[last,setLast]=useState('');
  const [error,setError]=useState(''),[errs,setErrs]=useState<{first?:string;last?:string;city?:string;zip?:string}>({}),[busy,setBusy]=useState(false);
  // Country -> state -> city lists come from the API; each list reloads when the choice above it changes
  const countries=useApi(getCountries,'countries'),states=useApi(async()=>form.country?await getStates(form.country):[],'states|'+form.country),cities=useApi(async()=>form.stateId?await getCities(form.stateId):[],'cities|'+form.stateId);
  useEffect(()=>{const s=readSession<CheckoutState>(CHECKOUT_KEY);if(s){setForm({...blankShipping,...s.form});const [f,l]=splitName(s.form.fullName||'');setFirst(f);setLast(l)}},[]);
  useEffect(()=>{getMe().then(u=>{if(!u)return;setForm(f=>({...f,email:f.email||u.email}));const [fn,ln]=splitName(u.full_name);setFirst(v=>v||fn);setLast(v=>v||ln)}).catch(()=>{})},[]);
  useEffect(()=>{const list=countries.data;if(list&&list.length===1)setForm(f=>f.country?f:{...f,country:list[0].code})},[countries.data]);
  useEffect(()=>{const list=methods.data;if(list&&list.length&&!list.some(x=>x.code===form.shippingMethod))setForm(f=>({...f,shippingMethod:list[0].code}))},[methods.data]);
  // live totals for the chosen shipping method (same rules as the final quote; no address needed)
  const token=getCartToken();
  const sig=cart?cart.items.map(x=>x.cart_item_id+':'+x.quantity).join(','):'';
  const quote=useApi(async()=>token&&cart&&cart.items.length?await getCartQuote(token,form.shippingMethod):null,'co-quote|'+sig+'|'+form.shippingMethod,true);

  const update=(k:keyof Shipping,v:string)=>{setForm(x=>({...x,[k]:v}));setError('');if(k==='zip'||k==='city')setErrs(e=>({...e,[k]:undefined}))};
  const pickCountry=(code:string)=>{setForm(x=>({...x,country:code,stateId:'',state:'',city:''}));setError('');setErrs({})};
  const pickState=(id:string)=>{const s=states.data?.find(x=>String(x.state_id)===id);setForm(x=>({...x,stateId:id,state:s?s.state_name:'',city:''}));setError('');setErrs({})};
  const country=countries.data?.find(x=>x.code===form.country);const locError=countries.error||states.error||cities.error;

  async function submit(e:React.FormEvent){
    e.preventDefault();
    const token=getCartToken();
    if(!cart||cart.items.length===0||!token){setError('Your cart is empty. Add a product first.');return}
    const fe:typeof errs={};
    if(!first.trim())fe.first='Please enter your first name.';
    if(!last.trim())fe.last='Please enter your last name.';
    if(Object.keys(fe).length){setErrs(fe);return}
    if(!form.country){setError('Please choose a country.');return}
    if(!form.stateId){setError('Please choose a state.');return}
    const city=cities.data?.find(x=>x.city_name.toLowerCase()===form.city.trim().toLowerCase());
    if(!city){setErrs({city:'Please choose a city from the list.'});return}
    if(form.country==='US'&&!/^\d{5}(-\d{4})?$/.test(form.zip.trim())){setErrs({zip:'Please enter a valid US ZIP code (12345 or 12345-6789).'});return}
    if(!form.shippingMethod){setError('Please choose a shipping method.');return}
    const fullName=(first.trim()+' '+last.trim()).trim();
    setBusy(true);setError('');setErrs({});
    try{
      const phone=form.phone.trim();
      const address={full_name:fullName,phone:phone.startsWith('+')||!country?phone:'+'+country.phone_code+' '+phone,line_1:form.address.trim(),...(form.apartment.trim()?{line_2:form.apartment.trim()}:{}),city:city.city_name,state_region:form.state,postal_code:form.zip.trim(),country_code:form.country};
      const quote=await createCheckout({cart_token:token,contact_email:form.email.trim(),shipping_method_code:form.shippingMethod,shipping_address:address});
      writeSession(CHECKOUT_KEY,{quote,form:{...form,fullName,city:city.city_name}});
      router.push('/checkout/payment');
    }catch(err){setError(errText(err))}finally{setBusy(false)}
  }
  const fieldError=(id:string,m?:string)=>m?<small className="sh-field-err" id={id} role="alert">{m}</small>:null;
  const q=quote.data;
  const items=(cart?.items||[]).map(x=>({key:String(x.cart_item_id),title:x.title,product:x.product_name,color:x.color_name,hex:x.color_hex,size:x.size_code,qty:x.quantity,total:x.line_total,image:imageUrl(x.preview_url)}));
  const count=cart?.item_count||0;

  return <main className="sh-page sh-co">
    <CheckoutHero/>
    <div className="sh-wrap">
      <CheckoutSteps active={1}/>
      {cart&&cart.items.length===0?<div className="sh-empty"><Package size={46} strokeWidth={1.5} aria-hidden="true"/><h2>Your cart is empty</h2><p>Add a design to your cart before checking out.</p><Link className="ps-btn ps-btn-purple" href="/designs">Browse all designs <ArrowRight size={16}/></Link></div>:
      <div className="sh-two">
        <form id="sh-checkout-form" className="sh-col-main sh-co-form" onSubmit={submit} noValidate>
          <Section n={1} title="Contact Information" sub="We'll use this to send your order updates and receipt.">
            <div className="sh-grid">
              <label className="sh-field">Email Address <i aria-hidden="true">*</i><span className="sh-input"><Mail aria-hidden="true"/><input required type="email" autoComplete="email" value={form.email} onChange={e=>update('email',e.target.value)} placeholder="you@example.com"/></span></label>
              <label className="sh-field">Phone Number <i aria-hidden="true">*</i><span className="sh-input">{country?<span className="sh-prefix">+{country.phone_code}</span>:<Phone aria-hidden="true"/>}<input required type="tel" autoComplete="tel-national" value={form.phone} onChange={e=>update('phone',e.target.value)} placeholder="Phone number"/></span></label>
            </div>
          </Section>

          <Section n={2} title="Shipping Address" sub="Where should we send your tees?">
            <div className="sh-grid">
              <label className="sh-field">First Name <i aria-hidden="true">*</i><span className="sh-input"><UserRound aria-hidden="true"/><input required autoComplete="given-name" value={first} onChange={e=>{setFirst(e.target.value);setErrs(x=>({...x,first:undefined}))}} aria-invalid={!!errs.first} aria-describedby={errs.first?'err-first':undefined}/></span>{fieldError('err-first',errs.first)}</label>
              <label className="sh-field">Last Name <i aria-hidden="true">*</i><span className="sh-input"><input required autoComplete="family-name" value={last} onChange={e=>{setLast(e.target.value);setErrs(x=>({...x,last:undefined}))}} aria-invalid={!!errs.last} aria-describedby={errs.last?'err-last':undefined}/></span>{fieldError('err-last',errs.last)}</label>
              <label className="sh-field wide">Address <i aria-hidden="true">*</i><span className="sh-input"><MapPin aria-hidden="true"/><input required autoComplete="address-line1" value={form.address} onChange={e=>update('address',e.target.value)} placeholder="Street address"/></span></label>
              <label className="sh-field wide">Apartment, Suite, etc. <em>(Optional)</em><span className="sh-input"><input autoComplete="address-line2" value={form.apartment} onChange={e=>update('apartment',e.target.value)}/></span></label>
              <div className="sh-grid3 wide">
                <label className="sh-field">City <i aria-hidden="true">*</i><span className="sh-input"><input required list="city-options" autoComplete="off" disabled={!form.stateId||!cities.data} value={form.city} onChange={e=>update('city',e.target.value)} placeholder={!form.stateId?'Choose a state first':cities.data?'Start typing your city':'Loading cities…'} aria-invalid={!!errs.city} aria-describedby={errs.city?'err-city':undefined}/></span><datalist id="city-options">{cities.data?.map(c=><option key={c.city_id} value={c.city_name}/>)}</datalist>{fieldError('err-city',errs.city)}</label>
                <label className="sh-field">State <i aria-hidden="true">*</i><span className="sh-input"><select required value={form.stateId} onChange={e=>pickState(e.target.value)} disabled={!form.country||!states.data}><option value="">{!form.country?'Choose a country first':states.data?'Select a state':'Loading…'}</option>{states.data?.map(s=><option key={s.state_id} value={String(s.state_id)}>{s.state_name}</option>)}</select></span></label>
                <label className="sh-field">ZIP Code <i aria-hidden="true">*</i><span className="sh-input"><input required autoComplete="postal-code" value={form.zip} onChange={e=>update('zip',e.target.value)} placeholder={form.country==='US'?'12345':'Postal code'} aria-invalid={!!errs.zip} aria-describedby={errs.zip?'err-zip':undefined}/></span>{fieldError('err-zip',errs.zip)}</label>
              </div>
              <label className="sh-field wide">Country <i aria-hidden="true">*</i><span className="sh-input"><select required value={form.country} onChange={e=>pickCountry(e.target.value)} disabled={!countries.data}><option value="">{countries.data?'Select a country':'Loading…'}</option>{countries.data?.map(c=><option key={c.code} value={c.code}>{c.name}</option>)}</select></span></label>
            </div>
            {locError&&<div className="sh-inline-err"><p className="error">{locError}</p><button type="button" className="sh-link" onClick={()=>{countries.retry();states.retry();cities.retry()}}>Retry</button></div>}
          </Section>

          <Section n={3} title="Shipping Method" sub="Choose a shipping option for your order.">
            {methods.data?<div className="sh-methods" role="radiogroup" aria-label="Shipping method">{methods.data.map(x=><label key={x.code} className={'sh-method'+(form.shippingMethod===x.code?' on':'')}>
              <input type="radio" name="shipping-method" checked={form.shippingMethod===x.code} onChange={()=>update('shippingMethod',x.code)}/>
              <Truck aria-hidden="true"/>
              <span className="sh-method-text"><b>{x.name}</b><small>Arrives in {x.min_days}–{x.max_days} business days after printing{x.free_over!==null&&' · Free over '+money(x.free_over)}</small></span>
              <b className="sh-method-price">{form.shippingMethod===x.code&&q?Number(q.shipping_amount)===0?'FREE':money(q.shipping_amount):money(x.price)}</b>
            </label>)}</div>:methods.error?<div className="sh-inline-err"><p className="error">{methods.error}</p><button type="button" className="sh-link" onClick={methods.retry}>Retry</button></div>:<p className="sh-muted">Loading…</p>}
          </Section>

          {error&&<div className="error" role="alert">{error}</div>}
          <div className="sh-co-actions">
            <Link className="sh-back" href="/cart"><ArrowLeft size={16} aria-hidden="true"/> Return to Cart</Link>
            <button className="ps-btn ps-btn-purple sh-co-next" type="submit" disabled={busy||!methods.data}>{busy?'Checking…':'Continue to Review & Pay'} <ArrowRight size={17} aria-hidden="true"/></button>
          </div>
        </form>

        <aside className="sh-col-side">
          <section className="sh-card sh-summary" aria-labelledby="sh-cosum-title">
            <h2 id="sh-cosum-title">Order Summary</h2>
            <p className="sh-muted">{count} {count===1?'item':'items'} designed by the PrintSteez team</p>
            {cart?<SummaryItems items={items}/>:<p className="sh-muted">Loading…</p>}
            <PromoBox/>
            <div className="sh-row"><span>Subtotal ({count} {count===1?'item':'items'})</span><b>{money(q?q.subtotal:cart?.subtotal||0)}</b></div>
            {q&&Number(q.discount_total)>0&&<div className="sh-row disc"><span>{q.discount_name||'Discount'}</span><b>−{money(q.discount_total)}</b></div>}
            <div className="sh-row"><span>Shipping ({methods.data?.find(m=>m.code===form.shippingMethod)?.name.replace(' Shipping','')||'Standard'})</span><b>{q?Number(q.shipping_amount)===0?'FREE':money(q.shipping_amount):'…'}</b></div>
            <div className="sh-row"><span>Tax</span><b>{q?money(q.tax_total):'…'}</b></div>
            <div className="sh-row total"><span>Total</span><b>{q?money(q.total):'…'}</b></div>
            {quote.error&&<p className="error" role="alert">{quote.error}</p>}
            <button type="submit" form="sh-checkout-form" className="ps-btn ps-btn-purple sh-checkout-btn" disabled={busy||!methods.data}><Lock size={17} aria-hidden="true"/> {busy?'Checking…':'Continue to Review & Pay'}</button>
            <p className="sh-tiny">Your final total is confirmed on the next step.</p>
          </section>
          <Confidence/>
        </aside>
      </div>}
    </div>
  </main>;
}

function Confidence(){
  return <section className="sh-card sh-confidence" aria-labelledby="sh-coconf-title">
    <h2 id="sh-coconf-title">Shop with Confidence</h2>
    <ul>
      <li><ShieldCheck aria-hidden="true"/><div><b>Designed In-House</b><small>Every design is an original by the PrintSteez team.</small></div></li>
      <li><Truck aria-hidden="true"/><div><b>Free Shipping over {FREE_SHIPPING_LABEL}</b><small>With Standard Shipping to the US.</small></div></li>
      <li><Package aria-hidden="true"/><div><b>Easy Returns</b><small>{RETURN_DAYS}-day returns for misprints and defects.</small></div></li>
      <li><Mail aria-hidden="true"/><div><b>Friendly Support</b><small>Questions? <Link href="/contact">Contact us</Link>.</small></div></li>
    </ul>
  </section>;
}

// ---------- Step 3: review the server quote, demo payment, place the order ----------
export function CheckoutPaymentPage({cart,onOrderPlaced}:{cart:ApiCart|null;onOrderPlaced:()=>void}){
  const router=useRouter();
  const [state,setState]=useState<CheckoutState|null>(null),[ready,setReady]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[review,setReview]=useState(false);
  useEffect(()=>{setState(readSession<CheckoutState>(CHECKOUT_KEY));setReady(true)},[]);
  async function place(){
    const token=getCartToken();
    if(!state)return;
    if(!token){setError('Your cart is empty.');return}
    setBusy(true);setError('');setReview(false);
    try{
      const r=await placeOrder(state.quote.checkout_session_id,token);
      writeSession(LAST_ORDER_KEY,{code:r.order_public_code,total:Number(r.order_total),email:state.form.email});
      clearSession(CHECKOUT_KEY);onOrderPlaced();router.push('/checkout/confirmation');
    }catch(e){setError(errText(e));setReview(e instanceof ApiError&&(e.status===400||e.status===409))}finally{setBusy(false)}
  }
  if(!ready)return <main className="sh-page sh-co"><CheckoutHero/><div className="sh-wrap"><CheckoutSteps active={2}/><p className="sh-muted" aria-busy="true">Loading…</p></div></main>;
  if(!state)return <main className="sh-page sh-co"><CheckoutHero/><div className="sh-wrap"><CheckoutSteps active={2}/>
    <div className="sh-empty"><Package size={46} strokeWidth={1.5} aria-hidden="true"/><h2>No checkout in progress</h2><p>Enter your shipping details first.</p><Link className="ps-btn ps-btn-purple" href="/checkout/shipping">Go to checkout <ArrowRight size={16}/></Link></div></div></main>;
  const {quote:q,form:ship}=state;
  // color swatches for the thumbnails come from the cart (the quote has color names only)
  const hexOf=(sku:string,name:string|null)=>cart?.items.find(x=>x.sku===sku)?.color_hex||cart?.items.find(x=>x.color_name===name)?.color_hex||null;
  const items=q.items.map((x,i)=>({key:x.sku+i,title:x.title,product:x.product_name,color:x.color_name,hex:hexOf(x.sku,x.color_name),size:x.size_code,qty:x.quantity,total:x.line_total,image:imageUrl(x.preview_url)}));
  const count=q.items.reduce((s,x)=>s+x.quantity,0);
  const disc=Number(q.discount_total),shipAmt=Number(q.shipping_amount);

  return <main className="sh-page sh-co">
    <CheckoutHero/>
    <div className="sh-wrap">
      <CheckoutSteps active={2}/>
      <div className="sh-two">
        <div className="sh-col-main">
          <Section n={1} title="Contact & Shipping" sub="Check where your order is going.">
            <div className="sh-review">
              <div><span className="sh-review-k">Contact</span><p>{ship.email}<br/>{ship.phone}</p></div>
              <div><span className="sh-review-k">Ship to</span><p>{ship.fullName}<br/>{ship.address}{ship.apartment?', '+ship.apartment:''}<br/>{ship.city}, {ship.state} {ship.zip}</p></div>
              <Link className="sh-link" href="/checkout/shipping"><PenLine size={15} aria-hidden="true"/> Edit</Link>
            </div>
            {q.estimated_delivery_start&&<p className="sh-delivery"><Truck aria-hidden="true"/> Estimated delivery: <b>{shortDate(q.estimated_delivery_start)}{q.estimated_delivery_end&&' – '+shortDate(q.estimated_delivery_end)}</b></p>}
          </Section>
          <Section n={2} title="Payment Method" sub="Online payment is not live yet.">
            <div className="sh-methods" role="radiogroup" aria-label="Payment method">
              <label className="sh-method on"><input type="radio" name="payment" checked readOnly/><CreditCard aria-hidden="true"/>
                <span className="sh-method-text"><b>Demo payment</b><small>No real charge is made. Your order is created so you can track it.</small></span></label>
            </div>
            <p className="sh-notice" role="note">Demo payment only. No card details are needed and no money is taken.</p>
          </Section>
          {error&&<p className="error" role="alert">{error}</p>}
          {review&&<Link className="sh-outline-btn" href="/checkout/shipping">Review your order</Link>}
          <div className="sh-co-actions"><Link className="sh-back" href="/checkout/shipping"><ArrowLeft size={16} aria-hidden="true"/> Back to Checkout</Link></div>
        </div>

        <aside className="sh-col-side">
          <section className="sh-card sh-summary" aria-labelledby="sh-paysum-title">
            <h2 id="sh-paysum-title">Order Summary</h2>
            <p className="sh-muted">{count} {count===1?'item':'items'} designed by the PrintSteez team</p>
            <SummaryItems items={items}/>
            <PromoBox/>
            <div className="sh-row"><span>Subtotal ({count} {count===1?'item':'items'})</span><b>{money(q.subtotal)}</b></div>
            {disc>0&&<div className="sh-row disc"><span>{q.discount_name||'Discount'}</span><b>−{money(disc)}</b></div>}
            <div className="sh-row"><span>Shipping</span><b>{shipAmt===0?'FREE':money(shipAmt)}</b></div>
            <div className="sh-row"><span>Tax{ship.state?' ('+ship.state+')':''}</span><b>{money(q.tax_total)}</b></div>
            <div className="sh-row total"><span>Total</span><b>{money(q.total)}</b></div>
            <button type="button" className="ps-btn ps-btn-orange sh-place" disabled={busy} onClick={place}><Lock size={18} aria-hidden="true"/> {busy?'Placing order…':'Place Order – '+money(q.total)}</button>
            <p className="sh-secure"><Lock size={14} aria-hidden="true"/> Demo checkout, no real charge</p>
            {q.quote_expires_at&&<p className="sh-tiny">Prices are held until {new Date(q.quote_expires_at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}.</p>}
          </section>
          <Confidence/>
        </aside>
      </div>
    </div>
  </main>;
}

// ---------- Step 4: order complete ----------
export function CheckoutConfirmationPage(){
  const [order,setOrder]=useState<{code:string;total:number;email:string}|null>(null),[ready,setReady]=useState(false);
  useEffect(()=>{setOrder(readSession(LAST_ORDER_KEY));setReady(true)},[]);
  if(!ready)return <main className="sh-page sh-co"><div className="sh-wrap"><p className="sh-muted" aria-busy="true">Loading…</p></div></main>;
  if(!order)return <main className="sh-page sh-co"><div className="sh-wrap"><div className="sh-empty"><Package size={46} strokeWidth={1.5} aria-hidden="true"/><h1>No recent order found</h1><p>If you placed an order, use your order number to track it.</p><Link className="ps-btn ps-btn-purple" href="/track-order">Track an order <ArrowRight size={16}/></Link></div></div></main>;
  return <main className="sh-page sh-co">
    <CheckoutHero/>
    <div className="sh-wrap">
      <CheckoutSteps active={3}/>
      <section className="sh-card sh-done" aria-labelledby="sh-done-title">
        <span className="sh-done-icon" aria-hidden="true"><Check size={34} strokeWidth={3}/></span>
        <h1 id="sh-done-title">Order placed!</h1>
        <p>Thanks for shopping with PrintSteez. Save your order number to track your order.</p>
        <div className="sh-done-ref"><div><small>Order Number</small><b>{order.code}</b></div><div><small>Order Total</small><b>{money(order.total)}</b></div></div>
        <div className="sh-done-actions">
          <Link className="ps-btn ps-btn-purple" href={'/track-order?code='+encodeURIComponent(order.code)+'&email='+encodeURIComponent(order.email)}>Track this order <ArrowRight size={16}/></Link>
          <Link className="sh-outline-btn" href="/designs">Continue shopping</Link>
        </div>
      </section>
    </div>
  </main>;
}
