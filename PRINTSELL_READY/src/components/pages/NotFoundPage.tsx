'use client';
import {useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {ArrowRight,Search} from 'lucide-react';

// "Page not found" in the PrintSteez style: search box, "Browse all designs" and a few popular links
export function NotFoundPage(){
  const router=useRouter();
  const [q,setQ]=useState('');
  return <main className="pg-page">
    <div className="pg-wrap pg-404">
      <p className="pg-404-code" aria-hidden="true">404</p>
      <h1>We couldn&apos;t find that page</h1>
      <p className="pg-lead">The link may be old, or the page has moved. Try a search, or browse our original graphic tees.</p>
      <form className="pg-404-search" role="search" onSubmit={e=>{e.preventDefault();router.push('/designs'+(q.trim()?'?search='+encodeURIComponent(q.trim()):''))}}>
        <input aria-label="Search designs" placeholder="Search graphic tees, designs..." value={q} onChange={e=>setQ(e.target.value)} maxLength={100}/>
        <button type="submit" aria-label="Search"><Search size={19}/></button>
      </form>
      <Link className="ps-btn ps-btn-purple pg-404-browse" href="/designs">Browse all designs <ArrowRight size={16}/></Link>
      <nav className="pg-404-links" aria-label="Popular pages">
        <Link href="/designs?sort=newest">New Arrivals</Link>
        <Link href="/designs?sort=popular">Bestsellers</Link>
        <Link href="/#collections">Collections</Link>
        <Link href="/track-order">Track an order</Link>
        <Link href="/contact">Contact us</Link>
      </nav>
    </div>
  </main>;
}
