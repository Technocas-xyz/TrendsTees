import AuthForm from '@/components/AuthForm';
import {safeNext} from '@/lib/next-url';
// Customers sign in with the backend; AuthForm checks GET /auth/me
export default async function Login({searchParams}:{searchParams:Promise<{next?:string|string[]}>}){const next=safeNext((await searchParams).next); return <AuthForm kind='login' next={next}/>;}
