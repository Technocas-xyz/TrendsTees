import Link from 'next/link';
import {ChevronLeft,ChevronRight} from 'lucide-react';

// Page numbers to show: always the first and last page, the pages around the current one, '…' for the rest.
// 37 pages on page 1 -> 1 2 3 4 5 … 37
export function pageItems(page:number,pages:number):(number|'gap')[]{
  if(pages<=7)return Array.from({length:pages},(_,i)=>i+1);
  if(page<=4)return [1,2,3,4,5,'gap',pages];
  if(page>=pages-3)return [1,'gap',pages-4,pages-3,pages-2,pages-1,pages];
  return [1,'gap',page-1,page,page+1,'gap',pages];
}

// Real links (so pages can be opened in a new tab); onNavigate scrolls back to the results
export function Pagination({page,pages,href,onNavigate}:{page:number;pages:number;href:(n:number)=>string;onNavigate:()=>void}){
  if(pages<=1)return null;
  const arrow=(n:number,label:string,icon:React.ReactNode)=>n<1||n>pages
    ?<span className="pl-pagelink arrow" aria-disabled="true">{icon}</span>
    :<Link className="pl-pagelink arrow" href={href(n)} scroll={false} onClick={onNavigate} aria-label={label}>{icon}</Link>;
  return <nav className="pl-pagination" aria-label="Pages">
    {arrow(page-1,'Previous page',<ChevronLeft size={16}/>)}
    {pageItems(page,pages).map((n,i)=>n==='gap'
      ?<span key={'gap'+i} className="pl-pagelink gap" aria-hidden="true">…</span>
      :<Link key={n} className={'pl-pagelink'+(n===page?' current':'')} href={href(n)} scroll={false} onClick={onNavigate} aria-label={'Page '+n} aria-current={n===page?'page':undefined}>{n}</Link>)}
    {arrow(page+1,'Next page',<ChevronRight size={16}/>)}
  </nav>;
}
