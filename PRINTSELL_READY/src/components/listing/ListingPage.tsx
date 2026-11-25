'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import {usePathname,useRouter,useSearchParams} from 'next/navigation';
import {SlidersHorizontal} from 'lucide-react';
import {ApiError,getDesignFacets,getDesignPage,getNiches,imageUrl,toDesign} from '@/lib/api';
import {ProductCard,ProductCardSkeleton} from '@/components/home/ProductCard';
import {Newsletter,SectionError} from '@/components/home/HomeSections';
import {useApi} from '@/components/home/useApi';
import {CategoryHero,type CategoryImage} from './CategoryHero';
import {Filters,type FilterHandlers} from './Filters';
import {NichePills} from './NichePills';
import {Pagination} from './Pagination';
import {RecentlyViewed} from './RecentlyViewed';
import {PER_PAGE,SORTS,activeFilterCount,apiFilters,readQuery,sameText,titleCase} from './query';

function useIsMobile(){
  const [mobile,setMobile]=useState(false);
  useEffect(()=>{
    const mq=window.matchMedia('(max-width: 899px)');
    const update=()=>setMobile(mq.matches);
    update();mq.addEventListener('change',update);
    return()=>mq.removeEventListener('change',update);
  },[]);
  return mobile;
}

// /designs listing. categoryImages = banner images in public/categories (read on the server).
export function ListingPage({categoryImages,onWish,wishlist}:{categoryImages:CategoryImage[];onWish:(id:string)=>void;wishlist:string[]}){
  const params=useSearchParams(),router=useRouter(),pathname=usePathname();
  const query=useMemo(()=>readQuery(params),[params]);
  const mobile=useIsMobile();
  const [filtersOpen,setFiltersOpen]=useState(false);
  const results=useRef<HTMLDivElement>(null),filtersBtn=useRef<HTMLButtonElement>(null);
  useEffect(()=>{if(!mobile)setFiltersOpen(false)},[mobile]);

  // URL for the current listing with some params changed ('' removes one). Any change except the page goes back to page 1.
  function hrefWith(changes:Record<string,string>){
    const p=new URLSearchParams(params.toString());
    for(const [k,v] of Object.entries(changes)){if(v)p.set(k,v);else p.delete(k)}
    if(!('page' in changes))p.delete('page');
    const s=p.toString();
    return pathname+(s?'?'+s:'');
  }
  // push = one back-button step per choice; the price slider uses replace so dragging does not fill the history
  const go=(changes:Record<string,string>,replace=false)=>replace?router.replace(hrefWith(changes),{scroll:false}):router.push(hrefWith(changes),{scroll:false});
  const toResults=()=>results.current?.scrollIntoView({behavior:'smooth',block:'start'});

  const filters=apiFilters(query);
  const pageParams={...filters,sort:query.sort||undefined,limit:PER_PAGE,offset:(query.page-1)*PER_PAGE};

  // Interest name, description, cover and niches. An unknown slug (or a niche slug used as category) is not an error.
  const info=useApi(async()=>{
    if(!query.category)return null;
    try{return await getNiches(query.category)}
    catch(e){if(e instanceof ApiError&&e.status===404)return null;throw e}
  },'niches|'+query.category);
  const facets=useApi(()=>getDesignFacets(filters),'facets|'+JSON.stringify(filters),true);
  const list=useApi(async()=>{const r=await getDesignPage(pageParams);return {items:r.items.map(toDesign),total:r.total}},'designs|'+JSON.stringify(pageParams),true);

  const interest=info.data?.interest??null;
  const niches=info.data?.niches??[];
  const hoodies=query.product==='hoodie';
  const noun=hoodies?'Hoodies':'T-Shirts';
  const interestName=interest?.category_name||(query.category?titleCase(query.category):'');
  const nicheName=query.niche?(niches.find(n=>sameText(n.category_slug,query.niche))?.category_name||facets.data?.niches.find(n=>sameText(n.category_slug,query.niche))?.category_name||titleCase(query.niche)):'';

  const heroTitle=query.search?'Search: "'+query.search+'"':interestName?interestName+' '+noun:'All Graphic '+(hoodies?'Hoodies':'Tees');
  const heroText=query.search
    ?'Original graphic tees matching "'+query.search+'"'+(interestName?' in '+interestName:'')+', designed in-house and printed just for you.'
    :interest?.description||'Original graphic tees, designed in-house by the PrintSteez team and printed just for you.';
  // The banner image has its title drawn in (e.g. "Animals T-Shirts"), so it is only used when that title is right:
  // not for a search ("Search: ...") and not for the hoodie view.
  const slug=(query.category||'all').toLowerCase();
  const heroImage=query.search||hoodies?null:categoryImages.find(c=>c.slug===slug)||null;
  const heroCover=heroImage?null:imageUrl(interest?.cover_url);

  const total=list.data?.total??null;
  const pages=total?Math.ceil(total/PER_PAGE):0;
  const what=nicheName||interestName;
  const heading=total===null?'':query.search&&!what
    ?total.toLocaleString()+(total===1?' result':' results')+' for "'+query.search+'"'
    :total.toLocaleString()+' '+(what?what+' '+noun:'Graphic '+(hoodies?'Hoodies':'Tees'));

  const handlers:FilterHandlers={
    onNiche:slug=>go({niche:slug}),
    onPrice:(lo,hi)=>go({price_min:lo,price_max:hi},true),
    onSizes:sizes=>go({sizes:sizes.join(',')}),
    onColors:colors=>go({colors:colors.join(',')}),
    onClear:()=>go({niche:'',price_min:'',price_max:'',sizes:'',colors:''}),
  };
  const closeFilters=()=>{setFiltersOpen(false);filtersBtn.current?.focus()};
  const active=activeFilterCount(query);

  return <main className="pl-listing">
    <div className="pl-wrap">
      {/* banner sits in the same centered container as the filters and grid */}
      <CategoryHero label={hoodies?'GRAPHIC HOODIES':'GRAPHIC TEES'} title={heroTitle} description={heroText} image={heroImage} cover={heroCover} loading={!!query.category&&!query.search&&info.loading&&!info.data}/>

      {interest&&<NichePills interestName={interest.category_name} interestSlug={interest.category_slug} interestCover={interest.cover_url} niches={niches} active={query.niche} href={n=>hrefWith({niche:n})}/>}

      <div className="pl-layout">
        <Filters facets={facets.data} error={facets.error} retry={facets.retry} query={query} mobile={mobile} open={filtersOpen} onClose={closeFilters} total={total} handlers={handlers}/>

        <div className="pl-results" ref={results}>
          <div className="pl-results-head">
            <h2 aria-live="polite">{heading||<span className="ps-skel-line pl-skel-title" aria-hidden="true"/>}</h2>
            <div className="pl-tools">
              <button type="button" ref={filtersBtn} className="pl-filters-btn" aria-expanded={filtersOpen} aria-controls="pl-filters" onClick={()=>setFiltersOpen(true)}>
                <SlidersHorizontal aria-hidden="true"/>Filters{active>0&&<span className="pl-count">{active}</span>}
              </button>
              <label className="pl-sort">Sort by:
                <select value={query.sort} onChange={e=>go({sort:e.target.value})}>{SORTS.map(([label,value])=><option key={label} value={value}>{label}</option>)}</select>
              </label>
            </div>
          </div>

          {list.error?<SectionError error={list.error} retry={list.retry}/>:!list.data?
            <div className="pl-grid" aria-busy="true">{Array.from({length:8},(_,i)=><ProductCardSkeleton key={i}/>)}</div>:
            list.data.items.length===0?
            <div className="pl-empty">
              <h3>{query.page>1&&total?'This page is empty':'No designs match these filters'}</h3>
              <p>{query.page>1&&total?'There are fewer pages now.':'Try removing a filter.'}</p>
              {query.page>1&&total?<button type="button" className="ps-btn ps-btn-purple" onClick={()=>go({page:''})}>Go to page 1</button>
                :active>0&&<button type="button" className="ps-btn ps-btn-purple" onClick={handlers.onClear}>Clear All Filters</button>}
            </div>:
            <div className={'pl-grid'+(list.loading?' updating':'')} aria-busy={list.loading}>
              {list.data.items.map((d,i)=><ProductCard key={d.id} design={d} index={i} wished={wishlist.includes(d.id)} onWish={onWish}/>)}
            </div>}

          {list.data&&!list.error&&<Pagination page={query.page} pages={pages} href={n=>hrefWith({page:n>1?String(n):''})} onNavigate={toResults}/>}
        </div>
      </div>

      <RecentlyViewed/>
    </div>
    <Newsletter/>
  </main>;
}
