import {currentUser} from '@/lib/auth';import AccountDashboard from '@/components/AccountDashboard';
export const runtime='nodejs';export default async function Page(){const user=await currentUser(); return <AccountDashboard user={{name:user!.name,email:user!.email}} section='overview'/>;}
