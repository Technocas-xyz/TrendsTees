import fs from 'node:fs';
import path from 'node:path';
import { randomBytes, createHash, scryptSync, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';

export type Role = 'customer' | 'admin';
export type User = { id:string; name:string; email:string; role:Role; passwordHash:string; createdAt:string };
type Session = { tokenHash:string; userId:string; expiresAt:number };
type Invite = { tokenHash:string; expiresAt:number };
type DB = { users:User[]; sessions:Session[]; attempts: Record<string,{count:number; expiresAt:number}>; adminInvites:Invite[] };
const file = path.join(process.cwd(),'data','auth.json');
const COOKIE='printsell_session';
const DAY=86400*1000;
function db():DB {
  if (!fs.existsSync(file)) {fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify({users:[],sessions:[],attempts:{},adminInvites:[]}));}
  const d=JSON.parse(fs.readFileSync(file,'utf8')) as DB;
  return {users:d.users||[],sessions:d.sessions||[],attempts:d.attempts||{},adminInvites:d.adminInvites||[]};
}
function save(d:DB){const tmp=file+'.'+process.pid+'.tmp';fs.writeFileSync(tmp,JSON.stringify(d,null,2),{mode:0o600});fs.renameSync(tmp,file);}
const sha=(value:string)=>createHash('sha256').update(value).digest('hex');
export function hashPassword(password:string){const salt=randomBytes(16).toString('hex');const hash=scryptSync(password,salt,64).toString('hex');return `${salt}:${hash}`;}
function verifyPassword(password:string,stored:string){const [salt,hex]=stored.split(':');if(!salt||!hex||hex.length!==128)return false;const actual=scryptSync(password,salt,64);return timingSafeEqual(actual,Buffer.from(hex,'hex'));}
export function registerCustomer(name:string,email:string,password:string){const d=db();email=email.trim().toLowerCase();name=name.trim();if(!name||name.length>100||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254||password.length<12||password.length>128)throw new Error('Enter a name, valid email and password of 12–128 characters.');if(d.users.some(u=>u.email===email))throw new Error('This email is already registered.');const u:User={id:randomBytes(16).toString('hex'),name,email,role:'customer',passwordHash:hashPassword(password),createdAt:new Date().toISOString()};d.users.push(u);save(d);return u;}
export function registerInvitedAdmin(name:string,email:string,password:string,inviteCode:string){
  const d=db();const code=inviteCode.trim();
  if(!code||code.length>256)throw new Error('Invalid or expired admin invitation.');
  const now=Date.now();const match=d.adminInvites.find(x=>x.tokenHash===sha(code)&&x.expiresAt>now);
  if(!match)throw new Error('Invalid or expired admin invitation.');
  name=name.trim();email=email.trim().toLowerCase();
  if(!name||name.length>100||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254||password.length<12||password.length>128)
    throw new Error('Enter a valid name, email and password of 12–128 characters.');
  if(d.users.some(u=>u.email===email))throw new Error('This email is already registered.');
  const u:User={id:randomBytes(16).toString('hex'),name,email,role:'admin',passwordHash:hashPassword(password),createdAt:new Date().toISOString()};
  d.users.push(u);d.adminInvites=d.adminInvites.filter(x=>x!==match&&x.expiresAt>now);save(d);return u;
}
export function authenticate(email:string,password:string,ip:string){const d=db();const key=sha(ip+'|'+email.toLowerCase());const now=Date.now();const a=d.attempts[key];if(a&&a.expiresAt>now&&a.count>=8)throw new Error('Too many attempts. Try again after 15 minutes.');const u=d.users.find(u=>u.email===email.toLowerCase().trim());let valid=false;try{valid=verifyPassword(password,u?.passwordHash||hashPassword('dummy-password-12345'));}catch{valid=false;}
if(!u||!valid){d.attempts[key]={count:a&&a.expiresAt>now?a.count+1:1,expiresAt:now+15*60*1000};save(d);throw new Error('Invalid email or password.');}delete d.attempts[key];save(d);return u;}
export async function createSession(u:User){const d=db();const token=randomBytes(32).toString('base64url');const expiresAt=Date.now()+7*DAY;d.sessions=d.sessions.filter(s=>s.expiresAt>Date.now()&&s.userId!==u.id);d.sessions.push({tokenHash:sha(token),userId:u.id,expiresAt});save(d);(await cookies()).set(COOKIE,token,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge:7*86400});}
export async function currentUser(){const cookie=(await cookies()).get(COOKIE)?.value;if(!cookie)return null;const d=db();const session=d.sessions.find(s=>s.tokenHash===sha(cookie)&&s.expiresAt>Date.now());if(!session)return null;const u=d.users.find(x=>x.id===session.userId);return u?{id:u.id,email:u.email,name:u.name,role:u.role}:null;}
export async function endSession(){const token=(await cookies()).get(COOKIE)?.value;if(token){const d=db();d.sessions=d.sessions.filter(s=>s.tokenHash!==sha(token));save(d);}(await cookies()).delete(COOKIE);}
