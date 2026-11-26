import {Suspense} from 'react';
import type {Metadata} from 'next';
import Site from '@/components/Site';
import {STORE_NAME} from '@/lib/config';

export const metadata:Metadata={title:'Page not found | '+STORE_NAME,robots:{index:false}};

// Any unknown URL (HTTP 404): the normal header and footer around the PrintSteez "page not found" page
export default function NotFound(){
  return <Suspense><Site path="/404"/></Suspense>;
}
