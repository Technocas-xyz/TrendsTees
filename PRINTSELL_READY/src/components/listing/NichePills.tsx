import Link from 'next/link';
import {imageUrl,type ApiNiche} from '@/lib/api';
import {InterestIcon} from '@/components/home/interestIcons';
import {sameText} from './query';

// Small round image: the newest design of the niche (or of the interest for "All"); the icon when there is none
function Thumb({cover,iconSlug}:{cover:string|null|undefined;iconSlug:string}){
  const src=imageUrl(cover);
  return src?<img className="pl-pill-img" src={src} alt="" loading="lazy"/>:<InterestIcon slug={iconSlug} size={20}/>;
}

// "All <Interest>" + one pill per niche, each with its small image. Active = filled purple. Hidden when the interest has no niches.
export function NichePills({interestName,interestSlug,interestCover,niches,active,href}:{interestName:string;interestSlug:string;interestCover?:string|null;niches:ApiNiche[];active:string;href:(niche:string)=>string}){
  if(niches.length===0)return null;
  const pill=(slug:string,label:string,cover:string|null|undefined,iconSlug:string)=>{
    const on=slug?sameText(slug,active):!active;
    return <Link key={slug||'all'} href={href(slug)} scroll={false} className={'pl-pill'+(on?' active':'')} aria-current={on?'true':undefined}>
      <Thumb cover={cover} iconSlug={iconSlug}/><span>{label}</span>
    </Link>;
  };
  return <nav className="pl-pills" aria-label={interestName+' niches'}>
    {pill('','All '+interestName,interestCover,interestSlug)}
    {niches.map(n=>pill(n.category_slug,n.category_name,n.cover_url,n.category_slug))}
  </nav>;
}
