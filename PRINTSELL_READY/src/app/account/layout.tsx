import {currentUser} from '@/lib/auth';
import {redirect} from 'next/navigation';
export const runtime='nodejs';
export default async function AccountLayout({children}:{children:React.ReactNode}) {const u=await currentUser(); if(!u)redirect('/login'); if(u.role==='admin')redirect('/admin'); return <>{children}</>;}
