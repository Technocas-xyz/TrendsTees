'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import './gallery.css';
type Item={id:string;title:string;category:string;createdAt:string;imageUrl:string};
export default function NewDesignsPage(){
  const [items,setItems]=useState<Item[]>([]),[error,setError]=useState(''),[loading,setLoading]=useState(true);
  useEffect(()=>{let live=true;fetch('/api/design-images',{cache:'no-store'}).then(x=>{if(!x.ok)throw Error('Unable to load images');return x.json()}).then(j=>{if(live)setItems(j.images||[])}).catch(()=>{if(live)setError('Images could not be loaded.')}).finally(()=>{if(live)setLoading(false)});return()=>{live=false}},[]);
  return <main className="auto-gallery"><header><Link href="/">← PRINT<span>&amp;SELL</span></Link><h1>New Designs</h1><p>Fresh artwork uploaded to PRINT&amp;SELL. New images appear automatically after successful uploads.</p></header>{loading?<p>Loading designs…</p>:error?<p role="alert">{error}</p>:items.length===0?<section className="auto-empty"><h2>No uploaded designs yet</h2><p>Once the n8n automation runs, published images will appear here.</p><Link href="/">Back to store</Link></section>:<><p className="auto-count">{items.length} designs available</p><section className="auto-grid">{items.map(x=><article key={x.id}><div className="auto-art"><img src={x.imageUrl} alt={x.title} loading="lazy"/></div><div className="auto-info"><strong>{x.title}</strong><small>{x.category}</small><span>Uploaded {new Date(x.createdAt).toLocaleDateString()}</span></div></article>)}</section></>}</main>
}
