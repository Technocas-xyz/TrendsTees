import AuthForm from '@/components/AuthForm';
import {currentUser} from '@/lib/auth';
import {safeNext} from '@/lib/next-url';
import {redirect} from 'next/navigation';
export const runtime='nodejs';
// Customers sign up with the API (AuthForm checks GET /auth/me). Only an admin session from the old login is handled here.
export default async function Signup({searchParams}:{searchParams:Promise<{next?:string|string[]}>}){const next=safeNext((await searchParams).next);const user=await currentUser();if(user?.role==='admin')redirect('/admin');return <AuthForm kind='signup' next={next}/>;}
