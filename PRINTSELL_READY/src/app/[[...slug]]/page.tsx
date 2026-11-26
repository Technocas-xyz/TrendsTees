import {Suspense} from 'react';
import {open,readdir} from 'fs/promises';
import path from 'path';
import {notFound} from 'next/navigation';
import Site from '@/components/Site';
import type {CategoryImage} from '@/components/listing/CategoryHero';
import type {Metadata} from 'next';
import {isKnownPath} from '@/lib/routes';
import {STORE_NAME} from '@/lib/config';

// Width and height from an image header: WebP (VP8 / VP8L / VP8X chunk) or PNG (IHDR chunk). null for anything else.
async function imageSize(file:string){
  const fh=await open(file,'r');
  try{
    const b=Buffer.alloc(32);
    await fh.read(b,0,32,0);
    if(b.toString('ascii',0,4)==='RIFF'&&b.toString('ascii',8,12)==='WEBP'){
      const kind=b.toString('ascii',12,16);
      if(kind==='VP8 ')return {width:b.readUInt16LE(26)&0x3fff,height:b.readUInt16LE(28)&0x3fff};
      if(kind==='VP8L'){const v=b.readUInt32LE(21);return {width:(v&0x3fff)+1,height:((v>>14)&0x3fff)+1}}
      if(kind==='VP8X')return {width:1+b.readUIntLE(24,3),height:1+b.readUIntLE(27,3)};
      return null;
    }
    if(b.readUInt32BE(0)!==0x89504e47||b.toString('ascii',12,16)!=='IHDR')return null;
    return {width:b.readUInt32BE(16),height:b.readUInt32BE(20)};
  }finally{await fh.close()}
}

// Listing banner images (public/categories/<slug>.webp, or <slug>.png when there is no .webp) with their size.
// Read on the server, so the browser never requests an image that does not exist. A missing folder just means "none".
async function categoryImages():Promise<CategoryImage[]>{
  const dir=path.join(process.cwd(),'public','categories');
  try{
    const files=(await readdir(dir)).filter(f=>/^[a-z0-9-]+\.(webp|png)$/i.test(f));
    // one file per slug; .webp wins over .png
    const pick=new Map<string,string>();
    for(const f of files){const slug=f.replace(/\.\w+$/,'').toLowerCase();if(!pick.has(slug)||/\.webp$/i.test(f))pick.set(slug,f)}
    const found=await Promise.all(Array.from(pick).map(async([slug,f])=>{
      const size=await imageSize(path.join(dir,f)).catch(()=>null);
      return size&&size.width>0&&size.height>0?{slug,src:'/categories/'+f,...size}:null;
    }));
    return found.filter((x):x is CategoryImage=>x!==null);
  }catch{return []}
}

// Unknown URLs get the "Page not found" title (not-found.tsx's own metadata is not used when notFound() is called here)
export async function generateMetadata({params}:{params:Promise<{slug?:string[]}>}):Promise<Metadata>{
  const {slug=[]}=await params;
  return isKnownPath('/'+slug.join('/'))?{}:{title:'Page not found | '+STORE_NAME,robots:{index:false}};
}

export default async function Route({params}:{params:Promise<{slug?:string[]}>}) {
  const {slug=[]}=await params;
  const route='/'+slug.join('/');
  // Unknown URL: real HTTP 404 with the PrintSteez "page not found" page (app/not-found.tsx)
  if(!isKnownPath(route))notFound();
  const images=slug[0]==='designs'&&slug.length===1?await categoryImages():[];
  return <Suspense><Site path={route} categoryImages={images}/></Suspense>;
}
