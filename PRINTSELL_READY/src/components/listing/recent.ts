import type {Design} from '@/components/data';

// "Recently Viewed": the last designs this browser opened, newest first, in localStorage.
// Saved when a design detail page opens. localStorage can be missing, full or edited by hand,
// so every access is wrapped and every entry is checked before it is used.
export const RECENT_KEY='ps-recent';
const KEEP=12;

export type RecentDesign={code:string;title:string;image:string|null;price:number};

// Only http(s) URLs or site paths are accepted as image sources
const safeImage=(x:unknown)=>typeof x==='string'&&/^(https?:\/\/|\/)/i.test(x)?x:null;

function valid(x:unknown):RecentDesign|null{
  if(!x||typeof x!=='object')return null;
  const r=x as Record<string,unknown>;
  if(typeof r.code!=='string'||!r.code||r.code.length>64||typeof r.title!=='string')return null;
  const price=typeof r.price==='number'&&isFinite(r.price)&&r.price>=0?r.price:0;
  return {code:r.code,title:r.title.slice(0,200),image:safeImage(r.image),price};
}

export function readRecent():RecentDesign[]{
  try{
    const list=JSON.parse(localStorage.getItem(RECENT_KEY)||'[]');
    return Array.isArray(list)?list.map(valid).filter((x):x is RecentDesign=>x!==null):[];
  }catch{return []}
}

export function saveRecent(d:Design){
  try{
    const entry:RecentDesign={code:d.id,title:d.name,image:d.image||null,price:d.price};
    const next=[entry,...readRecent().filter(x=>x.code!==d.id)].slice(0,KEEP);
    localStorage.setItem(RECENT_KEY,JSON.stringify(next));
  }catch{}
}
