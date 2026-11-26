"use client";
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {LayoutDashboard,ShoppingBag,Heart,LogOut,ArrowRight,Crown,MessageCircle,ShoppingCart,CircleHelp} from 'lucide-react';
import {loadCart,getMyOrders,getMyOrder,getMe,logoutCustomer,getDesign,toDesign,imageUrl,getVariants,ensureCart,addCartItem,type ApiMyOrder,type ApiTrackedOrder} from '@/lib/api';
import type {Design} from '@/components/data';
import {isHiddenSize} from '@/lib/config';
import {Header,Bottom,OrderDetails,statusLabel} from './Site';
import './account.css';
type User = {name:string;email:string};
// Only pages that have real data behind them (no addresses, payments, preferences or password change yet)
const tabs=[{name:'Account Overview',slug:'',Icon:LayoutDashboard},{name:'My Orders',slug:'orders',Icon:ShoppingBag},{name:'Wishlist',slug:'wishlist',Icon:Heart}];
const WISH_KEY='printandsell-wishlist';
const read=(key:string)=>{try{const raw=localStorage.getItem(key);return raw?JSON.parse(raw):null}catch{return null}};
const dollars=(n:string|number)=>'$'+Number(n).toFixed(2);
const errMsg=(e:unknown)=>e instanceof Error?e.message:String(e);
const itemsText=(n:number)=>n+(n===1?' item':' items');
const day=(s:string)=>new Date(s).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
const initials=(name:string,email:string)=>{const p=name.trim().split(/\s+/).filter(Boolean);return ((p.length>1?p[0][0]+p[p.length-1][0]:(p[0]||email||'?').slice(0,2))).toUpperCase()};
const orderHref=(code:string)=>'/account/orders?order='+encodeURIComponent(code);
const statusTone=(s:string)=>s==='delivered'?'done':s==='shipped'?'ship':/cancel|refund|fail/.test(s)?'bad':'wip';
// Blank tee with the design printed on the chest (same placement as the product cards)
function TeeThumb({url,title,size='sm'}:{url:string|null;title:string;size?:'sm'|'lg'}){return <span className={'acc-tee '+size}><img className="acc-tee-img" src="/mockups/tee-black.png" alt="" loading="lazy"/>{url&&<img className="acc-tee-art" src={url} alt={title} loading="lazy"/>}</span>}
// One order from /me/orders/{code}, shown with the same layout as the Track Order page
function MyOrderDetail({code}:{code:string}){const [order,setOrder]=useState<ApiTrackedOrder|null>(null),[error,setError]=useState(''),[tick,setTick]=useState(0);useEffect(()=>{let live=true;setOrder(null);setError('');getMyOrder(code).then(o=>{if(live)setOrder(o)}).catch(e=>{if(live)setError(errMsg(e))});return()=>{live=false}},[code,tick]);return <div><Link className="acc-link" href="/account/orders">← All orders</Link>{error?<div className="acc-retry"><p className="error">{error}</p><button className="outline-button" onClick={()=>setTick(x=>x+1)}>Retry</button></div>:!order?<p className="acc-muted">Loading order…</p>:<OrderDetails order={order}/>}</div>}

function OrderRow({o}:{o:ApiMyOrder}){
 return <div className="acc-order">
  <TeeThumb url={imageUrl(o.preview_url)} title={o.order_public_code}/>
  <div className="acc-order-main"><b>Order #{o.order_public_code}</b><span>Placed on {day(o.placed_at)}</span><span>{itemsText(o.item_count)} • {dollars(o.order_total)}</span></div>
  <div className="acc-order-status"><span className={'acc-badge '+statusTone(o.order_status)}>{statusLabel(o.order_status)}</span><Link className="acc-link" href={orderHref(o.order_public_code)}>Track Order <ArrowRight size={14}/></Link></div>
  <Link className="acc-outline" href={orderHref(o.order_public_code)}>View Details</Link>
 </div>;
}

