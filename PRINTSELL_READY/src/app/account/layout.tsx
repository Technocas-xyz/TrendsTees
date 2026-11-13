import {currentUser} from '@/lib/auth';
import {redirect} from 'next/navigation';
export const runtime='nodejs';
// Logged-out visitors are sent to /login?next=<page> by each account page, which knows its own path
export default async function AccountLayout({children}:{children:React.ReactNode}) {const u=await currentUser(); if(u?.role==='admin')redirect('/admin'); return <>{children}</>;}
