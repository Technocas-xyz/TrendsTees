import {NextRequest,NextResponse} from 'next/server';
import {createSession,registerCustomer} from '@/lib/auth';
import {jsonError,sameOrigin} from '@/lib/request';
export const runtime='nodejs';
export async function POST(req:NextRequest){if(!sameOrigin(req))return jsonError('Invalid origin',403);try{const body=await req.json();if(typeof body.name!=='string'||typeof body.email!=='string'||typeof body.password!=='string')return jsonError('Invalid input');const u=registerCustomer(body.name,body.email,body.password);await createSession(u);return NextResponse.json({user:{id:u.id,name:u.name,email:u.email,role:u.role}},{headers:{'Cache-Control':'no-store'}});}catch(e){return jsonError(e instanceof Error?e.message:'Unable to sign up',400);}}
