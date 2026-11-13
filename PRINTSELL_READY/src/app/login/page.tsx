import AuthForm from '@/components/AuthForm';
import {currentUser} from '@/lib/auth';
import {safeNext} from '@/lib/next-url';
import {redirect} from 'next/navigation';
// Customers sign in with the API (AuthForm checks GET /auth/me). Only an admin session from the old login is handled here.
export default async function Login({searchParams}:{searchParams:Promise<{next?:string|string[]}>}){const next=safeNext((await searchParams).next); const user=await currentUser(); if(user?.role==='admin')redirect('/admin'); return <AuthForm kind='login' next={next}/>;}
