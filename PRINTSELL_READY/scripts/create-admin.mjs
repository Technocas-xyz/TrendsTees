import fs from 'node:fs';import path from 'node:path';import {randomBytes,scryptSync} from 'node:crypto';import readline from 'node:readline/promises';
const dbfile=path.join(process.cwd(),'data','auth.json');
const rl=readline.createInterface({input:process.stdin,output:process.stdout});
try{
 const name=(await rl.question('Admin name: ')).trim();const email=(await rl.question('Admin email: ')).trim().toLowerCase();const password=await rl.question('Admin password (12+ chars, input visible): ');
 if(!name||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||password.length<12||password.length>128)throw new Error('Invalid name/email/password. Password needs 12–128 characters.');
 fs.mkdirSync(path.dirname(dbfile),{recursive:true});const d=fs.existsSync(dbfile)?JSON.parse(fs.readFileSync(dbfile,'utf8')):{users:[],sessions:[],attempts:{}};if(d.users.some(u=>u.email===email))throw new Error('Email already exists.');
 const salt=randomBytes(16).toString('hex');const hash=scryptSync(password,salt,64).toString('hex');d.users.push({id:randomBytes(16).toString('hex'),name,email,role:'admin',passwordHash:salt+':'+hash,createdAt:new Date().toISOString()});const tmp=dbfile+'.tmp';fs.writeFileSync(tmp,JSON.stringify(d,null,2),{mode:0o600});fs.renameSync(tmp,dbfile);console.log('Admin account created. Visit /admin-login.');
}catch(e){console.error(e.message);process.exitCode=1;}finally{rl.close();}
