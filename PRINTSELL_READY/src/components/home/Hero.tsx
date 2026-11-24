import Link from 'next/link';
import {ArrowRight,PenTool,ShieldCheck,ShoppingCart} from 'lucide-react';

// /hero.png is 2170x725 and has the heading, buttons and trust line drawn in it.
// Desktop: the full banner with two invisible links on top of the drawn buttons (percent positions, so they scale with the image).
// Mobile: the image cropped to its right part, then the same content as real HTML.
const HIT_SHOP={left:'4.98%',top:'65.2%',width:'17.9%',height:'11.9%'};
const HIT_COLLECTIONS={left:'24.2%',top:'65.2%',width:'15.7%',height:'11.9%'};

export function Hero(){
  return <section className="ps-hero" aria-labelledby="ps-hero-title">
    <h1 id="ps-hero-title" className="ps-sr-only">Graphic Tees With Real Style</h1>

    <div className="ps-hero-desktop">
      <img src="/hero.png" alt="Graphic tees with real style. Discover original graphic tees, designed in-house and printed just for you." width={2170} height={725} fetchPriority="high"/>
      <Link href="/designs" className="ps-hero-hit" style={HIT_SHOP} aria-label="Shop Graphic Tees"/>
      <Link href="/#collections" className="ps-hero-hit" style={HIT_COLLECTIONS} aria-label="View Collections"/>
    </div>

    <div className="ps-hero-mobile">
      <img src="/hero.png" alt="" width={2170} height={725}/>
      <div className="ps-hero-copy">
        <p className="ps-hero-eyebrow">Original graphic tees</p>
        <p className="ps-hero-heading" aria-hidden="true">Graphic Tees With <em>Real Style</em></p>
        <p className="ps-hero-sub">Discover original graphic tees, designed in-house and printed just for you.</p>
        <div className="ps-hero-buttons">
          <Link href="/designs" className="ps-btn ps-btn-orange">Shop Graphic Tees <ArrowRight size={16}/></Link>
          <Link href="/#collections" className="ps-btn ps-btn-ghost">View Collections</Link>
        </div>
        <ul className="ps-hero-trust">
          <li><PenTool size={15}/> Original Designs</li>
          <li><ShieldCheck size={15}/> High-Quality Tees</li>
          <li><ShoppingCart size={15}/> Made to Order</li>
        </ul>
      </div>
    </div>
  </section>;
}
