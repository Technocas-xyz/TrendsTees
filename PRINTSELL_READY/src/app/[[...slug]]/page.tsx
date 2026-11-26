import {Suspense} from 'react';
import {open,readdir} from 'fs/promises';
import path from 'path';
import {notFound} from 'next/navigation';
import Site from '@/components/Site';
import type {CategoryImage} from '@/components/listing/CategoryHero';
import type {Metadata} from 'next';
import {isKnownPath} from '@/lib/routes';
import {STORE_NAME} from '@/lib/config';

// Width and height from a PNG header (IHDR chunk, bytes 16-23). null if the file is not a PNG.
async function pngSize(file:string){
  const fh=await open(file,'r');
  try{
    const b=Buffer.alloc(24);
    await fh.read(b,0,24,0);
    if(b.readUInt32BE(0)!==0x89504e47||b.toString('ascii',12,16)!=='IHDR')return null;
    return {width:b.readUInt32BE(16),height:b.readUInt32BE(20)};
  }finally{await fh.close()}
}

// Listing banner images (public/categories/<slug>.png) with their size. Read on the server, so the
// browser never requests an image that does not exist. A missing folder just means "none".
async function categoryImages():Promise<CategoryImage[]>{
  const dir=path.join(process.cwd(),'public','categories');
  try{
    const files=(await readdir(dir)).filter(f=>/^[a-z0-9-]+\.png$/i.test(f));
    const found=await Promise.all(files.map(async f=>{
      const size=await pngSize(path.join(dir,f)).catch(()=>null);
      return size&&size.width>0&&size.height>0?{slug:f.slice(0,-4).toLowerCase(),src:'/categories/'+f,...size}:null;
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
