import AuthForm from '@/components/AuthForm';
// Staff sign in with the backend; AuthForm checks GET /auth/me (is_staff) after the login
export default function AdminLogin(){return <AuthForm kind='admin'/>;}