function WishCard({d,onRemove}:{d:Design;onRemove:(id:string)=>void}){
 const router=useRouter(); const [busy,setBusy]=useState(false),[note,setNote]=useState('');
 const href='/designs/'+encodeURIComponent(d.id);
 // Adds straight to the cart only when there is exactly one size/colour to pick; otherwise opens the design page
 async function add(){
  setBusy(true);setNote('');
  try{
   const full=await getDesign(d.id);
   const products=full.products||[];
   const variants=products.length===1?(await getVariants(products[0].product_id)).variants.filter(v=>!isHiddenSize(v.size_code)&&v.in_stock!==false):[];
   if(variants.length!==1){router.push(href);return}
   await addCartItem(await ensureCart(),{public_design_code:d.id,product_variant_id:variants[0].product_variant_id,quantity:1});
   setNote('Added to cart');
  }catch(e){setNote(errMsg(e))}finally{setBusy(false)}
 }
 return <article className="acc-wish">
  <div className="acc-wish-pic"><Link href={href} aria-label={d.name}><TeeThumb url={d.image||null} title={d.name} size="lg"/></Link>
   <button type="button" className="acc-heart" aria-label={'Remove '+d.name+' from wishlist'} onClick={()=>onRemove(d.id)}><Heart size={15} fill="#e11d48" color="#e11d48"/></button></div>
  <div className="acc-wish-info"><Link href={href} className="acc-wish-title">{d.name}</Link>{d.price>0&&<strong>From {dollars(d.price)}</strong>}
   <button type="button" className="acc-add" disabled={busy} onClick={add}><ShoppingCart size={15}/> {busy?'Adding…':'Add to Cart'}</button>{note&&<small role="status">{note}</small>}</div>
 </article>;
}

