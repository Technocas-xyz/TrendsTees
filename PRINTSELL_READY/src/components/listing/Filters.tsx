'use client';
import {useEffect,useId,useRef,useState} from 'react';
import {Check,ChevronDown,SlidersHorizontal,X} from 'lucide-react';
import type {ApiFacets} from '@/lib/api';
import {SectionError} from '@/components/home/HomeSections';
import {isHiddenSize} from '@/lib/config';
import {SIZE_ORDER,sameText,type ListingQuery} from './query';

const num=(n:number)=>n.toLocaleString();
// Very light swatches (white, cream) get a darker border and check mark so they stay visible
function isLight(hex:string|null){
  const m=/^#?([0-9a-f]{6})$/i.exec((hex||'').trim());
  if(!m)return false;
  const v=parseInt(m[1],16),r=v>>16&255,g=v>>8&255,b=v&255;
  return (0.299*r+0.587*g+0.114*b)/255>0.82;
}

// Collapsible filter group
function Group({title,children}:{title:string;children:React.ReactNode}){
  const [open,setOpen]=useState(true);
  const id=useId();
  return <div className="pl-group">
    <h3><button type="button" aria-expanded={open} aria-controls={id} onClick={()=>setOpen(o=>!o)}>{title}<ChevronDown className="pl-chevron" aria-hidden="true"/></button></h3>
    <div id={id} hidden={!open} className="pl-group-body">{children}</div>
  </div>;
}

// Two-handle price slider. The URL is updated 400ms after the last move; a handle at the end of
// the range means "no limit" on that side, so it is removed from the URL.
function PriceRange({min,max,valueMin,valueMax,onCommit}:{min:number;max:number;valueMin:string;valueMax:string;onCommit:(lo:string,hi:string)=>void}){
  const clamp=(v:number)=>Math.min(max,Math.max(min,v));
  const start=valueMin?clamp(Math.floor(Number(valueMin))):min;
  const end=valueMax?clamp(Math.ceil(Number(valueMax))):max;
  const [lo,setLo]=useState(start),[hi,setHi]=useState(end);
  const commit=useRef(onCommit);commit.current=onCommit;
  // URL changed elsewhere (Clear All, back button, other filters changed the range)
  useEffect(()=>{setLo(start);setHi(end)},[start,end]);
  useEffect(()=>{
    if(lo===start&&hi===end)return;
    const t=setTimeout(()=>commit.current(lo<=min?'':String(lo),hi>=max?'':String(hi)),400);
    return()=>clearTimeout(t);
  },[lo,hi,start,end,min,max]);
  const pct=(v:number)=>(v-min)/(max-min)*100;
  return <div className="pl-pricerange">
    <div className="pl-range" style={{'--lo':pct(lo)+'%','--hi':pct(hi)+'%'} as React.CSSProperties}>
      <span className="pl-range-track" aria-hidden="true"/>
      {/* When both handles meet at the top, the lower one must stay on top so it can still be dragged down */}
      <input type="range" className={lo>=max-(max-min)*0.05?'top':''} min={min} max={max} step={1} value={lo} aria-label="Minimum price" aria-valuetext={'$'+lo} onChange={e=>setLo(Math.min(Number(e.target.value),hi))}/>
      <input type="range" min={min} max={max} step={1} value={hi} aria-label="Maximum price" aria-valuetext={'$'+hi} onChange={e=>setHi(Math.max(Number(e.target.value),lo))}/>
    </div>
    <div className="pl-price-values"><span>${lo}</span><span>${hi}</span></div>
  </div>;
}

export type FilterHandlers={
  onNiche:(slug:string)=>void;
  onPrice:(lo:string,hi:string)=>void;
  onSizes:(sizes:string[])=>void;
  onColors:(colors:string[])=>void;
  onClear:()=>void;
};

