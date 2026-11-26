'use client';
import {useState} from 'react';
import Link from 'next/link';
import {ArrowRight,CheckCircle2} from 'lucide-react';
import {getShippingMethods} from '@/lib/api';
import {FREE_SHIPPING_LABEL,RETURN_DAYS,SHIPS_TO,STORE_NAME} from '@/lib/config';
import type {InfoPageSlug} from '@/lib/routes';
import {useApi} from '@/components/home/useApi';

const UPDATED='November 2026';
const money=(n:number)=>'$'+n.toFixed(2);

// Live shipping options from GET /shipping-methods, so this page always matches checkout
function ShippingTable(){
  const a=useApi(getShippingMethods,'shipping-methods');
  if(a.error)return <p className="pg-muted">Shipping options are shown at checkout. <button type="button" className="pg-link-button" onClick={a.retry}>Try loading them again</button></p>;
  if(!a.data)return <p className="pg-muted">Loading shipping options…</p>;
  return <table className="pg-table">
    <thead><tr><th scope="col">Option</th><th scope="col">Delivery time</th><th scope="col">Price</th></tr></thead>
    <tbody>{a.data.map(m=><tr key={m.code}><td>{m.name}</td><td>{m.min_days}–{m.max_days} business days</td><td>{money(m.price)}{m.free_over!==null&&<> · <b>free over {money(m.free_over)}</b></>}</td></tr>)}</tbody>
  </table>;
}

const EMAIL=/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
// Contact form: checked in the browser; there is no backend for it yet, so nothing is sent or saved
function ContactForm(){
  const [form,setForm]=useState({name:'',email:'',message:''});
  const [errors,setErrors]=useState<Partial<Record<keyof typeof form,string>>>({});
  const [sent,setSent]=useState(false);
  const set=(k:keyof typeof form,v:string)=>{setForm(f=>({...f,[k]:v}));setErrors(e=>({...e,[k]:undefined}))};
  function submit(e:React.FormEvent){
    e.preventDefault();
    const next:typeof errors={};
    if(!form.name.trim())next.name='Please enter your name.';
    if(!EMAIL.test(form.email.trim()))next.email='Please enter a valid email address.';
    if(form.message.trim().length<10)next.message='Please write a short message (at least 10 characters).';
    setErrors(next);
    if(Object.keys(next).length===0)setSent(true);
  }
  if(sent)return <div className="pg-success" role="status"><CheckCircle2 aria-hidden="true"/><div><b>Thanks, we will reply soon.</b><p>We usually answer within 1–2 business days.</p></div></div>;
  const field=(k:keyof typeof form,label:string,input:React.ReactNode)=><label className="pg-field">{label}{input}{errors[k]&&<small id={'pg-err-'+k} role="alert">{errors[k]}</small>}</label>;
  const common=(k:keyof typeof form)=>({value:form[k],onChange:(e:React.ChangeEvent<HTMLInputElement|HTMLTextAreaElement>)=>set(k,e.target.value),'aria-invalid':!!errors[k],'aria-describedby':errors[k]?'pg-err-'+k:undefined});
  return <form className="pg-form" onSubmit={submit} noValidate>
    {field('name','Your name',<input {...common('name')} autoComplete="name" maxLength={120}/>)}
    {field('email','Email',<input {...common('email')} type="email" autoComplete="email" maxLength={254}/>)}
    {field('message','Message',<textarea {...common('message')} rows={6} maxLength={3000} placeholder="Order number (if you have one) and how we can help"/>)}
    <button type="submit" className="ps-btn ps-btn-purple">Send message</button>
  </form>;
}

