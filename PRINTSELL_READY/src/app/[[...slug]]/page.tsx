import {Suspense} from 'react';
import Site from '@/components/Site';
export default async function Route({params}:{params:Promise<{slug?:string[]}>}) {
  const {slug=[]}=await params;
  return <Suspense><Site path={'/'+slug.join('/')}/></Suspense>;
}
