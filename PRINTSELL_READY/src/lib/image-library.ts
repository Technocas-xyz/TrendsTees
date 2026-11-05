import 'server-only';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';

export type UploadedDesign = { id: string; title: string; category: string; filename: string; sha256: string; bytes: number; createdAt: string; imageUrl: string };
const base = path.join(process.cwd(), 'data', 'design-library');
const imagesDir = path.join(base, 'images');
const indexFile = path.join(base, 'index.json');
function setup() {fs.mkdirSync(imagesDir,{recursive:true}); if(!fs.existsSync(indexFile)) fs.writeFileSync(indexFile,'[]',{flag:'wx',mode:0o600});}
export function getDesigns(): UploadedDesign[] {
  setup();
  try { const data: unknown = JSON.parse(fs.readFileSync(indexFile,'utf8')); return Array.isArray(data) ? (data as UploadedDesign[]).filter(x=>x && typeof x.id==='string' && typeof x.filename==='string') : []; }
  catch { return []; }
}
function extension(data: Buffer): 'png'|'jpg'|'webp'|null {
  if(data.length>8 && data.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return 'png';
  if(data.length>3 && data[0]===255 && data[1]===216 && data[2]===255) return 'jpg';
  if(data.length>12 && data.toString('ascii',0,4)==='RIFF' && data.toString('ascii',8,12)==='WEBP') return 'webp';
  return null;
}
export function saveDesign(file: Buffer,title:string,category:string): {record:UploadedDesign; duplicate:boolean} {
  if(!file.length || file.length>10*1024*1024) throw new Error('Image must be 1 byte to 10 MB.');
  const ext=extension(file); if(!ext) throw new Error('Only valid PNG, JPEG and WebP images are allowed.');
  title=title.trim().slice(0,120); category=category.trim().slice(0,70);
  if(!title) throw new Error('Title is required.');
  if(!category) category='New Arrivals';
  const hash=createHash('sha256').update(file).digest('hex');
  const existing=getDesigns();const duplicate=existing.find(x=>x.sha256===hash);
  if(duplicate) return {record:duplicate,duplicate:true};
  const id=randomUUID(), filename=`${id}.${ext}`;
  const record:UploadedDesign={id,title,category,filename,sha256:hash,bytes:file.length,createdAt:new Date().toISOString(),imageUrl:`/api/design-images/${id}`};
  const imagePath=path.join(imagesDir,filename);
  fs.writeFileSync(imagePath,file,{flag:'wx',mode:0o600});
  const tmp=indexFile+'.'+process.pid+'.tmp';
  try {fs.writeFileSync(tmp,JSON.stringify([record,...existing],null,2),{mode:0o600});fs.renameSync(tmp,indexFile);} catch(error){try{fs.unlinkSync(imagePath)}catch{};throw error;}
  return {record,duplicate:false};
}
export function getImageFile(id:string) {
  if(!/^[a-f0-9-]{36}$/.test(id)) return null;
  const record=getDesigns().find(x=>x.id===id);if(!record)return null;
  const p=path.join(imagesDir,record.filename);if(!fs.existsSync(p))return null;
  return {data:fs.readFileSync(p),type:record.filename.endsWith('.png')?'image/png':record.filename.endsWith('.jpg')?'image/jpeg':'image/webp'};
}
