import AuthForm from '@/components/AuthForm';
import {currentUser} from '@/lib/auth';
import {redirect} from 'next/navigation';
export const runtime='nodejs';
export default async function AdminLogin(){const user=await currentUser();if(user?.role==='admin')redirect('/admin');if(user?.role==='customer')redirect('/');return <AuthForm kind='admin'/>;}
