import {Suspense} from 'react';
import Admin from '@/components/Admin';
// section[0] = the admin section (empty = the first one this user may see), section[1] = a sub page such as a design code
export default async function AdminRoute({params}:{params:Promise<{section?:string[]}>}){
 const {section=[]}=await params;
 return <Suspense><Admin section={section[0]||''} sub={section[1]||''}/></Suspense>;
}
