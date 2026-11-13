import AccountDashboard from '@/components/AccountDashboard';
// Who is signed in is checked in the browser (GET /auth/me), because the login cookie belongs to the API
export default function Page(){return <AccountDashboard section='overview'/>;}
