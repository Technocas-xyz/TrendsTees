import Site from '@/components/Site';
export default async function Route({params}:{params:Promise<{slug?:string[]}>}) {
  const {slug=[]}=await params;
  return <Site path={'/'+slug.join('/')}/>;
}