// Left "Filters" card (desktop) / slide-in panel (mobile). Counts come from GET /designs/facets.
// A value with 0 matches is greyed out and disabled, unless it is selected (so it can still be unselected).
export function Filters({facets,error,retry,query,mobile,open,onClose,total,handlers}:{facets:ApiFacets|null;error:string;retry:()=>void;query:ListingQuery;mobile:boolean;open:boolean;onClose:()=>void;total:number|null;handlers:FilterHandlers}){
  const panel=useRef<HTMLElement>(null),closeBtn=useRef<HTMLButtonElement>(null);
  const [allColors,setAllColors]=useState(false);
  const asDialog=mobile&&open;

  // Mobile panel: lock page scroll, focus the panel, Escape closes, Tab stays inside
  useEffect(()=>{
    if(!asDialog)return;
    const prev=document.body.style.overflow;
    document.body.style.overflow='hidden';
    closeBtn.current?.focus();
    const onKey=(e:KeyboardEvent)=>{
      if(e.key==='Escape'){onClose();return}
      if(e.key!=='Tab'||!panel.current)return;
      // visible, enabled controls only (collapsed groups are skipped)
      const items=Array.from(panel.current.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),a[href]')).filter(el=>el.offsetParent!==null);
      if(!items.length)return;
      const first=items[0],last=items[items.length-1];
      if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}
      else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}
    };
    document.addEventListener('keydown',onKey);
    return()=>{document.body.style.overflow=prev;document.removeEventListener('keydown',onKey)};
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[asDialog]);

  // Sizes: S–3XL always, then any other size the API knows, then anything selected in the URL. Never XS.
  const facetSizes=(facets?.sizes||[]).filter(s=>!isHiddenSize(s.size_code));
  const sizeCount=new Map(facetSizes.map(s=>[s.size_code.toUpperCase(),s.count]));
  const sizes=[...SIZE_ORDER];
  for(const s of [...facetSizes.map(x=>x.size_code.toUpperCase()),...query.sizes])if(!sizes.includes(s)&&!isHiddenSize(s))sizes.push(s);
  const sizeOn=(s:string)=>query.sizes.includes(s);
  const toggleSize=(s:string)=>{const next=sizeOn(s)?query.sizes.filter(x=>x!==s):[...query.sizes,s];handlers.onSizes(sizes.filter(x=>next.includes(x)))};

  // Colors: the API's list plus any selected color it does not know
  const colors=[...(facets?.colors||[])];
  for(const c of query.colors)if(!colors.some(x=>sameText(x.color_name,c)))colors.push({color_name:c,color_hex:null,count:0});
  const colorOn=(c:string)=>query.colors.some(x=>sameText(x,c));
  const toggleColor=(c:string)=>handlers.onColors(colorOn(c)?query.colors.filter(x=>!sameText(x,c)):[...query.colors,c]);
  const COLOR_LIMIT=10;
  const shownColors=allColors?colors:colors.slice(0,COLOR_LIMIT);

  const priceMin=facets&&facets.price.min!==null?Math.floor(Number(facets.price.min)):null;
  const priceMax=facets&&facets.price.max!==null?Math.ceil(Number(facets.price.max)):null;

  return <>
    {asDialog&&<div className="pl-overlay" onClick={onClose} aria-hidden="true"/>}
    <aside ref={panel} id="pl-filters" className={'pl-filters'+(open?' open':'')} aria-label="Filters" role={asDialog?'dialog':undefined} aria-modal={asDialog||undefined}>
      <div className="pl-filters-head">
        <h2><SlidersHorizontal aria-hidden="true"/>Filters</h2>
        <button type="button" className="pl-clear" onClick={handlers.onClear}>Clear All</button>
        <button type="button" ref={closeBtn} className="pl-close" onClick={onClose} aria-label="Close filters"><X/></button>
      </div>

      {error&&!facets?<div className="pl-group"><SectionError error={error} retry={retry}/></div>:!facets?
        <div className="pl-group" aria-busy="true">{[0,1,2,3,4,5].map(i=><span key={i} className="ps-skel-line pl-skel-row"/>)}</div>:<>

        {facets.niches.length>0&&<Group title="Category">
          <ul className="pl-checks">{facets.niches.map(n=>{const on=sameText(n.category_slug,query.niche);const off=n.count===0&&!on;
            return <li key={n.category_id}><label className={off?'off':''}><input type="checkbox" checked={on} disabled={off} onChange={()=>handlers.onNiche(on?'':n.category_slug)}/><span>{n.category_name} <small>({num(n.count)})</small></span></label></li>})}</ul>
        </Group>}

        <Group title="Price">
          {priceMin===null||priceMax===null?<p className="pl-note">No prices for these filters.</p>:
           priceMin>=priceMax?<p className="pl-note">All designs here start at ${Number(facets.price.min).toFixed(2)}.</p>:
           <PriceRange min={priceMin} max={priceMax} valueMin={query.priceMin} valueMax={query.priceMax} onCommit={handlers.onPrice}/>}
        </Group>

        <Group title="Size">
          <ul className="pl-checks">{sizes.map(s=>{const count=sizeCount.get(s)??0,on=sizeOn(s),off=count===0&&!on;
            return <li key={s}><label className={off?'off':''}><input type="checkbox" checked={on} disabled={off} onChange={()=>toggleSize(s)}/><span>{s} <small>({num(count)})</small></span></label></li>})}</ul>
        </Group>

        {colors.length>0&&<Group title="Color">
          <ul className="pl-swatches">{shownColors.map(c=>{const on=colorOn(c.color_name),off=c.count===0&&!on,tip=c.color_name+' ('+num(c.count)+')';
            return <li key={c.color_name}><button type="button" className={'pl-swatch'+(on?' on':'')+(off?' off':'')+(isLight(c.color_hex)?' light':'')}
              style={{background:c.color_hex||'#D1D5DB'}} data-tip={tip} aria-label={tip} aria-pressed={on} disabled={off} onClick={()=>toggleColor(c.color_name)}>
              {on&&<Check aria-hidden="true"/>}</button></li>})}</ul>
          {colors.length>COLOR_LIMIT&&<button type="button" className="pl-more" onClick={()=>setAllColors(v=>!v)}>{allColors?'− Less':'+ More'}</button>}
        </Group>}
      </>}

      <div className="pl-filters-foot"><button type="button" className="ps-btn ps-btn-purple" onClick={onClose}>{total===null?'Show designs':'Show '+num(total)+(total===1?' design':' designs')}</button></div>
    </aside>
  </>;
}
