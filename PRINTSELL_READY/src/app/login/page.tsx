import AuthForm from '@/components/AuthForm';
import {currentUser} from '@/lib/auth';
import {redirect} from 'next/navigation';
export default async function Login(){const user=await currentUser(); if(user)redirect(user.role==='admin'?'/admin':'/account'); return <AuthForm kind='login'/>;}
