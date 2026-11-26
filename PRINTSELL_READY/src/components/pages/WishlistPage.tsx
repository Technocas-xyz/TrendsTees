'use client';
import Link from 'next/link';
import {ArrowRight,Heart,Trash2} from 'lucide-react';
import {ApiError,getDesign,toDesign} from '@/lib/api';
import type {Design} from '@/components/data';
import {ProductCard,ProductCardSkeleton} from '@/components/home/ProductCard';
import {SectionError} from '@/components/home/HomeSections';
import {useApi} from '@/components/home/useApi';

const MAX=100;

// Saved designs (ids in localStorage, so it works for guests). Each design is loaded by its code, so a
// wishlist of any size works. Designs that no longer exist (removed, unpublished) are listed separately.
export function WishlistPage({wishlist,onWish}:{wishlist:string[];onWish:(id:string)=>void}){
  const ids=[...new Set(wishlist)].slice(0,MAX);
  const a=useApi(async()=>{
    const found:Design[]=[],missing:string[]=[];
    const results=await Promise.allSettled(ids.map(id=>getDesign(id)));
    results.forEach((r,i)=>{
      if(r.status==='fulfilled')found.push(toDesign(r.value));
      // 404 = design gone, 422 = not a design code (very old wishlist entries); anything else is a real error
      else if(r.reason instanceof ApiError&&(r.reason.status===404||r.reason.status===422))missing.push(ids[i]);
      else throw r.reason;
    });
    return {found,missing};
  },'wishlist|'+ids.join(','),true);
  const saved=(a.data?.found||[]).filter(d=>wishlist.includes(d.id));
  const missing=(a.data?.missing||[]).filter(id=>wishlist.includes(id));

  return <main className="pg-page">
    <div className="pg-wrap">
      <nav className="pg-crumb" aria-label="Breadcrumb"><Link href="/">Home</Link><span aria-hidden="true">›</span><span>Wishlist</span></nav>
      <header className="pg-head">
        <h1>Your Wishlist</h1>
        <p className="pg-lead">{ids.length===0?'Designs you save show up here.':`${ids.length} saved ${ids.length===1?'design':'designs'}, kept on this device.`}</p>
      </header>

      {ids.length===0?
        <div className="pg-empty"><Heart size={44} strokeWidth={1.6} aria-hidden="true"/><h2>Nothing saved yet</h2><p>Tap the heart on any design to save it for later.</p>
          <Link className="ps-btn ps-btn-purple" href="/designs">Browse all designs <ArrowRight size={16}/></Link></div>:
       a.error&&!a.data?<SectionError error={a.error} retry={a.retry}/>:
       !a.data?<div className="pg-wish-grid" aria-busy="true">{ids.slice(0,8).map(id=><ProductCardSkeleton key={id}/>)}</div>:<>
        {saved.length>0&&<ul className="pg-wish-grid">{saved.map((d,i)=><li key={d.id} className="pg-wish-item">
          <ProductCard design={d} index={i} wished onWish={onWish}/>
          <button type="button" className="pg-remove" onClick={()=>onWish(d.id)} aria-label={'Remove '+d.name+' from your wishlist'}><Trash2 size={15} aria-hidden="true"/> Remove</button>
        </li>)}</ul>}
        {missing.length>0&&<div className="pg-note" role="status">
          <span>{missing.length} saved {missing.length===1?'design is':'designs are'} no longer available.</span>
          <button type="button" className="pg-link-button" onClick={()=>missing.forEach(id=>onWish(id))}>Remove {missing.length===1?'it':'them'}</button>
        </div>}
        {saved.length===0&&missing.length===0&&<div className="pg-empty"><Heart size={44} strokeWidth={1.6} aria-hidden="true"/><h2>Nothing saved yet</h2>
          <Link className="ps-btn ps-btn-purple" href="/designs">Browse all designs <ArrowRight size={16}/></Link></div>}
        <p className="pg-more"><Link href="/designs">Keep browsing <ArrowRight size={15}/></Link></p>
      </>}
    </div>
  </main>;
}
