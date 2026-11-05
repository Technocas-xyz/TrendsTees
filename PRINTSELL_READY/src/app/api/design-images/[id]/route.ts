import { NextResponse } from 'next/server';
import { getImageFile } from '@/lib/image-library';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}) {
  const {id}=await params; const image=getImageFile(id);
  if(!image)return NextResponse.json({error:'Image not found'},{status:404});
  return new NextResponse(new Uint8Array(image.data),{headers:{'Content-Type':image.type,'Content-Disposition':'inline','X-Content-Type-Options':'nosniff','Cache-Control':'public, max-age=3600'}});
}