function Dashboard({user,section,orderCode=''}:{user:User;section:string;orderCode?:string}){
 const router=useRouter(); const [ready,setReady]=useState(false),[wishIds,setWishIds]=useState<string[]>([]),[cartCount,setCartCount]=useState(0);
 const [orders,setOrders]=useState<ApiMyOrder[]|null>(null),[ordersError,setOrdersError]=useState(''),[ordersTick,setOrdersTick]=useState(0);
 const [wishDesigns,setWishDesigns]=useState<Design[]|null>(null),[wishError,setWishError]=useState('');
 useEffect(()=>{const w=read(WISH_KEY)??read('printsell-wishlist')??[];setWishIds(Array.isArray(w)?[...new Set((w as (string|number)[]).map(String))]:[]);loadCart().then(c=>setCartCount(c.item_count)).catch(()=>{});setReady(true)},[]);
 useEffect(()=>{let live=true;setOrdersError('');getMyOrders().then(o=>{if(live)setOrders(o)}).catch(e=>{if(live)setOrdersError(errMsg(e))});return()=>{live=false}},[ordersTick]);
 const wantWish=section==='wishlist'||section==='overview', limit=section==='wishlist'?24:3, shownIds=wishIds.slice(0,limit).join(',');
 useEffect(()=>{if(!ready||!wantWish)return;let live=true;const ids=shownIds?shownIds.split(','):[];if(!ids.length){setWishDesigns([]);return}
  Promise.allSettled(ids.map(id=>getDesign(id))).then(r=>{if(!live)return;setWishDesigns(r.flatMap(x=>x.status==='fulfilled'?[toDesign(x.value)]:[]));if(r.some(x=>x.status==='rejected'&&(x.reason as {status?:number})?.status!==404&&(x.reason as {status?:number})?.status!==422))setWishError('Some saved items could not be loaded.');else setWishError('')});
  return()=>{live=false}},[ready,wantWish,shownIds]);
 function removeWish(id:string){const n=wishIds.filter(x=>x!==id);setWishIds(n);setWishDesigns(d=>d&&d.filter(x=>x.id!==id));try{localStorage.setItem(WISH_KEY,JSON.stringify(n))}catch{}}
 const retryOrders=<div className="acc-retry"><p className="error">{ordersError}</p><button className="outline-button" onClick={()=>setOrdersTick(x=>x+1)}>Retry</button></div>;
 async function logout(){await logoutCustomer().catch(()=>{});router.replace('/');router.refresh()}
 const first=user.name.trim().split(/\s+/)[0]||'there';
 const wishGrid=(list:Design[])=><div className="acc-wishgrid">{list.map(d=><WishCard key={d.id} d={d} onRemove={removeWish}/>)}</div>;
 const wishEmpty=<div className="acc-empty"><Heart size={38}/><h3>Nothing saved yet</h3><p>Tap the heart on any design to save it for later.</p><Link className="acc-primary" href="/designs">Browse Collections</Link></div>;
 const ordersEmpty=<div className="acc-empty"><ShoppingBag size={38}/><h3>No orders yet</h3><p>Orders you place while signed in will show up here.</p><Link className="acc-primary" href="/designs">Shop New Tees</Link></div>;
 const wishBody=wishIds.length===0?wishEmpty:!wishDesigns?<p className="acc-muted">Loading saved items…</p>:wishDesigns.length===0?<p className="acc-muted">{wishError||'Your saved designs are no longer available.'}</p>:<>{wishGrid(wishDesigns)}{wishError&&<p className="error">{wishError}</p>}</>;
 const heroArt=imageUrl(orders?.find(o=>o.preview_url)?.preview_url)||wishDesigns?.find(d=>d.image)?.image||null;
 const pageTitle=section==='orders'?'My Orders':section==='wishlist'?'Wishlist':'My Account';
 const sub=section==='overview'?'Manage your orders, saved items and account details.':section==='orders'?'Everything you have ordered, newest first.':'Designs you saved.';
 return <><Header count={cartCount} user={{name:user.name,email:user.email}}/><div className="container page acc-page"><div className="acc-layout">
  <aside className="acc-sidebar"><div className="acc-avatar" aria-hidden="true">{initials(user.name,user.email)}</div><strong>{user.name}</strong><small>{user.email}</small><span className="acc-member"><Crown size={13}/> PrintSteez Member</span>
   <nav aria-label="Account">{tabs.map(({name,slug,Icon})=><Link key={name} href={'/account'+(slug?'/'+slug:'')} className={section===(slug||'overview')?'selected':''}><Icon size={18}/>{name}</Link>)}<button onClick={logout}><LogOut size={18}/> Sign Out</button></nav></aside>
  <main className="acc-main"><h1>{pageTitle}</h1><p className="acc-sub">{sub}</p>
  {!ready?<div className="acc-card">Loading your dashboard...</div>:<>
  {section==='overview'&&<>
   <section className="acc-hero"><div className="acc-hero-copy"><h2>Welcome back, {first}! <span aria-hidden="true">👋</span></h2><p>Thanks for being part of PrintSteez - original graphic tees designed in-house.</p><div className="acc-hero-btns"><Link className="acc-cta" href="/designs?sort=newest">Shop New Tees <ArrowRight size={15}/></Link><Link className="acc-cta ghost" href="/#collections">Browse Collections</Link></div></div>
    <div className="acc-hero-art" aria-hidden="true"><TeeThumb url={heroArt} title="" size="lg"/><span className="acc-hero-white"><img className="acc-tee-img" src="/mockups/tee-white.png" alt=""/></span></div></section>
   <div className="acc-stats"><div><ShoppingBag size={26}/><span><strong>{orders?orders.length:ordersError?'—':'…'}</strong><small>Total Orders</small></span></div><div><Heart size={26}/><span><strong>{wishIds.length}</strong><small>Saved Items</small></span></div></div>
   <div className="acc-head"><h2>Recent Orders</h2>{orders&&orders.length>0&&<Link className="acc-link" href="/account/orders">View All Orders <ArrowRight size={14}/></Link>}</div>
   {ordersError?retryOrders:!orders?<p className="acc-muted">Loading orders…</p>:orders.length===0?<section className="acc-card">{ordersEmpty}</section>:<div className="acc-orders">{orders.slice(0,3).map(o=><OrderRow key={o.order_public_code} o={o}/>)}</div>}
   <div className="acc-head"><h2>Your Wishlist</h2>{wishIds.length>0&&<Link className="acc-link" href="/account/wishlist">View Wishlist ({wishIds.length}) <ArrowRight size={14}/></Link>}</div>
   {wishBody}
   <section className="acc-help"><MessageCircle size={34}/><div><h2>Need Help?</h2><p>Our support team is here for you. Get help with orders, shipping, returns, or your account.</p></div><div className="acc-help-btns"><Link className="acc-cta dark" href="/contact"><MessageCircle size={15}/> Contact Support</Link><Link className="acc-outline" href="/faq"><CircleHelp size={15}/> Help Center</Link></div></section>
  </>}
  {section==='orders'&&(orderCode?<section className="acc-card"><MyOrderDetail code={orderCode}/></section>:ordersError?retryOrders:!orders?<p className="acc-muted">Loading orders…</p>:orders.length===0?<section className="acc-card">{ordersEmpty}</section>:<div className="acc-orders">{orders.map(o=><OrderRow key={o.order_public_code} o={o}/>)}</div>)}
  {section==='wishlist'&&<section className="acc-card">{wishBody}</section>}
  </>}
  </main></div></div><Bottom/></>
}

// The login cookie belongs to the API, so the site asks GET /auth/me who is signed in.
// Logged out (401): go to /login?next=<this page>.
export default function AccountDashboard({section,orderCode=''}:{section:string;orderCode?:string}){
 const router=useRouter(); const [user,setUser]=useState<User|null>(null),[error,setError]=useState(''),[tick,setTick]=useState(0);
 useEffect(()=>{let live=true;setError('');getMe().then(u=>{if(!live)return;if(u)setUser({name:u.full_name,email:u.email});else router.replace('/login?next='+encodeURIComponent('/account'+(section==='overview'?'':'/'+section)+(orderCode?'?order='+encodeURIComponent(orderCode):'')))}).catch(e=>{if(live)setError(errMsg(e))});return()=>{live=false}},[tick]);
 if(!user)return <div className="container page empty">{error?<><p className="error">{error}</p><button className="red-button" onClick={()=>setTick(x=>x+1)}>Retry</button></>:<p>Loading…</p>}</div>;
 return <Dashboard user={user} section={section} orderCode={orderCode}/>;
}
