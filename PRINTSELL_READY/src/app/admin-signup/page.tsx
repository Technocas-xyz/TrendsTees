import AuthForm from '@/components/AuthForm';
import {currentUser} from '@/lib/auth';
import {redirect} from 'next/navigation';
export const runtime='nodejs';
export default async function AdminSignup(){const user=await currentUser();if(user)redirect(user.role==='admin'?'/admin':'/account');return <AuthForm kind="admin-signup"/>;}
