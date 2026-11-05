import Admin from '@/components/Admin';
export default async function AdminRoute({params}:{params:Promise<{section?:string[]}>}){
 const {section=[]}=await params;
 return <Admin section={section[0]||'dashboard'}/>;
}
