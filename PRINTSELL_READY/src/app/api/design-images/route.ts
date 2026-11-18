import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { getDesigns, saveDesign } from '@/lib/image-library';
export const runtime='nodejs';
export const dynamic='force-dynamic';
function authorized(req: NextRequest) {
  const secret=process.env.AUTOMATION_UPLOAD_TOKEN;
  const incoming=req.headers.get('authorization')||'';
  if(!secret || secret.length<32 || !incoming.startsWith('Bearer ')) return false;
  const given=incoming.substring(7);
  const a=Buffer.from(secret),b=Buffer.from(given);
  return a.length===b.length && timingSafeEqual(a,b);
}
export async function GET() {
  const records=getDesigns().map(({sha256,filename,...safe})=>safe);
  return NextResponse.json({images:records,total:records.length},{headers:{'Cache-Control':'no-store'}});
}
export async function POST(req:NextRequest) {
  if(!authorized(req))return NextResponse.json({error:'Unauthorized'},{status:401});
  const length=Number(req.headers.get('content-length')||0);
  if(length>12*1024*1024)return NextResponse.json({error:'Upload exceeds size limit'},{status:413});
  let form:FormData;
  try {form=await req.formData();}catch{return NextResponse.json({error:'Invalid multipart form'},{status:400});}
  const file=form.get('file');
  if(!(file instanceof File))return NextResponse.json({error:'Field file must be a file'},{status:400});
  if(file.size>10*1024*1024)return NextResponse.json({error:'Image exceeds 10 MB'},{status:413});
  const title=String(form.get('title')||file.name.replace(/\.[^.]+$/,'')).trim();
  const category=String(form.get('category')||'New Arrivals').trim();
  try {
    const saved=saveDesign(Buffer.from(await file.arrayBuffer()),title,category);
    return NextResponse.json({ok:true,duplicate:saved.duplicate,image:saved.record},{status:saved.duplicate?200:201});
  }catch(e) {return NextResponse.json({error:e instanceof Error?e.message:'Invalid image'},{status:400});}
}
