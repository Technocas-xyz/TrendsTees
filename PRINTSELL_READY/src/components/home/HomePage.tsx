'use client';
import {getInterests} from '@/lib/api';
import {Hero} from './Hero';
import {Collections,DesignRow,InterestsSection,Newsletter,ProductTypes,WhyShop} from './HomeSections';
import {useApi} from './useApi';

export function HomePage({onWish,wishlist}:{onWish:(id:string)=>void;wishlist:string[]}){
  const interests=useApi(getInterests,'interests');
  return <main className="ps-home">
    <Hero/>
    <div className="ps-wrap">
      <InterestsSection interests={interests.data} error={interests.error} retry={interests.retry}/>
      <DesignRow id="ps-trending-title" title="Trending Designs" flame subtitle="Discover what's hot right now." href="/designs?sort=popular" linkText="View Trending" params={{sort:'popular',limit:6}} onWish={onWish} wishlist={wishlist}/>
      {/* Only designs with at least 1 order; the row is hidden when there are none */}
      <DesignRow id="ps-best-title" title="Bestsellers" subtitle="Fan favorites that never go out of style." href="/designs?sort=popular" linkText="View Bestsellers" badge="Bestseller" hideWhenEmpty params={{sort:'popular',minOrders:1,limit:6}} onWish={onWish} wishlist={wishlist}/>
      <ProductTypes/>
      <Collections/>
      <DesignRow id="ps-new-title" title="New Arrivals" subtitle="The latest designs from the PrintSteez team." href="/designs?sort=newest" linkText="View New Arrivals" badge="New" params={{sort:'newest',limit:6}} onWish={onWish} wishlist={wishlist}/>
      <WhyShop/>
    </div>
    <Newsletter/>
  </main>;
}