type Page={title:string;lead:string;body:React.ReactNode};
const PAGES:Record<InfoPageSlug,Page>={
  about:{title:'About '+STORE_NAME,lead:'Original graphic tees, designed in-house and printed just for you.',body:<>
    <h2>One in-house design team</h2>
    <p>Every design on {STORE_NAME} is made by our own design team. We don&apos;t run a marketplace and we don&apos;t resell other people&apos;s work: if you see it here, we drew it.</p>
    <h2>Printed to order</h2>
    <p>Nothing sits in a warehouse. When you order, we print your design on a fresh shirt or hoodie and ship it to you. That means less waste and a print that&apos;s new when it reaches you.</p>
    <h2>Where we ship</h2>
    <p>We ship to {SHIPS_TO} for now, with free shipping on orders over {FREE_SHIPPING_LABEL}. See <Link href="/shipping">Shipping &amp; Delivery</Link>.</p>
    <p><Link className="ps-btn ps-btn-purple" href="/designs">Browse our designs <ArrowRight size={16}/></Link></p>
  </>},
  faq:{title:'Frequently Asked Questions',lead:'Quick answers about orders, shipping and returns.',body:<dl className="pg-faq">
    <dt>Who designs your tees?</dt><dd>Our own in-house design team. Every design is original to {STORE_NAME}.</dd>
    <dt>Do I need an account to order?</dt><dd>No. You can check out as a guest. With an <Link href="/signup">account</Link> you can see all your orders in one place.</dd>
    <dt>How long until my order arrives?</dt><dd>Each item is printed to order, which usually takes 2–5 business days. Delivery time then depends on the shipping option you choose; see <Link href="/shipping">Shipping &amp; Delivery</Link>.</dd>
    <dt>Is shipping free?</dt><dd>Yes, Standard Shipping is free on orders over {FREE_SHIPPING_LABEL}.</dd>
    <dt>Do you ship outside the US?</dt><dd>Not yet. We ship to {SHIPS_TO} only for now.</dd>
    <dt>Can I return an item?</dt><dd>If your item arrives misprinted or defective, tell us within {RETURN_DAYS} days and we&apos;ll replace or refund it. Because everything is printed to order, we can&apos;t take back items for size or change of mind. See <Link href="/returns">Returns &amp; Exchanges</Link>.</dd>
    <dt>How do I track my order?</dt><dd>Use <Link href="/track-order">Order Tracking</Link> with your order number and the email you used at checkout.</dd>
    <dt>How do I save designs for later?</dt><dd>Tap the heart on any design. Your <Link href="/wishlist">wishlist</Link> is kept on your device.</dd>
    <dt>Still have a question?</dt><dd><Link href="/contact">Contact us</Link> and we&apos;ll get back to you.</dd>
  </dl>},
  shipping:{title:'Shipping & Delivery',lead:`Free US shipping on orders over ${FREE_SHIPPING_LABEL}.`,body:<>
    <h2>Where we ship</h2>
    <p>We currently ship to {SHIPS_TO} only.</p>
    <h2>Shipping options</h2>
    <ShippingTable/>
    <h2>Production time</h2>
    <p>Every item is printed when you order it. Printing usually takes 2–5 business days, then your order ships with the option you chose. The estimated delivery date is shown before you place your order.</p>
    <h2>Tracking</h2>
    <p>Follow your order with <Link href="/track-order">Order Tracking</Link>, using your order number and the email you used at checkout.</p>
  </>},
  returns:{title:'Returns & Exchanges',lead:`${RETURN_DAYS}-day returns for misprints and defects.`,body:<>
    <h2>Misprinted or defective items</h2>
    <p>If your item arrives misprinted, damaged or defective, let us know within {RETURN_DAYS} days of delivery. We&apos;ll send a replacement or refund you, whichever you prefer, at no cost to you.</p>
    <h2>How to start a return</h2>
    <ol><li>Write to us through the <Link href="/contact">contact form</Link>.</li><li>Include your order number and a photo of the problem.</li><li>We&apos;ll reply with the next steps, usually within 1–2 business days.</li></ol>
    <h2>Size and change of mind</h2>
    <p>Because every item is printed just for you, we can&apos;t accept returns or exchanges for the wrong size or a change of mind. Please check your size before ordering.</p>
  </>},
  contact:{title:'Contact Us',lead:'Questions about an order or a design? Send us a message.',body:<>
    <ContactForm/>
    <p className="pg-muted">Looking for an order? <Link href="/track-order">Track it here</Link>. Many answers are also in our <Link href="/faq">FAQ</Link>.</p>
  </>},
  privacy:{title:'Privacy Policy',lead:`How ${STORE_NAME} uses your information. Last updated ${UPDATED}.`,body:<>
    <h2>What we collect</h2>
    <ul>
      <li><b>Account:</b> your name, email address and password (stored only in a protected, hashed form) if you create an account.</li>
      <li><b>Orders:</b> your contact email, phone number and shipping address, and what you ordered.</li>
      <li><b>On your device:</b> your cart, wishlist and recently viewed designs are kept in your browser&apos;s storage. See our <Link href="/cookies">Cookie Policy</Link>.</li>
    </ul>
    <h2>How we use it</h2>
    <p>We use your information to make and ship your order, to let you track it, to run your account and to answer your messages. We don&apos;t sell your personal information.</p>
    <h2>Who we share it with</h2>
    <p>Only with the services needed to print and deliver your order, such as the shipping carrier, and only the details they need for that.</p>
    <h2>Your choices</h2>
    <p>You can ask us to show, correct or delete your personal information at any time through the <Link href="/contact">contact form</Link>.</p>
  </>},
  terms:{title:'Terms of Service',lead:`The rules for using ${STORE_NAME}. Last updated ${UPDATED}.`,body:<>
    <h2>Using this site</h2>
    <p>By using {STORE_NAME} or placing an order, you agree to these terms. Please use the site lawfully and don&apos;t try to disrupt it.</p>
    <h2>Our designs</h2>
    <p>All designs on this site are created by the {STORE_NAME} in-house team and are protected by copyright. Buying a product gives you the product, not the right to copy or resell the design.</p>
    <h2>Orders and prices</h2>
    <p>Prices are shown in US dollars. Your order total, including shipping and tax, is shown before you place the order. We may cancel and fully refund an order if a product can&apos;t be made.</p>
    <h2>Shipping and returns</h2>
    <p>We ship to {SHIPS_TO}. Delivery is described on <Link href="/shipping">Shipping &amp; Delivery</Link> and returns on <Link href="/returns">Returns &amp; Exchanges</Link>.</p>
    <h2>Questions</h2>
    <p>Reach us through the <Link href="/contact">contact form</Link>.</p>
  </>},
  cookies:{title:'Cookie Policy',lead:`What ${STORE_NAME} stores in your browser. Last updated ${UPDATED}.`,body:<>
    <h2>Cookies</h2>
    <p>We use one cookie: a sign-in cookie that keeps you logged in for up to 7 days after you sign in to your account. It is removed when you sign out.</p>
    <h2>Browser storage</h2>
    <p>To make the shop work, we keep a few things in your browser&apos;s storage:</p>
    <ul><li>your cart (so it&apos;s still there when you come back),</li><li>your wishlist,</li><li>designs you viewed recently,</li><li>checkout details while you complete an order (cleared when you close the tab).</li></ul>
    <h2>No tracking</h2>
    <p>We don&apos;t use advertising or analytics cookies. You can clear cookies and site data at any time in your browser settings; you&apos;ll be signed out and your cart and wishlist will be emptied on that device.</p>
  </>},
};

export function InfoPage({slug}:{slug:InfoPageSlug}){
  const p=PAGES[slug];
  return <main className="pg-page">
    <div className="pg-wrap pg-narrow">
      <nav className="pg-crumb" aria-label="Breadcrumb"><Link href="/">Home</Link><span aria-hidden="true">›</span><span>{p.title}</span></nav>
      <header className="pg-head"><h1>{p.title}</h1><p className="pg-lead">{p.lead}</p></header>
      <article className="pg-card pg-prose">{p.body}</article>
    </div>
  </main>;
}
