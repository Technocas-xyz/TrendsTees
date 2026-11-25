"use client";
import {useEffect,useId,useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {Eye,EyeOff,ShieldCheck,UserRound,ArrowRight,CheckCircle2,AlertCircle,LoaderCircle,LockKeyhole,Mail,Check} from 'lucide-react';
import {signupCustomer,loginCustomer,logoutCustomer,claimCart,getCartToken,getMe} from '@/lib/api';
import './auth.css';
export default function AuthForm({kind,next='/'}:{kind:'login'|'signup'|'admin';next?:string}) {
 const router=useRouter();const formId=useId();
 const [name,setName]=useState(''),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[confirm,setConfirm]=useState('');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[showPassword,setShowPassword]=useState(false),[showConfirm,setShowConfirm]=useState(false);
 const isAdmin=kind==='admin',isSignup=kind==='signup';
 const nextQuery=next==='/'?'':'?next='+encodeURIComponent(next); // keeps ?next= when switching between login and signup
 // Someone who is already signed in does not need this page (staff go to the admin panel)
 useEffect(()=>{let live=true;getMe().then(u=>{if(!live||!u)return;if(isAdmin){if(u.is_staff)router.replace('/admin')}else router.replace(next)}).catch(()=>{});return()=>{live=false}},[]);
 const strength=[password.length>=12,/[a-z]/.test(password)&&/[A-Z]/.test(password),/\d/.test(password),/[^\w\s]/.test(password)];
 const strengthCount=strength.filter(Boolean).length;
 const title=kind==='admin'?'Admin sign in':kind==='signup'?'Create your account':'Welcome back';
 const subtitle=kind==='admin'?'Secure workspace for authorized PrintSteez team members.':kind==='signup'?'Join PrintSteez and keep your favorites and shopping details together.':'Sign in to continue exploring designs you love.';
 async function submit(e:React.FormEvent<HTMLFormElement>){e.preventDefault();if(busy)return;
  setError('');if(isSignup&&password!==confirm){setError('Passwords do not match.');return;}
  if(isSignup&&strengthCount<2){setError('Use a stronger password with 12+ characters and a mix of characters.');return;}
  setBusy(true);
  try{
   if(isAdmin){ // staff sign in with the same backend login, then GET /auth/me says whether this account may use the admin panel
    await loginCustomer({email:email.trim(),password});
    const me=await getMe();
    if(!me||!me.is_staff){await logoutCustomer().catch(()=>{});throw new Error('This account does not have admin access.');}
    router.replace('/admin');router.refresh();return;
   }
   {
    if(isSignup)await signupCustomer({full_name:name.trim(),email:email.trim(),password});else await loginCustomer({email:email.trim(),password});
    const cartToken=getCartToken();if(cartToken){try{await claimCart(cartToken)}catch{/* a failed cart merge must not block sign-in */}}
    router.replace(next);router.refresh();return;
   }
  }catch(err){setError(err instanceof Error?err.message:'Something went wrong. Try again.');}finally{setBusy(false);}
 }
 return <main className={'auth-shell '+(isAdmin?'auth-admin':'auth-customer')}>
  <section className="auth-intro" aria-label="Account benefits">
   <Link href="/" className="auth-logo">Print<span>Steez</span></Link>
   <div className="auth-intro-content"><span className="auth-eyebrow">{isAdmin?'TEAM WORKSPACE':'YOUR PRINTSTEEZ ACCOUNT'}</span><h2>{isAdmin?'Manage your store with confidence.':'Discover. Customize. Make it yours.'}</h2><p>{isAdmin?'One place for designs, products, orders, customers and store insights.':'Save your favorite designs, revisit your orders, and shop with less effort.'}</p>
    <div className="auth-perks"><span><CheckCircle2 size={17}/> {isAdmin?'Role-protected dashboard':'Personal customer dashboard'}</span><span><CheckCircle2 size={17}/> {isAdmin?'Organized management tools':'Favorites and order history'}</span><span><CheckCircle2 size={17}/> {isAdmin?'Accounts are created by a Super Admin':'Quick return to shopping'}</span></div>
   </div><small className="auth-intro-foot">Designed for a simpler shopping experience.</small>
  </section>
  <section className="auth-side"><div className="auth-card"><div className="auth-mobile-logo"><Link href="/" className="auth-logo">Print<span>Steez</span></Link></div>
   <div className="auth-role-icon">{isAdmin?<ShieldCheck size={23}/>:<UserRound size={23}/>}</div><span className="auth-kicker">{isAdmin?'ADMIN ACCESS':'CUSTOMER ACCESS'}</span><h1>{title}</h1><p className="auth-subtitle">{subtitle}</p>
   <form onSubmit={submit} aria-busy={busy}>
    {isSignup&&<label htmlFor={formId+'-name'}>Full name<input id={formId+'-name'} required minLength={2} maxLength={100} autoComplete="name" value={name} onChange={e=>setName(e.target.value)} placeholder="Your full name" disabled={busy}/></label>}
    <label htmlFor={formId+'-email'}>Email address<div className="auth-field-icon"><Mail size={18}/><input id={formId+'-email'} type="email" required maxLength={254} autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" disabled={busy}/></div></label>
    <label htmlFor={formId+'-pass'}>Password<div className="auth-field-icon"><LockKeyhole size={18}/><input id={formId+'-pass'} type={showPassword?'text':'password'} required minLength={isSignup?12:1} maxLength={128} autoComplete={isSignup?'new-password':'current-password'} value={password} onChange={e=>setPassword(e.target.value)} placeholder={isSignup?'Create a password':'Enter your password'} disabled={busy}/><button type="button" className="auth-eye" onClick={()=>setShowPassword(s=>!s)} aria-label={showPassword?'Hide password':'Show password'} aria-pressed={showPassword}>{showPassword?<EyeOff size={18}/>:<Eye size={18}/>}</button></div>{isSignup&&<span className="auth-hint">Use at least 12 characters.</span>}</label>
    {isSignup&&<><div className="auth-strength" aria-live="polite"><div className="auth-strength-bars" aria-hidden="true">{[1,2,3,4].map(n=><span key={n} className={strengthCount>=n?'on level-'+strengthCount:''}/>)}</div><small>Password strength: {password.length===0?'Not entered':strengthCount<=1?'Needs improvement':strengthCount===2?'Fair':strengthCount===3?'Good':'Strong'}</small></div><label htmlFor={formId+'-confirm'}>Confirm password<div className="auth-field-icon"><LockKeyhole size={18}/><input id={formId+'-confirm'} type={showConfirm?'text':'password'} required minLength={12} maxLength={128} autoComplete="new-password" value={confirm} onChange={e=>setConfirm(e.target.value)} placeholder="Repeat your password" disabled={busy}/><button type="button" className="auth-eye" onClick={()=>setShowConfirm(s=>!s)} aria-label={showConfirm?'Hide confirmation':'Show confirmation'}>{showConfirm?<EyeOff size={18}/>:<Eye size={18}/>}</button></div>{confirm.length>0&&<span className={'auth-match '+(confirm===password?'yes':'no')}>{confirm===password?<><Check size={13}/> Passwords match</>:'Passwords do not match yet'}</span>}</label></>}
    {error&&<div className="auth-error" role="alert"><AlertCircle size={17}/><span>{error}</span></div>}
    <button className="auth-submit" type="submit" disabled={busy}>{busy?<><LoaderCircle className="auth-spinner" size={18}/> {isSignup?'Creating account...':'Signing in...'}</>:<>{isSignup?'CREATE ACCOUNT':'SIGN IN'} <ArrowRight size={18}/></>}</button>
   </form>
   {!isAdmin&&<div className="auth-links">{isSignup?<>Already have an account? <Link href={'/login'+nextQuery}>Sign in</Link></>:<>New here? <Link href={'/signup'+nextQuery}>Create account</Link></>}</div>}
   <div className="auth-switch">{isAdmin?<>Shopping as a customer? <Link href="/login">Customer login</Link></>:<>Part of the PrintSteez team? <Link href="/admin-login">Admin login</Link></>}</div>
   <Link className="auth-home" href="/">← Return to store</Link>
  </div></section>
 </main>;
}
