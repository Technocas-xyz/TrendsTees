import Link from 'next/link';
import {Heart,Shirt} from 'lucide-react';
import type {Design} from '@/components/data';

// Reviews do not exist yet. Pass `rating` only when real review data is available; without it no stars are shown.
export type Rating={average:number;count:number};

const money=(n:number)=>'$'+n.toFixed(2);
const STAR='M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z';

function Stars({rating}:{rating:Rating}){
  const filled=Math.round(Math.min(5,Math.max(0,rating.average)));
  return <div className="ps-stars" role="img" aria-label={rating.average.toFixed(1)+' out of 5 stars, '+rating.count+' reviews'}>
    {[1,2,3,4,5].map(i=><svg key={i} width="12" height="12" viewBox="0 0 24 24" aria-hidden="true"><path d={STAR} fill={i<=filled?'#F59E0B':'#E5E7EB'}/></svg>)}
    <span>({rating.count.toLocaleString()})</span>
  </div>;
}

// The design is shown printed on a blank tee. We cannot tell whether a design is light or dark yet,
// so the tee color alternates by `index` (even = black, odd = white).
export function ProductCard({design,index=0,rating,badge,wished,onWish}:{design:Design;index?:number;rating?:Rating|null;badge?:'New'|'Bestseller';wished:boolean;onWish:(id:string)=>void}){
  const href='/designs/'+encodeURIComponent(design.id);
  const tee=index%2===1?'white':'black';
  return <article className="ps-card">
    <div className="ps-card-pic">
      <Link href={href} className="ps-card-link" aria-label={design.name} tabIndex={-1}>
        <span className={'ps-tee '+tee}>
          <img className="ps-tee-img" src={'/mockups/tee-'+tee+'.png'} alt="" loading="lazy" draggable={false}/>
          {design.image?<img className="ps-tee-design" src={design.image} alt={design.name} loading="lazy"/>:<Shirt className="ps-tee-empty" size={26} strokeWidth={1.4} aria-hidden="true"/>}
        </span>
      </Link>
      {badge&&<span className={'ps-badge '+(badge==='New'?'new':'best')}>{badge}</span>}
      <button type="button" className="ps-heart" aria-pressed={wished} aria-label={(wished?'Remove from wishlist: ':'Add to wishlist: ')+design.name} onClick={()=>onWish(design.id)}>
        <Heart size={15} strokeWidth={2.2} fill={wished?'#e11d48':'none'} color={wished?'#e11d48':'#111827'}/>
      </button>
    </div>
    <div className="ps-card-info">
      <Link href={href} className="ps-card-title" title={design.name}>{design.name}</Link>
      {rating&&rating.count>0&&<Stars rating={rating}/>}
      {design.price>0&&<p className="ps-card-price">From {money(design.price)}</p>}
    </div>
  </article>;
}

export function ProductCardSkeleton(){
  return <div className="ps-card ps-skel" aria-hidden="true">
    <div className="ps-card-pic"/>
    <div className="ps-card-info"><span className="ps-skel-line"/><span className="ps-skel-line short"/></div>
  </div>;
}
