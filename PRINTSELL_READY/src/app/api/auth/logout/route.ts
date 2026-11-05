import {NextRequest,NextResponse} from 'next/server';
import {endSession} from '@/lib/auth';import {jsonError,sameOrigin} from '@/lib/request';
export const runtime='nodejs';
export async function POST(req:NextRequest){if(!sameOrigin(req))return jsonError('Invalid origin',403);await endSession();return NextResponse.json({ok:true});}
