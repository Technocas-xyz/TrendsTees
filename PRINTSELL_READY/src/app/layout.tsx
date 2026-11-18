import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {title:'PRINT&SELL | Custom Designs',description:'Print on demand designs and apparel.'};
export default function RootLayout({children}:{children:React.ReactNode}) {return <html lang="en"><body>{children}</body></html>}
