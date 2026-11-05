import {currentUser} from '@/lib/auth';
import {redirect} from 'next/navigation';
export const runtime='nodejs';
export default async function AdminLayout({children}:{children:React.ReactNode}){const u=await currentUser();if(!u)redirect('/admin-login');if(u.role!=='admin')redirect('/access-denied');return <>{children}</>;}
