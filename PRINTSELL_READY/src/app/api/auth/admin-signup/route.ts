import {NextRequest,NextResponse} from 'next/server';
import {createSession,registerInvitedAdmin} from '@/lib/auth';
import {jsonError,sameOrigin} from '@/lib/request';
export const runtime='nodejs';
export async function POST(req:NextRequest){
  if(!sameOrigin(req))return jsonError('Invalid origin',403);
  try{
    const body=await req.json();
    if(typeof body.name!=='string'||typeof body.email!=='string'||typeof body.password!=='string'||typeof body.inviteCode!=='string')return jsonError('Invalid input');
    const user=registerInvitedAdmin(body.name,body.email,body.password,body.inviteCode);
    await createSession(user);
    return NextResponse.json({user:{id:user.id,name:user.name,email:user.email,role:user.role}},{headers:{'Cache-Control':'no-store'}});
  }catch(e){return jsonError(e instanceof Error?e.message:'Unable to register admin',400);}
}
