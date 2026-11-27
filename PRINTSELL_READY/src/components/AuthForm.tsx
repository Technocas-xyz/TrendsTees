"use client";
import {useEffect,useId,useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {Eye,EyeOff,ArrowRight,AlertCircle,LoaderCircle,LockKeyhole,Mail,Check,UserRound,PenTool,Palette,Shirt,ShieldCheck,LayoutDashboard,Users} from 'lucide-react';
import {signupCustomer,loginCustomer,logoutCustomer,claimCart,getCartToken,getMe} from '@/lib/api';
import {Logo} from './home/Logo';
import './auth.css';

type Errs={name?:string;email?:string;password?:string;confirm?:string};
const EMAIL_RE=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Sign in, create account (customers) and the staff sign in. The login logic is unchanged.
// There is no "Forgot password" link on purpose: the backend has no password reset route yet.
export default function AuthForm({kind,next='/'}:{kind:'login'|'signup'|'admin';next?:string}) {
 const router=useRouter();const formId=useId();
 const [name,setName]=useState(''),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[confirm,setConfirm]=useState('');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[errs,setErrs]=useState<Errs>({}),[showPassword,setShowPassword]=useState(false),[showConfirm,setShowConfirm]=useState(false);
 const isAdmin=kind==='admin',isSignup=kind==='signup';
 const nextQuery=next==='/'?'':'?next='+encodeURIComponent(next); // keeps ?next= when switching between login and signup
 // Someone who is already signed in does not need this page (staff go to the admin panel)
 useEffect(()=>{let live=true;getMe().then(u=>{if(!live||!u)return;if(isAdmin){if(u.is_staff)router.replace('/admin')}else router.replace(next)}).catch(()=>{});return()=>{live=false}},[]);
 const strength=[password.length>=12,/[a-z]/.test(password)&&/[A-Z]/.test(password),/\d/.test(password),/[^\w\s]/.test(password)];
 const strengthCount=strength.filter(Boolean).length;
 const title=isAdmin?'Admin sign in':isSignup?'Create your account':'Welcome back';
 const subtitle=isAdmin?'Secure workspace for authorized PrintSteez team members.':isSignup?'Join PrintSteez to save your favorite designs and track your orders.':'Sign in to see your orders and saved designs.';
 const clear=(k:keyof Errs)=>{setError('');setErrs(e=>e[k]?{...e,[k]:undefined}:e)};

 function validate():Errs{
  const e:Errs={};
  if(isSignup&&name.trim().length<2)e.name='Please enter your full name.';
  if(!email.trim())e.email='Please enter your email address.';else if(!EMAIL_RE.test(email.trim()))e.email='Please enter a valid email address.';
  if(!password)e.password='Please enter your password.';else if(isSignup&&password.length<12)e.password='Use at least 12 characters.';
  if(isSignup){if(!confirm)e.confirm='Please repeat your password.';else if(confirm!==password)e.confirm='Passwords do not match.'}
  return e;
 }
 async function submit(e:React.FormEvent<HTMLFormElement>){e.preventDefault();if(busy)return;
  setError('');
  const v=validate();setErrs(v);if(Object.keys(v).length)return;
  if(isSignup&&strengthCount<2){setErrs({password:'Use a stronger password: add upper and lower case letters, numbers or symbols.'});return;}
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
 const points=isAdmin
  ?[[LayoutDashboard,'Role-protected dashboard'],[ShieldCheck,'Organized management tools'],[Users,'Accounts are created by a Super Admin']] as const
  :[[PenTool,'Original Designs'],[Palette,'Designed In-House'],[Shirt,'Premium Quality Tees']] as const;
 const fe=(id:string,m?:string)=>m?<small className="auth-field-err" id={id} role="alert">{m}</small>:null;

 return <main className={'auth-shell '+(isAdmin?'auth-admin':'auth-customer')}>
  <section className="auth-intro" aria-label="About PrintSteez">
   <div className="auth-intro-art" aria-hidden="true">
    <svg viewBox="0 0 400 600" preserveAspectRatio="none"><path d="M250 640 L440 330" stroke="#F97316" strokeWidth="46" strokeLinecap="round"/><path d="M330 660 L450 500" stroke="#FB923C" strokeWidth="20" strokeLinecap="round"/><path d="M170 620 L400 240" stroke="#F97316" strokeWidth="6" strokeLinecap="round" opacity=".7"/></svg>
   </div>
   <div className="auth-intro-logo"><Logo light/></div>
   <div className="auth-intro-content">
    <span className="auth-eyebrow">{isAdmin?'TEAM WORKSPACE':'GRAPHIC TEES'}</span>
    <h2>{isAdmin?'Manage your store with confidence.':<>Original graphic tees.<br/><span className="auth-nowrap">Designed in-house.</span></>}</h2>
    <p>{isAdmin?'One place for designs, products, orders, customers and store insights.':'Every design is made by the PrintSteez team and printed just for you.'}</p>
    <ul className="auth-points">{points.map(([Icon,label])=><li key={label}><span><Icon size={18} aria-hidden="true"/></span>{label}</li>)}</ul>
   </div>
  </section>

  <section className="auth-side">
   <div className="auth-card">
    <div className="auth-mobile-logo"><Logo/></div>
    <div className="auth-role-icon" aria-hidden="true">{isAdmin?<ShieldCheck size={22}/>:<UserRound size={22}/>}</div>
    <h1>{title}</h1><p className="auth-subtitle">{subtitle}</p>
    <form onSubmit={submit} aria-busy={busy} noValidate>
     {isSignup&&<div className="auth-field"><label htmlFor={formId+'-name'}>Full name</label>
      <div className="auth-input"><UserRound size={18} aria-hidden="true"/><input id={formId+'-name'} maxLength={100} autoComplete="name" value={name} onChange={e=>{setName(e.target.value);clear('name')}} placeholder="Your full name" disabled={busy} aria-invalid={!!errs.name} aria-describedby={errs.name?formId+'-name-err':undefined}/></div>{fe(formId+'-name-err',errs.name)}</div>}
     <div className="auth-field"><label htmlFor={formId+'-email'}>Email address</label>
      <div className="auth-input"><Mail size={18} aria-hidden="true"/><input id={formId+'-email'} type="email" maxLength={254} autoComplete="email" value={email} onChange={e=>{setEmail(e.target.value);clear('email')}} placeholder="you@example.com" disabled={busy} aria-invalid={!!errs.email} aria-describedby={errs.email?formId+'-email-err':undefined}/></div>{fe(formId+'-email-err',errs.email)}</div>
     <div className="auth-field"><label htmlFor={formId+'-pass'}>Password</label>
      <div className="auth-input"><LockKeyhole size={18} aria-hidden="true"/><input id={formId+'-pass'} type={showPassword?'text':'password'} maxLength={128} autoComplete={isSignup?'new-password':'current-password'} value={password} onChange={e=>{setPassword(e.target.value);clear('password')}} placeholder={isSignup?'Create a password':'Enter your password'} disabled={busy} aria-invalid={!!errs.password} aria-describedby={errs.password?formId+'-pass-err':isSignup?formId+'-pass-hint':undefined}/>
       <button type="button" className="auth-eye" onClick={()=>setShowPassword(s=>!s)} aria-label={showPassword?'Hide password':'Show password'} aria-pressed={showPassword}>{showPassword?<EyeOff size={18}/>:<Eye size={18}/>}</button></div>
      {fe(formId+'-pass-err',errs.password)}{isSignup&&!errs.password&&<span className="auth-hint" id={formId+'-pass-hint'}>Use at least 12 characters.</span>}</div>
     {isSignup&&<>
      <div className="auth-strength" aria-live="polite"><div className="auth-strength-bars" aria-hidden="true">{[1,2,3,4].map(n=><span key={n} className={strengthCount>=n&&password?'on level-'+strengthCount:''}/>)}</div><small>Password strength: {password.length===0?'Not entered':strengthCount<=1?'Needs improvement':strengthCount===2?'Fair':strengthCount===3?'Good':'Strong'}</small></div>
      <div className="auth-field"><label htmlFor={formId+'-confirm'}>Confirm password</label>
       <div className="auth-input"><LockKeyhole size={18} aria-hidden="true"/><input id={formId+'-confirm'} type={showConfirm?'text':'password'} maxLength={128} autoComplete="new-password" value={confirm} onChange={e=>{setConfirm(e.target.value);clear('confirm')}} placeholder="Repeat your password" disabled={busy} aria-invalid={!!errs.confirm} aria-describedby={errs.confirm?formId+'-confirm-err':undefined}/>
        <button type="button" className="auth-eye" onClick={()=>setShowConfirm(s=>!s)} aria-label={showConfirm?'Hide confirmation':'Show confirmation'} aria-pressed={showConfirm}>{showConfirm?<EyeOff size={18}/>:<Eye size={18}/>}</button></div>
       {fe(formId+'-confirm-err',errs.confirm)}{!errs.confirm&&confirm.length>0&&<span className={'auth-match '+(confirm===password?'yes':'no')}>{confirm===password?<><Check size={13}/> Passwords match</>:'Passwords do not match yet'}</span>}</div></>}
     {error&&<div className="auth-error" role="alert"><AlertCircle size={17} aria-hidden="true"/><span>{error}</span></div>}
     <button className="ps-btn ps-btn-purple auth-submit" type="submit" disabled={busy}>{busy?<><LoaderCircle className="auth-spinner" size={18} aria-hidden="true"/> {isSignup?'Creating account…':'Signing in…'}</>:<>{isSignup?'Create Account':'Sign In'} <ArrowRight size={18} aria-hidden="true"/></>}</button>
    </form>
    {!isAdmin&&<div className="auth-links">{isSignup?<>Already have an account? <Link href={'/login'+nextQuery}>Sign in</Link></>:<>New to PrintSteez? <Link href={'/signup'+nextQuery}>Create an account</Link></>}</div>}
    <div className="auth-switch">{isAdmin?<>Shopping as a customer? <Link href="/login">Customer login</Link></>:<>Part of the PrintSteez team? <Link href="/admin-login">Admin login</Link></>}</div>
    <Link className="auth-home" href="/">← Return to store</Link>
   </div>
  </section>
 </main>;
}
