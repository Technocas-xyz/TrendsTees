import Admin from '@/components/Admin';
// An empty section means "the first section this user may open" (decided in Admin once the permissions are known)
export default async function AdminRoute({params}:{params:Promise<{section?:string[]}>}){
 const {section=[]}=await params;
 return <Admin section={section[0]||''}/>;
}
