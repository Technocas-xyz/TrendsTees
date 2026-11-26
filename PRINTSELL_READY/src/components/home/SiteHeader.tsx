'use client';
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {useRouter,usePathname} from 'next/navigation';
import {ChevronDown,Heart,Menu,Palette,Search,Shirt,ShoppingCart,Tag,Truck,UserRound,X} from 'lucide-react';
import {getInterests,getMe,logoutCustomer,type ApiInterest} from '@/lib/api';
import {COLLECTIONS,FREE_SHIPPING_LABEL,PROMO_CODE,PROMO_TEXT,SHOW_PROMO_BANNER,collectionHref,productTypeHref} from '@/lib/config';
import {useProductTypes} from './useProductTypes';
import {Logo} from './Logo';

export type StoreUser={name:string;email:string}|null;

// Closes a popup on outside click or Escape
function useDismiss(open:boolean,close:()=>void){
  const box=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    if(!open)return;
    const onDown=(e:MouseEvent)=>{if(box.current&&!box.current.contains(e.target as Node))close()};
    const onKey=(e:KeyboardEvent)=>{if(e.key==='Escape')close()};
    document.addEventListener('mousedown',onDown);document.addEventListener('keydown',onKey);
    return()=>{document.removeEventListener('mousedown',onDown);document.removeEventListener('keydown',onKey)};
  },[open]);
  return box;
}

