import Link from 'next/link';
import {Heart,Shirt} from 'lucide-react';
import type {Design} from '@/components/data';

// Reviews do not exist yet. Pass `rating` only when real review data is available; without it the stars row
// stays empty (its height is kept, so all cards in a row stay the same height).
export type Rating={average:number;count:number};

const money=(n:number)=>'$'+n.toFixed(2);
const STAR='M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z';
const MAX_DOTS=5;

function Stars({rating}:{rating:Rating}){
  const filled=Math.round(Math.min(5,Math.max(0,rating.average)));
  return <div className="ps-stars" role="img" aria-label={rating.average.toFixed(1)+' out of 5 stars, '+rating.count+' reviews'}>
    {[1,2,3,4,5].map(i=><svg key={i} width="12" height="12" viewBox="0 0 24 24" aria-hidden="true"><path d={STAR} fill={i<=filled?'#F59E0B':'#E5E7EB'}/></svg>)}
    <span>({rating.count.toLocaleString()})</span>
  </div>;
}

type Tee='black'|'white';
// Which blank tee to show, and which one to fade to on hover. Only black and white mockups exist.
// - available in both: alternate by `index` (even = black), hover shows the other one
// - available in one of them: that one, no hover swap
// - colors unknown, or neither black nor white: alternate by index, no hover swap
function pickTees(design:Design,index:number):{main:Tee;alt:Tee|null}{
  const names=(design.swatches||[]).map(s=>s.name.trim().toLowerCase());
  const black=names.includes('black'),white=names.includes('white');
  const byIndex:Tee=index%2===1?'white':'black';
  if(black&&white)return {main:byIndex,alt:byIndex==='black'?'white':'black'};
  if(black)return {main:'black',alt:null};
  if(white)return {main:'white',alt:null};
  return {main:byIndex,alt:null};
}

// Blank tee with the design printed on the chest (about 48% of the shirt width, from 28% of its height)
// layer: 'main' fades out and 'alt' (the second color) fades in on hover; the alt copy is hidden from screen readers
function TeeMockup({tee,design,layer}:{tee:Tee;design:Design;layer?:'main'|'alt'}){
  return <span className={'ps-tee '+tee+(layer?' '+layer:'')} aria-hidden={layer==='alt'||undefined}>
    <img className="ps-tee-img" src={'/mockups/tee-'+tee+'.png'} alt="" loading="lazy" draggable={false}/>
    {design.image?<img className="ps-tee-design" src={design.image} alt={layer==='alt'?'':design.name} loading="lazy"/>:<Shirt className="ps-tee-empty" size={26} strokeWidth={1.4} aria-hidden="true"/>}
  </span>;
}

// Small dots for the colors the design is available in (at most 5, then "+N")
function ColorDots({swatches}:{swatches:{name:string;hex:string|null}[]}){
  // empty row keeps the card the same height as its neighbours
  if(swatches.length===0)return <div className="ps-dots" aria-hidden="true"/>;
  const shown=swatches.slice(0,MAX_DOTS),more=swatches.length-shown.length;
  return <div className="ps-dots" role="img" aria-label={'Available in '+swatches.length+(swatches.length===1?' color: ':' colors: ')+swatches.map(s=>s.name).join(', ')}>
    {shown.map(s=><span key={s.name} className="ps-dot" title={s.name} style={{background:s.hex||'#D1D5DB'}}/>)}
    {more>0&&<span className="ps-dots-more" aria-hidden="true">+{more}</span>}
  </div>;
}

export function ProductCard({design,index=0,rating,badge,wished,onWish}:{design:Design;index?:number;rating?:Rating|null;badge?:'New'|'Bestseller';wished:boolean;onWish:(id:string)=>void}){
  const href='/designs/'+encodeURIComponent(design.id);
  const {main,alt}=pickTees(design,index);
  return <article className={'ps-card'+(alt?' has-alt':'')}>
    <div className="ps-card-pic">
      <Link href={href} className="ps-card-link" aria-label={design.name} tabIndex={-1}>
        <TeeMockup tee={main} design={design} layer={alt?'main':undefined}/>
        {alt&&<TeeMockup tee={alt} design={design} layer="alt"/>}
      </Link>
      {badge&&<span className={'ps-badge '+(badge==='New'?'new':'best')}>{badge}</span>}
      <button type="button" className="ps-heart" aria-pressed={wished} aria-label={(wished?'Remove from wishlist: ':'Add to wishlist: ')+design.name} onClick={()=>onWish(design.id)}>
        <Heart size={15} strokeWidth={2.2} fill={wished?'#e11d48':'none'} color={wished?'#e11d48':'#111827'}/>
      </button>
    </div>
    <div className="ps-card-info">
      <Link href={href} className="ps-card-title" title={design.name}>{design.name}</Link>
      <div className="ps-stars-row">{rating&&rating.count>0&&<Stars rating={rating}/>}</div>
      {design.price>0&&<p className="ps-card-price">From {money(design.price)}</p>}
      <ColorDots swatches={design.swatches||[]}/>
    </div>
  </article>;
}

export function ProductCardSkeleton(){
  return <div className="ps-card ps-skel" aria-hidden="true">
    <div className="ps-card-pic"/>
    <div className="ps-card-info"><span className="ps-skel-line"/><span className="ps-skel-line short"/></div>
  </div>;
}
