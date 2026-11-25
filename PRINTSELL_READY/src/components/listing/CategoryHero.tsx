import {Palette,PenTool,Shirt} from 'lucide-react';

// A ready-made banner in public/categories/<slug>.png. Its title, text and trust line are drawn in the image.
export type CategoryImage={slug:string;src:string;width:number;height:number};

// Image banner: only the image, full width, no text drawn on top. The h1 is kept for SEO and screen readers, visually hidden.
// width/height make the browser reserve the right height before the image loads.
function ImageBanner({title,image}:{title:string;image:CategoryImage}){
  return <section className="pl-hero-banner" aria-labelledby="pl-hero-title">
    <h1 id="pl-hero-title" className="ps-sr-only">{title}</h1>
    <img src={image.src} alt="" width={image.width} height={image.height} fetchPriority="high"/>
  </section>;
}

// Collection page banner: public/collections/<slug>.png at its own proportions (its title is drawn in, so it is never
// cropped). These images are about 715px wide, so they are not stretched past ~780px. h1 + description for screen readers/SEO.
export function CollectionBanner({name,description,image}:{name:string;description:string;image:string}){
  return <section className="pl-collection-banner" aria-labelledby="pl-hero-title">
    <h1 id="pl-hero-title" className="ps-sr-only">{name}</h1>
    <p className="ps-sr-only">{description}</p>
    <img src={image} alt="" fetchPriority="high"/>
  </section>;
}

// Purple category banner rendered in code (no banner image for this category): text on the left,
// the interest's cover design faded into the purple on the right, plus orange brush strokes.
export function CategoryHero({label,title,description,image,cover,loading}:{label:string;title:string;description:string;image:CategoryImage|null;cover:string|null;loading?:boolean}){
  if(image)return <ImageBanner title={title} image={image}/>;
  return <section className="pl-hero" aria-labelledby="pl-hero-title">
    <div className="pl-hero-art" aria-hidden="true">
      {cover&&<img className="pl-hero-cover" src={cover} alt=""/>}
      <svg className="pl-hero-brush" viewBox="0 0 400 200" preserveAspectRatio="none">
        <path d="M250 214 L412 40" stroke="#F97316" strokeWidth="26" strokeLinecap="round"/>
        <path d="M318 222 L420 118" stroke="#FB923C" strokeWidth="13" strokeLinecap="round"/>
        <path d="M196 200 L352 18" stroke="#F97316" strokeWidth="5" strokeLinecap="round" opacity=".8"/>
        <path d="M160 168 L250 70" stroke="#FDBA74" strokeWidth="2.5" strokeLinecap="round" opacity=".7"/>
      </svg>
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
