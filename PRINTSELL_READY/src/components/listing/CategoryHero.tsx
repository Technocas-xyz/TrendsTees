import {Palette,PenTool,Shirt} from 'lucide-react';

// A text-free banner background in public/categories/<slug>.png (art on the right). The text is drawn with code on the left.
export type CategoryImage={slug:string;src:string;width:number;height:number};

// Collection page banner: public/collections/<slug>.png at its own proportions (its title is drawn in, so it is never
// cropped). These images are about 715px wide, so they are not stretched past ~780px. h1 + description for screen readers/SEO.
export function CollectionBanner({name,description,image}:{name:string;description:string;image:string}){
  return <section className="pl-collection-banner" aria-labelledby="pl-hero-title">
    <h1 id="pl-hero-title" className="ps-sr-only">{name}</h1>
    <p className="ps-sr-only">{description}</p>
    <img src={image} alt="" fetchPriority="high"/>
  </section>;
}

// Category banner rendered in code, text on the left. With a banner image, the image is the background (cover, art on the
// right) under a purple gradient for readability. Without one: the interest's cover design faded into the purple on the
// right, plus orange brush strokes.
export function CategoryHero({label,title,description,image,cover,loading}:{label:string;title:string;description:string;image:CategoryImage|null;cover:string|null;loading?:boolean}){
  return <section className={'pl-hero'+(image?' has-img':'')} aria-labelledby="pl-hero-title">
    <div className="pl-hero-art" aria-hidden="true">
      {image?<><img className="pl-hero-bg" src={image.src} alt="" width={image.width} height={image.height} fetchPriority="high"/><span className="pl-hero-shade"/></>:<>
      {cover&&<img className="pl-hero-cover" src={cover} alt=""/>}
      <svg className="pl-hero-brush" viewBox="0 0 400 200" preserveAspectRatio="none">
        <path d="M250 214 L412 40" stroke="#F97316" strokeWidth="26" strokeLinecap="round"/>
        <path d="M318 222 L420 118" stroke="#FB923C" strokeWidth="13" strokeLinecap="round"/>
        <path d="M196 200 L352 18" stroke="#F97316" strokeWidth="5" strokeLinecap="round" opacity=".8"/>
        <path d="M160 168 L250 70" stroke="#FDBA74" strokeWidth="2.5" strokeLinecap="round" opacity=".7"/>
      </svg></>}
    </div>
    <div className="pl-hero-inner">
      <p className="pl-hero-label">{label}</p>
      <h1 id="pl-hero-title">{loading?<span className="pl-hero-skel"><span className="ps-sr-only">Loading</span></span>:title}</h1>
      {description&&<p className="pl-hero-text">{description}</p>}
      <ul className="pl-hero-trust">
        <li><PenTool aria-hidden="true"/>Original Designs</li>
        <li><Palette aria-hidden="true"/>Designed In-House</li>
        <li><Shirt aria-hidden="true"/>Premium Quality Tees</li>
      </ul>
    </div>
  </section>;
}
