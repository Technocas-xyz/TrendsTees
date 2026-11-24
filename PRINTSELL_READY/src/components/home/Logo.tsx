import Link from 'next/link';
import {STORE_NAME} from '@/lib/config';

// Bold italic "PS" mark + store name in a heavy font. `light` = white version for the dark footer.
export function Logo({light=false}:{light?:boolean}){
  return <Link href="/" className={'ps-logo'+(light?' light':'')} aria-label={STORE_NAME+' home'}>
    <span className="ps-logo-mark" aria-hidden="true">PS</span>
    <span className="ps-logo-name" aria-hidden="true">{STORE_NAME}</span>
  </Link>;
}
