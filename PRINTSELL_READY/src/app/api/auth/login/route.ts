import {NextRequest,NextResponse} from 'next/server';
import {authenticate,createSession} from '@/lib/auth';
import {jsonError,sameOrigin} from '@/lib/request';
export const runtime='nodejs';
export async function POST(req:NextRequest){if(!sameOrigin(req))return jsonError('Invalid origin',403);try{const body=await req.json();if(typeof body.email!=='string'||typeof body.password!=='string'||body.email.length>254||body.password.length>128)return jsonError('Invalid login input');const ip=req.headers.get('x-forwarded-for')?.split(',')[0]||'local';const u=authenticate(body.email,body.password,ip);await createSession(u);return NextResponse.json({user:{name:u.name,email:u.email,role:u.role}},{headers:{'Cache-Control':'no-store'}});}catch(e){return jsonError(e instanceof Error?e.message:'Login failed',401);}}
