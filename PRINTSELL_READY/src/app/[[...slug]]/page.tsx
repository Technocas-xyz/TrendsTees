import {Suspense} from 'react';
import {open,readdir} from 'fs/promises';
import path from 'path';
import Site from '@/components/Site';
import type {CategoryImage} from '@/components/listing/CategoryHero';

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

export default async function Route({params}:{params:Promise<{slug?:string[]}>}) {
  const {slug=[]}=await params;
  const images=slug[0]==='designs'&&slug.length===1?await categoryImages():[];
  return <Suspense><Site path={'/'+slug.join('/')} categoryImages={images}/></Suspense>;
}
