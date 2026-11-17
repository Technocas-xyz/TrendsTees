import AuthForm from '@/components/AuthForm';
import {safeNext} from '@/lib/next-url';
// Customers sign up with the backend; AuthForm checks GET /auth/me
export default async function Signup({searchParams}:{searchParams:Promise<{next?:string|string[]}>}){const next=safeNext((await searchParams).next);return <AuthForm kind='signup' next={next}/>;}
