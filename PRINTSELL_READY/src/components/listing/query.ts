import type {DesignParams} from '@/lib/api';
import {PRODUCT_TYPES,SIZES,isHiddenSize,type Collection} from '@/lib/config';

// Listing state lives in the URL (refresh, back/forward and shared links keep the filters):
// /designs?category=animals&niche=cats&search=&sort=&page=2&price_min=&price_max=&sizes=S,M&colors=Black,Navy&product=hoodie
// 30 fills every row with 2, 3 and 5 columns (with 4 the last row has 2)
export const PER_PAGE=30;
export const SIZE_ORDER=SIZES;
// [label, sort param]. "Featured" sends no sort (the API default, newest first).
export const SORTS:[string,string][]=[['Featured',''],['Best Selling','popular'],['Price: Low to High','price_asc'],['Price: High to Low','price_desc'],['Newest','newest']];
const MAX_VALUES=20;

export type ListingQuery={
  category:string; niche:string; search:string; product:string; sort:string; page:number;
  priceMin:string; priceMax:string; sizes:string[]; colors:string[];
};

type Params={get(name:string):string|null};

// "S, m,,M" -> ["S","M"]: trimmed, empty items dropped, duplicates removed (case-insensitive), at most 20
function list(raw:string|null,upper:boolean):string[]{
  const out:string[]=[];
  for(const part of (raw||'').split(',')){
    const v=part.trim().slice(0,80);
    if(!v)continue;
    const value=upper?v.toUpperCase():v;
    if(!out.some(x=>x.toLowerCase()===value.toLowerCase()))out.push(value);
  }
  return out.slice(0,MAX_VALUES);
}
// Non-negative number as a string, '' otherwise
const price=(raw:string|null)=>{const n=Number(raw);return raw&&raw.trim()!==''&&isFinite(n)&&n>=0?String(n):''};

export function readQuery(q:Params):ListingQuery{
  const sort=q.get('sort')||'';
  return {
    category:(q.get('category')||'').trim(),
    niche:(q.get('niche')||'').trim(),
    search:(q.get('search')||'').trim().slice(0,100),
    // ?product_type=tshirt|hoodie|longsleeve|sweatshirt; the older ?product= links still work
    product:(q.get('product_type')||q.get('product')||'').trim().toLowerCase(),
    sort:SORTS.some(s=>s[1]===sort)?sort:'',
    page:Math.max(1,parseInt(q.get('page')||'1',10)||1),
    priceMin:price(q.get('price_min')),
    priceMax:price(q.get('price_max')),
    sizes:list(q.get('sizes'),true).filter(s=>!isHiddenSize(s)), // ?sizes=XS is ignored
    colors:list(q.get('colors'),false),
  };
}

// Filters for GET /designs and GET /designs/facets (a chosen niche narrows the interest).
// A collection page adds its own fixed filters: its words (terms) and/or its interest.
export function apiFilters(x:ListingQuery,collection?:Collection|null):DesignParams{
  const productType=PRODUCT_TYPES.find(t=>t.slug===x.product)?.api||x.product;
  return {categorySlug:x.niche||x.category||collection?.category,search:x.search,productType,priceMin:x.priceMin,priceMax:x.priceMax,sizes:x.sizes,colors:x.colors,terms:collection?.terms};
}

// Number of sidebar filters in use (badge on the mobile "Filters" button)
export const activeFilterCount=(x:ListingQuery)=>(x.niche?1:0)+(x.priceMin||x.priceMax?1:0)+x.sizes.length+x.colors.length;

export const sameText=(a:string,b:string)=>a.toLowerCase()===b.toLowerCase();
// "sci-fi" -> "Sci Fi" (only used when the API does not know the slug)
export const titleCase=(slug:string)=>slug.replace(/[-_]+/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
