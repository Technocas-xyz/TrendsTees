import Link from 'next/link';
import {COPYRIGHT_YEAR,SHOW_PAYMENT_ICONS,STORE_NAME} from '@/lib/config';
import {Logo} from './Logo';

// "#" = page does not exist yet
const COLUMNS:{title:string;links:[string,string][]}[]=[
  {title:'Shop',links:[['All Products','/designs'],['Graphic Tees','/designs?product=tshirt'],['Hoodies','/designs?product=hoodie'],['New Arrivals','/designs?sort=newest'],['Bestsellers','/designs?sort=popular'],['Sale','/designs?sort=price_asc']]},
  {title:'Explore',links:[['Collections','/#collections'],['Trending','/designs?sort=popular'],['About '+STORE_NAME,'#']]},
  {title:'Help',links:[['FAQs','#'],['Shipping & Delivery','#'],['Returns & Exchanges','#'],['Order Tracking','/track-order'],['Contact Us','#']]},
  {title:'Account',links:[['Sign In','/login'],['Create Account','/signup'],['Wishlist','/wishlist'],['Your Orders','/account/orders']]},
];
const POLICIES=['Privacy Policy','Terms of Service','Cookie Policy'];

const svg={width:20,height:20,viewBox:'0 0 24 24','aria-hidden':true};
const line={fill:'none',stroke:'currentColor',strokeWidth:2,strokeLinecap:'round' as const,strokeLinejoin:'round' as const};
const SOCIALS:[string,React.ReactNode][]=[
  ['Instagram',<svg key="i" {...svg} {...line}><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".8" fill="currentColor"/></svg>],
  ['TikTok',<svg key="t" {...svg} fill="currentColor"><path d="M16.6 2h-3.4v13.3a2.9 2.9 0 1 1-2.9-2.9c.3 0 .6 0 .9.1V9.1a6.3 6.3 0 1 0 5.4 6.2V8.6a7.9 7.9 0 0 0 4.4 1.4V6.6a4.4 4.4 0 0 1-4.4-4.6z"/></svg>],
  ['YouTube',<svg key="y" {...svg} fill="currentColor"><path fillRule="evenodd" d="M22 8.2a3 3 0 0 0-2.1-2.1C18 5.6 12 5.6 12 5.6s-6 0-7.9.5A3 3 0 0 0 2 8.2 31 31 0 0 0 1.6 12 31 31 0 0 0 2 15.8a3 3 0 0 0 2.1 2.1c1.9.5 7.9.5 7.9.5s6 0 7.9-.5a3 3 0 0 0 2.1-2.1c.4-1.2.4-3.8.4-3.8s0-2.6-.4-3.8zM10 15.1V8.9l5.2 3.1z"/></svg>],
  ['X',<svg key="x" {...svg} fill="currentColor"><path d="M17.8 3h3.1l-6.8 7.8 8 10.2h-6.3l-4.9-6.4L5.3 21H2.2l7.3-8.3L1.9 3h6.4l4.4 5.9zm-1.1 16.2h1.7L7.4 4.7H5.6z"/></svg>],
  ['Facebook',<svg key="f" {...svg} {...line}><circle cx="12" cy="12" r="9.5"/><path d="M15 8h-1.6c-1.2 0-1.9.7-1.9 1.9V21.5M9 12.5h5.5"/></svg>],
];

function Pay({label,bg='#fff',fg='#111827',size=11}:{label:string;bg?:string;fg?:string;size?:number}){
  return <svg className="ps-pay" viewBox="0 0 48 30" role="img" aria-label={label}><rect width="48" height="30" rx="4" fill={bg}/><text x="24" y="19" textAnchor="middle" fontSize={size} fontWeight="800" fontFamily="Arial,sans-serif" fill={fg}>{label}</text></svg>;
}

export function SiteFooter(){
  return <footer className="ps-footer">
    <div className="ps-footer-inner">
      <div className="ps-footer-brand">
        <Logo light/>
        <p>Original graphic tees.<br/>Designed in-house.</p>
        <div className="ps-social">{SOCIALS.map(([name,icon])=><a key={name} href="#" aria-label={name}>{icon}</a>)}</div>
      </div>
      {COLUMNS.map(c=><nav key={c.title} className="ps-footer-col" aria-label={c.title}>
        <h3>{c.title}</h3>
        {c.links.map(([label,href])=>href==='#'?<a key={label} href="#">{label}</a>:<Link key={label} href={href}>{label}</Link>)}
      </nav>)}
    </div>
    <div className="ps-footer-bottom">
      <span>© {COPYRIGHT_YEAR} {STORE_NAME}. All rights reserved.</span>
      <div className="ps-policies">{POLICIES.map((p,i)=><span key={p}>{i>0&&<span className="ps-policy-sep" aria-hidden="true">|</span>}<a href="#">{p}</a></span>)}</div>
      {SHOW_PAYMENT_ICONS&&<div className="ps-pays" aria-label="Accepted payment methods">
        <Pay label="VISA" fg="#1a1f71" size={13}/><Pay label="MC" fg="#eb001b"/><Pay label="AMEX" bg="#2e77bc" fg="#fff" size={10}/><Pay label="PayPal" fg="#003087" size={10}/><Pay label="Pay" bg="#000" fg="#fff" size={12}/>
      </div>}
    </div>
  </footer>;
}