// Account area: "Account / Sign In / Join" when logged out, "Account / Hi, <first name>" with a dropdown when logged in.
// `initial` lets a page that already knows the user skip the GET /auth/me request.
function AccountMenu({initial}:{initial?:StoreUser}){
  const router=useRouter(),pathname=usePathname();
  const [user,setUser]=useState<StoreUser|undefined>(initial),[open,setOpen]=useState(false);
  const box=useDismiss(open,()=>setOpen(false));
  useEffect(()=>{
    if(initial!==undefined)return;
    let live=true;
    getMe().then(u=>{if(live)setUser(u?{name:u.full_name,email:u.email}:null)}).catch(()=>{if(live)setUser(null)});
    return()=>{live=false};
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);
  async function signOut(){setOpen(false);await logoutCustomer().catch(()=>{});setUser(null);router.push('/');router.refresh()}
  if(user===undefined)return <span className="ps-action ps-action-placeholder" aria-hidden="true"/>;
  if(!user)return <Link className="ps-action" href={pathname&&pathname!=='/'?'/login?next='+encodeURIComponent(pathname):'/login'}>
    <UserRound/><span className="ps-action-text"><b>Account</b><small>Sign In / Join</small></span>
  </Link>;
  return <div className="ps-acct-wrap" ref={box}>
    <button type="button" className="ps-action ps-acct-trigger" aria-haspopup="menu" aria-expanded={open} onClick={()=>setOpen(o=>!o)}>
      <UserRound/><span className="ps-action-text"><b>Account</b><small>Hi, {user.name.trim().split(/\s+/)[0]}</small></span><ChevronDown className="ps-acct-chevron"/>
    </button>
    {open&&<div className="ps-acct-menu" role="menu">
      <Link role="menuitem" href="/account" onClick={()=>setOpen(false)}>Dashboard</Link>
      <Link role="menuitem" href="/account/orders" onClick={()=>setOpen(false)}>My Orders</Link>
      <Link role="menuitem" href="/wishlist" onClick={()=>setOpen(false)}>Wishlist</Link>
      <div className="ps-acct-divider" role="separator"/>
      <button type="button" role="menuitem" className="ps-acct-signout" onClick={signOut}>Sign out</button>
    </div>}
  </div>;
}

function TopBar(){
  const items:[React.ReactNode,React.ReactNode][]=[
    [<Truck key="t"/>,<>Free Shipping on Orders {FREE_SHIPPING_LABEL}+</>],
    [<Palette key="p"/>,'Designed In-House'],
    [<Shirt key="s"/>,'Unique Graphic Tees'],
  ];
  if(SHOW_PROMO_BANNER)items.push([<Tag key="g"/>,<>Use Code <b className="ps-promo-code">{PROMO_CODE}</b> {PROMO_TEXT}</>]);
  return <div className="ps-topbar"><div className="ps-topbar-inner">
    {items.map(([icon,text],i)=><span key={i} className="ps-topbar-item">{i>0&&<span className="ps-topbar-sep" aria-hidden="true">|</span>}<span className="ps-topbar-icon" aria-hidden="true">{icon}</span>{text}</span>)}
  </div></div>;
}

// Menu item with a dropdown. Desktop: opens on hover or click. Mobile (inside the hamburger panel): click toggles a list below it.
function NavDropdown({label,items,purple,wide,onOpen,onNavigate}:{label:string;items:[string,string][]|null;purple?:boolean;wide?:boolean;onOpen?:()=>void;onNavigate:()=>void}){
  const [open,setOpen]=useState(false);
  const box=useDismiss(open,()=>setOpen(false));
  return <div className={'ps-dd'+(open?' open':'')} ref={box} onMouseEnter={onOpen} onMouseLeave={()=>setOpen(false)}>
    <button type="button" className={'ps-nav-link'+(purple?' purple':'')} aria-expanded={open} onClick={()=>{onOpen?.();setOpen(o=>!o)}}>{label}<ChevronDown className="ps-dd-chevron" aria-hidden="true"/></button>
    <div className={'ps-dd-menu'+(wide?' wide':'')}>
      {items===null?<span className="ps-dd-note">Loading…</span>:items.map(([text,href])=><Link key={text} href={href} onClick={()=>{setOpen(false);onNavigate()}}>{text}</Link>)}
    </div>
  </div>;
}

export function SiteHeader({count,user}:{count:number;user?:StoreUser}){
  const [q,setQ]=useState(''),[menu,setMenu]=useState(false);
  const [interests,setInterests]=useState<ApiInterest[]|null>(null);
  const asked=useRef(false);
  const router=useRouter(),pathname=usePathname();
  useEffect(()=>{setMenu(false)},[pathname]);
  // The interest list for "Shop All" is loaded the first time that menu opens
  function loadInterests(){if(asked.current)return;asked.current=true;getInterests().then(setInterests).catch(()=>{asked.current=false;setInterests([])})}
  const close=()=>setMenu(false);
  const shopAll:[string,string][]|null=interests&&[['All Designs','/designs'],...interests.map(i=>[i.category_name,'/designs?category='+encodeURIComponent(i.category_slug)] as [string,string])];
  // Graphic Tees: only product types that have an active product
  const types=useProductTypes();
  const tees:[string,string][]|null=types&&[['All Graphic Tees','/designs'],...types.map(t=>[t.label,productTypeHref(t.slug)] as [string,string])];
  return <>
    <TopBar/>
    <header className="ps-header">
      <div className="ps-header-main">
        <button type="button" className="ps-burger" aria-label={menu?'Close menu':'Open menu'} aria-expanded={menu} aria-controls="ps-nav" onClick={()=>setMenu(m=>!m)}>{menu?<X/>:<Menu/>}</button>
        <Logo/>
        <form className="ps-search" role="search" onSubmit={e=>{e.preventDefault();close();router.push('/designs?search='+encodeURIComponent(q))}}>
          <input aria-label="Search designs" placeholder="Search graphic tees, designs..." value={q} onChange={e=>setQ(e.target.value)}/>
          <button aria-label="Search"><Search size={19}/></button>
        </form>
        <div className="ps-actions">
          <AccountMenu initial={user}/>
          <Link className="ps-action" href="/wishlist"><Heart/><span className="ps-action-text"><b>Wishlist</b></span></Link>
          <Link className="ps-action ps-cart" href="/cart" aria-label={'Cart, '+count+(count===1?' item':' items')}>
            <span className="ps-cart-icon"><ShoppingCart/><span className="ps-cart-count" aria-hidden="true">{count}</span></span>
            <b className="ps-cart-label">Cart</b>
          </Link>
        </div>
      </div>
      <nav id="ps-nav" className={'ps-nav'+(menu?' open':'')} aria-label="Main">
        <NavDropdown label="Shop All" purple wide items={shopAll} onOpen={loadInterests} onNavigate={close}/>
        <NavDropdown label="Graphic Tees" items={tees} onNavigate={close}/>
        <NavDropdown label="Collections" items={[...COLLECTIONS.map(c=>[c.name,collectionHref(c)] as [string,string]),['All Collections','/#collections']]} onNavigate={close}/>
        <Link className="ps-nav-link" href="/designs?sort=newest" onClick={close}>New Arrivals</Link>
        <Link className="ps-nav-link" href="/designs?sort=popular" onClick={close}>Bestsellers</Link>
        <Link className="ps-nav-link orange" href="/designs?sort=price_asc" onClick={close}>Sale</Link>
      </nav>
    </header>
  </>;
}
