import fs from 'node:fs';
import path from 'node:path';
import {randomBytes,createHash} from 'node:crypto';
const file=path.join(process.cwd(),'data','auth.json');
try {
 fs.mkdirSync(path.dirname(file),{recursive:true});
 const db=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):{users:[],sessions:[],attempts:{},adminInvites:[]};
 // A first admin is provisioned with npm run create-admin; only an existing admin can issue an invite.
 if(!Array.isArray(db.users)||!db.users.some(u=>u.role==='admin'))throw new Error('Create the first admin using npm run create-admin before issuing invitations.');
 const code=randomBytes(32).toString('base64url');const now=Date.now();
 db.adminInvites=(Array.isArray(db.adminInvites)?db.adminInvites:[]).filter(x=>x.expiresAt>now);
 db.adminInvites.push({tokenHash:createHash('sha256').update(code).digest('hex'),expiresAt:now+24*60*60*1000});
 const tmp=file+'.invite.tmp';fs.writeFileSync(tmp,JSON.stringify(db,null,2),{mode:0o600});fs.renameSync(tmp,file);
 console.log('One-time admin invitation (expires in 24 hours):\n'+code+'\nShare privately with the intended administrator.');
}catch(e){console.error(e.message);process.exitCode=1;}
