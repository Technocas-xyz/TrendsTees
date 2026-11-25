'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {readRecent,type RecentDesign} from './recent';

const SHOW=6;

// The last 6 designs this visitor opened (localStorage "ps-recent"), as a row of small cards.
// Read after mount, so the server-rendered HTML and the first browser render match. Hidden when there are none.
export function RecentlyViewed(){
  const [items,setItems]=useState<RecentDesign[]>([]);
  useEffect(()=>{setItems(readRecent().slice(0,SHOW))},[]);
  if(items.length===0)return null;
  return <section className="pl-recent" aria-labelledby="pl-recent-title">
    <div className="pl-recent-head"><h2 id="pl-recent-title">Recently Viewed</h2><p>Pick up where you left off.</p></div>
    <ul className="pl-recent-list">{items.map((d,i)=>{
      const tee=i%2===1?'white':'black';
      return <li key={d.code}><Link href={'/designs/'+encodeURIComponent(d.code)} className="pl-recent-item">
        <span className="pl-recent-pic"><span className={'ps-tee '+tee}>
          <img className="ps-tee-img" src={'/mockups/tee-'+tee+'.png'} alt="" loading="lazy"/>
          {d.image&&<img className="ps-tee-design" src={d.image} alt="" loading="lazy"/>}
        </span></span>
        <span className="pl-recent-text"><b title={d.title}>{d.title}</b>{d.price>0&&<span className="pl-price">From ${d.price.toFixed(2)}</span>}</span>
      </Link></li>;
    })}</ul>
  </section>;
}
