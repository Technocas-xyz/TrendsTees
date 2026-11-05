"use client";
import {useRouter} from 'next/navigation';
export default function AccountActions(){const router=useRouter();return <button style={{padding:'12px 22px',background:'#e20d26',color:'white',border:0,borderRadius:6,cursor:'pointer'}} onClick={async()=>{await fetch('/api/auth/logout',{method:'POST'});router.replace('/login');router.refresh();}}>Log out</button>}
