import type { Metadata } from 'next';
import { Poppins } from 'next/font/google';
import './globals.css';
import '@/components/home/home.css';
import '@/components/listing/listing.css';
import '@/components/pages/pages.css';
import {STORE_NAME} from '@/lib/config';
// Poppins is downloaded at build time and served from this site. It sets --font-poppins, which --ps-font (home.css) uses everywhere.
const poppins = Poppins({subsets:['latin'],weight:['400','500','600','700','800','900'],variable:'--font-poppins',display:'swap'});
export const metadata: Metadata = {title:STORE_NAME+' | Graphic Tees With Real Style',description:'Original graphic tees, designed in-house and printed just for you.'};
export default function RootLayout({children}:{children:React.ReactNode}) {return <html lang="en" className={poppins.variable}><body>{children}</body></html>}
