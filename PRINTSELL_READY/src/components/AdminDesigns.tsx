'use client';
// Admin > Designs: list with filters and bulk status, "Add design" form, edit page.
// The backend checks every permission; the checks here only decide what is shown.
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {useRouter,usePathname,useSearchParams} from 'next/navigation';
import {ArrowLeft,ChevronLeft,ChevronRight,Plus,Pencil,Search,Upload,X} from 'lucide-react';
import {
  imageUrl,
  getAdminCategories,getActiveProducts,getAdminDesigns,getAdminDesign,createDesign,updateDesign,
  replaceDesignImage,setDesignStatus,bulkDesignStatus,
  type ApiMe,type ApiAdminCategory,type ApiAdminDesign,type ApiAdminDesignRow,
} from '@/lib/api';
import {can,errMsg,when,label,sessionEnded,useLoad,LoadState,Thumb} from './AdminPanels';

const PER_PAGE=24;
const MAX_IMAGE=15*1024*1024;
const IMAGE_TYPES=['image/png','image/jpeg','image/webp'];
const TABS:[string,string][]=[['','All'],['draft','Draft'],['published','Published'],['hidden','Hidden'],['archived','Archived']];
// Status moves the backend allows (it checks them again)
const MOVES:Record<string,string[]>={draft:['published','archived'],published:['hidden','archived'],hidden:['published','archived'],reported:['archived'],removed:['archived']};
const MOVE_LABEL:Record<string,string>={published:'Publish',hidden:'Hide',archived:'Archive'};

function DesignBadge({status}:{status:string}){
  const cls:Record<string,string>={draft:'grey',published:'green',hidden:'yellow',archived:'red',reported:'orange',removed:'red'};
  return <span className={'adm-pill '+(cls[status]||'purple')}>{label(status)}</span>;
}
function SourceBadge({source}:{source:string}){
  return source==='teepublic_demo'?<span className="adm-pill blue">Demo</span>:source==='own'?<span className="adm-pill purple">Own</span>:<span className="adm-pill grey">{label(source)}</span>;
}

// Browser-side image check before uploading (the backend checks the real file again)
function imageProblem(file:File){
  if(!IMAGE_TYPES.includes(file.type))return 'Only PNG, JPEG or WEBP images are allowed.';
  if(file.size===0)return 'The image file is empty.';
  if(file.size>MAX_IMAGE)return 'The image is too large. The maximum size is 15 MB.';
  return '';
}

export function DesignsPanel({me,sub}:{me:ApiMe;sub:string}){
  if(sub==='new')return can(me,'designs.manage')?<AddDesign/>:<div className="adm-panel"><h2>No access</h2><p className="adm-muted">You don't have permission to add designs.</p><Link className="adm-link" href="/admin/designs">Back to designs</Link></div>;
  if(sub)return <EditDesign me={me} code={sub}/>;
  return <DesignsList me={me}/>;
}

// ---------------------------------------------------------------- List

function DesignsList({me}:{me:ApiMe}){
  const router=useRouter(),pathname=usePathname(),params=useSearchParams();
  const status=params.get('status')||'',category=params.get('category')||'',source=params.get('source')||'',search=params.get('search')||'';
  const page=Math.max(1,parseInt(params.get('page')||'1')||1);
  const manage=can(me,'designs.manage');
  const [q,setQ]=useState(search);
  useEffect(()=>{setQ(search)},[search]);
  // Filters live in the URL; changing any of them (except the page) goes back to page 1
  function setParams(changes:Record<string,string>){
    const p=new URLSearchParams(params.toString());
    for(const k in changes){if(changes[k])p.set(k,changes[k]);else p.delete(k)}
    if(!('page' in changes))p.delete('page');
    const s=p.toString();
    router.replace(pathname+(s?'?'+s:''),{scroll:false});
  }
  const categories=useLoad(getAdminCategories,'admin-categories');
  // Server paging for every tab; without a status the API leaves out archived designs
  const a=useLoad(()=>getAdminDesigns({status,categoryId:category,search,source,limit:PER_PAGE,offset:(page-1)*PER_PAGE}),'designs|'+[status,category,source,search,page].join('|'));
  const rows=a.data?a.data.items:[];
  const total=a.data?a.data.total:0,pages=Math.max(1,Math.ceil(total/PER_PAGE));

  const [selected,setSelected]=useState<string[]>([]),[busy,setBusy]=useState(''),[error,setError]=useState('');
  const [result,setResult]=useState<{summary:string;skipped:{title:string;reason:string}[]}|null>(null);
  useEffect(()=>{setSelected([])},[status,category,source,search,page]);
  const allSelected=rows.length>0&&rows.every(d=>selected.includes(d.public_design_code));

  async function changeOne(d:ApiAdminDesignRow,newStatus:string){
    if(newStatus==='archived'&&!window.confirm('Archive "'+d.title+'"? It will only be listed under the Archived tab.'))return;
    setBusy(d.public_design_code);setError('');setResult(null);
    try{await setDesignStatus(d.public_design_code,newStatus);a.retry()}
    catch(e){if(!sessionEnded(e))setError(errMsg(e))}finally{setBusy('')}
  }
  async function bulk(newStatus:string){
    if(selected.length===0)return;
    if(!window.confirm(MOVE_LABEL[newStatus]+' '+selected.length+(selected.length===1?' design?':' designs?')))return;
    const titles=new Map((a.data?a.data.items:[]).map(d=>[d.public_design_code,d.title]));
    setBusy('bulk');setError('');setResult(null);
    try{
      const r=await bulkDesignStatus(selected,newStatus);
      setResult({summary:r.updated+' updated, '+r.skipped.length+' skipped',skipped:r.skipped.map(s=>({title:titles.get(s.code)||s.code,reason:s.reason}))});
      setSelected([]);a.retry();
    }catch(e){if(!sessionEnded(e))setError(errMsg(e))}finally{setBusy('')}
  }

  return <section className="adm-table-panel">
    <div className="adm-tabs">{TABS.map(([value,name])=><button key={value} className={status===value?'active':''} onClick={()=>setParams({status:value})}>{name}</button>)}</div>
    <form className="adm-table-tools" onSubmit={e=>{e.preventDefault();setParams({search:q.trim()})}}>
      <div className="adm-search"><Search size={16}/><input placeholder="Search by title..." value={q} onChange={e=>setQ(e.target.value)}/></div>
      <select className="adm-select" value={category} onChange={e=>setParams({category:e.target.value})} aria-label="Interest or niche">
        <option value="">All interests</option>
        {(categories.data||[]).map(c=><optgroup key={c.category_id} label={c.name}>
          <option value={String(c.category_id)}>All {c.name}</option>
          {c.niches.map(n=><option key={n.category_id} value={String(n.category_id)}>{n.name}</option>)}
        </optgroup>)}
      </select>
      <select className="adm-select" value={source} onChange={e=>setParams({source:e.target.value})} aria-label="Source">
        <option value="">All sources</option><option value="own">Own</option><option value="teepublic_demo">Demo</option>
      </select>
      <button className="adm-light" type="submit">Search</button>
      {(search||category||source)&&<button className="adm-light" type="button" onClick={()=>setParams({search:'',category:'',source:''})}>Reset</button>}
      {manage&&<Link className="adm-purple" href="/admin/designs/new"><Plus size={16}/> Add design</Link>}
    </form>

    {manage&&selected.length>0&&<div className="adm-bulkbar"><b>{selected.length} selected</b>
      <button className="adm-light" disabled={busy==='bulk'} onClick={()=>bulk('published')}>Publish</button>
      <button className="adm-light" disabled={busy==='bulk'} onClick={()=>bulk('hidden')}>Hide</button>
      <button className="adm-light" disabled={busy==='bulk'} onClick={()=>bulk('archived')}>Archive</button>
      <button className="adm-light" onClick={()=>setSelected([])}>Clear</button></div>}
    {result&&<div className="adm-notice" style={{marginTop:14,alignItems:'flex-start',flexDirection:'column'}}><b>{result.summary}</b>
      {result.skipped.length>0&&<ul style={{margin:0,paddingLeft:18}}>{result.skipped.map((s,i)=><li key={i}>{s.title}: {s.reason}</li>)}</ul>}
      <button className="adm-light" onClick={()=>setResult(null)}>Dismiss</button></div>}
    {error&&<div className="adm-error" style={{marginTop:14}}>{error}</div>}

    {!a.data?<LoadState error={a.error} retry={a.retry}/>:<>
      <div className="adm-resultcount">{total} {total===1?'design':'designs'}{!status&&' (archived designs are under the Archived tab)'}</div>
      {rows.length===0?<div className="adm-empty">No designs match these filters.</div>:<div className="adm-scroll"><table className="adm-table"><thead><tr>
        {manage&&<th><input type="checkbox" checked={allSelected} onChange={e=>setSelected(e.target.checked?rows.map(d=>d.public_design_code):[])} aria-label="Select all on this page"/></th>}
        <th></th><th>Title</th><th>Interest / niche</th><th>Status</th><th>Source</th><th>Products</th><th>Ordered</th><th>Created</th><th></th></tr></thead><tbody>
        {rows.map(d=>{const code=d.public_design_code,moves=MOVES[d.design_status]||[];return <tr key={code}>
          {manage&&<td><input type="checkbox" checked={selected.includes(code)} onChange={e=>setSelected(s=>e.target.checked?[...s,code]:s.filter(x=>x!==code))} aria-label={'Select '+d.title}/></td>}
          <td><Thumb url={d.preview_url} title={d.title}/></td>
          <td style={{whiteSpace:'normal',minWidth:180}}><Link className="adm-titlelink" href={'/admin/designs/'+code}>{d.title}</Link></td>
          <td>{d.category_name||'—'}</td>
          <td><DesignBadge status={d.design_status}/></td>
          <td><SourceBadge source={d.source_platform}/></td>
          <td>{d.enabled_products}</td><td>{d.times_ordered}</td><td>{new Date(d.created_at).toLocaleDateString()}</td>
          <td><div className="adm-rowactions">
            <Link className="adm-light" href={'/admin/designs/'+code}>{manage?<><Pencil size={14}/> Edit</>:'View'}</Link>
            {manage&&moves.map(m=><button key={m} className="adm-light" disabled={busy===code} onClick={()=>changeOne(d,m)}>{MOVE_LABEL[m]}</button>)}
          </div></td></tr>})}
      </tbody></table></div>}
      {pages>1&&<div className="adm-table-footer"><span>Page {page} of {pages}</span><div><button disabled={page<=1} onClick={()=>setParams({page:String(page-1)})} aria-label="Previous page"><ChevronLeft size={16}/></button><b>{page}</b><button disabled={page>=pages} onClick={()=>setParams({page:String(page+1)})} aria-label="Next page"><ChevronRight size={16}/></button></div></div>}
    </>}
  </section>;
}

// ---------------------------------------------------------------- Shared form parts

type DesignValue={title:string;description:string;interest:string;niche:string;tags:string[];productIds:number[]};

function DesignFields({value,onChange,categories,products,disabled}:{value:DesignValue;onChange:(v:DesignValue)=>void;categories:ApiAdminCategory[];products:{product_id:number;product_name:string}[];disabled?:boolean}){
  const set=(patch:Partial<DesignValue>)=>onChange({...value,...patch});
  const interest=categories.find(c=>String(c.category_id)===value.interest);
  const [tagText,setTagText]=useState(''),[tagError,setTagError]=useState('');
  const mark=(status:string)=>status==='active'?'':' (inactive)';
  // Type a tag and press Enter (or comma): it becomes a chip
  function addTags(){
    const found=tagText.split(',').map(t=>t.split(/\s+/).filter(Boolean).join(' ').toLowerCase()).filter(Boolean);
    if(found.length===0){setTagText('');return}
    const next=[...value.tags];
    for(const tag of found){
      if(tag.length>40){setTagError('Each tag can have at most 40 characters.');return}
      if(next.includes(tag))continue;
      if(next.length>=15){setTagError('A design can have at most 15 tags.');return}
      next.push(tag);
    }
    setTagError('');setTagText('');set({tags:next});
  }
  return <div className="adm-form">
    <label>Title *<input type="text" required maxLength={160} value={value.title} onChange={e=>set({title:e.target.value})} disabled={disabled}/></label>
    <label>Description<textarea rows={4} maxLength={2000} value={value.description} onChange={e=>set({description:e.target.value})} disabled={disabled}/></label>
    <div className="adm-formgrid" style={{marginBottom:0}}>
      <label>Interest *<select value={value.interest} onChange={e=>set({interest:e.target.value,niche:''})} disabled={disabled}>
        <option value="">Select an interest</option>{categories.map(c=><option key={c.category_id} value={String(c.category_id)}>{c.name}{mark(c.status)}</option>)}</select></label>
      <label>Niche (optional)<select value={value.niche} onChange={e=>set({niche:e.target.value})} disabled={disabled||!interest||interest.niches.length===0}>
        <option value="">{!interest?'Choose an interest first':interest.niches.length?'No niche':'This interest has no niches'}</option>{interest?.niches.map(n=><option key={n.category_id} value={String(n.category_id)}>{n.name}{mark(n.status)}</option>)}</select></label>
    </div>
    <div><b style={{fontSize:12,color:'#4b5670'}}>Tags ({value.tags.length}/15)</b>
      <div className="adm-chips">{value.tags.map(t=><span key={t} className="adm-chip">{t}{!disabled&&<button type="button" onClick={()=>set({tags:value.tags.filter(x=>x!==t)})} aria-label={'Remove tag '+t}><X size={12}/></button>}</span>)}</div>
      {!disabled&&<input type="text" className="adm-taginput" placeholder="Type a tag and press Enter" value={tagText} onChange={e=>{setTagText(e.target.value);setTagError('')}} onKeyDown={e=>{if(e.key==='Enter'||e.key===','){e.preventDefault();addTags()}}} onBlur={addTags}/>}
      {tagError&&<div className="adm-error" style={{marginTop:8}}>{tagError}</div>}
    </div>
    <div><b style={{fontSize:12,color:'#4b5670'}}>Products</b>
      <div className="adm-rolepicker">{products.map(p=><label className="adm-check" key={p.product_id}><input type="checkbox" checked={value.productIds.includes(p.product_id)} disabled={disabled} onChange={e=>set({productIds:e.target.checked?[...value.productIds,p.product_id]:value.productIds.filter(x=>x!==p.product_id)})}/> {p.product_name}</label>)}</div>
    </div>
  </div>;
}

// Drop zone + file picker with a preview on a checkerboard (so transparent PNGs are visible)
function ImageDrop({file,onFile,disabled}:{file:File|null;onFile:(f:File|null)=>void;disabled?:boolean}){
  const [url,setUrl]=useState(''),[error,setError]=useState(''),[over,setOver]=useState(false);
  const input=useRef<HTMLInputElement>(null);
  useEffect(()=>{
    if(!file){setUrl('');return}
    const u=URL.createObjectURL(file);setUrl(u);
    return()=>URL.revokeObjectURL(u);
  },[file]);
  function take(f:File|undefined){
    if(!f)return;
    const problem=imageProblem(f);
    if(problem){setError(problem);onFile(null);return}
    setError('');onFile(f);
  }
  return <div>
    <div className={'adm-drop'+(over?' over':'')} onDragOver={e=>{e.preventDefault();setOver(true)}} onDragLeave={()=>setOver(false)} onDrop={e=>{e.preventDefault();setOver(false);if(!disabled)take(e.dataTransfer.files[0])}}>
      {url?<div className="adm-checker"><img src={url} alt="Preview"/></div>:<><Upload size={34}/><strong>Drop an image here</strong><p>PNG, JPEG or WEBP, up to 15 MB.</p></>}
      <button type="button" className="adm-light" disabled={disabled} onClick={()=>input.current?.click()}>{file?'Choose another file':'Choose file'}</button>
    </div>
    <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={e=>{take(e.target.files?.[0]);e.target.value=''}}/>
    {file&&<p className="adm-muted" style={{margin:'10px 0 0'}}>{file.name} · {(file.size/1024/1024).toFixed(2)} MB</p>}
    {error&&<div className="adm-error" style={{marginTop:10}}>{error}</div>}
  </div>;
}

// ---------------------------------------------------------------- Add design

function AddDesign(){
  const router=useRouter();
  const categories=useLoad(getAdminCategories,'admin-categories'),products=useLoad(getActiveProducts,'active-products');
  const [value,setValue]=useState<DesignValue>({title:'',description:'',interest:'',niche:'',tags:[],productIds:[]});
  const [file,setFile]=useState<File|null>(null),[busy,setBusy]=useState(''),[error,setError]=useState('');
  // All active products are checked by default
  useEffect(()=>{if(products.data)setValue(v=>({...v,productIds:products.data!.map(p=>p.product_id)}))},[products.data]);

  async function save(status:'draft'|'published'){
    if(!file){setError('Choose an image first.');return}
    const problem=imageProblem(file);
    if(problem){setError(problem);return}
    if(!value.title.trim()){setError('Enter a title.');return}
    if(!value.interest){setError('Choose an interest.');return}
    if(value.productIds.length===0){setError('Choose at least one product.');return}
    const form=new FormData();
    form.append('image',file);
    form.append('title',value.title.trim());
    if(value.description.trim())form.append('description',value.description.trim());
    form.append('category_id',value.niche||value.interest); // the niche if chosen, else the interest
    form.append('tags',value.tags.join(','));
    form.append('product_ids',value.productIds.join(','));
    form.append('status',status);
    setBusy(status);setError('');
    try{await createDesign(form);router.push('/admin/designs')}
    catch(e){if(!sessionEnded(e))setError(errMsg(e));setBusy('')}
  }

  return <>
    <Link className="adm-light" href="/admin/designs" style={{marginBottom:16,display:'inline-flex'}}><ArrowLeft size={15}/> All designs</Link>
    {!categories.data||!products.data?<LoadState error={categories.error||products.error} retry={()=>{categories.retry();products.retry()}}/>:
    <form className="adm-dashgrid" onSubmit={e=>{e.preventDefault();save('draft')}}>
      <section className="adm-panel"><h2>New design</h2>
        <DesignFields value={value} onChange={setValue} categories={categories.data} products={products.data} disabled={!!busy}/>
      </section>
      <div className="adm-stack">
        <section className="adm-panel"><h2>Image *</h2><ImageDrop file={file} onFile={f=>{setFile(f);setError('')}} disabled={!!busy}/></section>
        <section className="adm-panel">
          {error&&<div className="adm-error" style={{marginBottom:12}}>{error}</div>}
          {busy&&<p className="adm-muted" style={{marginTop:0}}>Uploading…</p>}
          <div className="adm-rowactions"><button className="adm-light" type="submit" disabled={!!busy}>Save as draft</button><button className="adm-purple" type="button" disabled={!!busy} onClick={()=>save('published')}>Save and publish</button></div>
        </section>
      </div>
    </form>}
  </>;
}

// ---------------------------------------------------------------- Edit design

function EditDesign({me,code}:{me:ApiMe;code:string}){
  const a=useLoad(()=>getAdminDesign(code),'admin-design|'+code),categories=useLoad(getAdminCategories,'admin-categories');
  return <>
    <Link className="adm-light" href="/admin/designs" style={{marginBottom:16,display:'inline-flex'}}><ArrowLeft size={15}/> All designs</Link>
    {!a.data||!categories.data?<LoadState error={a.error||categories.error} retry={()=>{a.retry();categories.retry()}}/>:
      <EditForm key={a.data.public_design_code} first={a.data} categories={categories.data} manage={can(me,'designs.manage')}/>}
  </>;
}

function valueOf(d:ApiAdminDesign):DesignValue{
  const parent=d.category.parent;
  return {
    title:d.title,description:d.description||'',
    interest:String(parent?parent.category_id:d.category.category_id??''),
    niche:parent?String(d.category.category_id):'',
    tags:d.tags,productIds:d.products.filter(p=>p.is_enabled).map(p=>p.product_id),
  };
}

function EditForm({first,categories,manage}:{first:ApiAdminDesign;categories:ApiAdminCategory[];manage:boolean}){
  const [design,setDesign]=useState(first),[value,setValue]=useState(valueOf(first));
  const [busy,setBusy]=useState(''),[error,setError]=useState(''),[saved,setSaved]=useState('');
  const input=useRef<HTMLInputElement>(null);
  const code=design.public_design_code,moves=MOVES[design.design_status]||[];
  async function run(name:string,job:()=>Promise<ApiAdminDesign>,done:string){
    setBusy(name);setError('');setSaved('');
    try{const d=await job();setDesign(d);setSaved(done);return d}
    catch(e){if(!sessionEnded(e))setError(errMsg(e))}finally{setBusy('')}
  }
  async function save(e:React.FormEvent){
    e.preventDefault();
    if(!value.title.trim()){setError('Enter a title.');return}
    if(!value.interest){setError('Choose an interest.');return}
    const d=await run('save',()=>updateDesign(code,{title:value.title.trim(),description:value.description.trim(),category_id:Number(value.niche||value.interest),tags:value.tags,product_ids:value.productIds}),'Saved.');
    if(d)setValue(valueOf(d));
  }
  async function replace(f:File|undefined){
    if(!f)return;
    const problem=imageProblem(f);
    if(problem){setError(problem);setSaved('');return}
    if(!window.confirm('Replace the image of this design with "'+f.name+'"? It goes live right away.'))return;
    await run('image',()=>replaceDesignImage(code,f),'Image replaced.');
  }
  async function move(newStatus:string){
    if(newStatus==='archived'&&!window.confirm('Archive this design? It will only be listed under the Archived tab.'))return;
    await run('status',()=>setDesignStatus(code,newStatus),'Status changed to '+label(newStatus).toLowerCase()+'.');
  }
  const info:[string,React.ReactNode][]=[
    ['Status',<DesignBadge key="s" status={design.design_status}/>],
    ['Source',<span key="o"><SourceBadge source={design.source_platform}/>{design.source_reference&&<span className="adm-muted"> {design.source_reference}</span>}</span>],
    ['Created',when(design.created_at)],['First published',when(design.first_published_at)],
    ['Times ordered',design.times_ordered],['Uploaded by',design.uploaded_by||'—'],
    ['Image',design.image.mime_type?design.image.mime_type+(design.image.file_size_bytes?' · '+(design.image.file_size_bytes/1024/1024).toFixed(2)+' MB':''):'—'],
    ['Design code',code],
  ];
  return <form className="adm-dashgrid" onSubmit={save}>
    <section className="adm-panel"><h2>{manage?'Edit design':'Design'}</h2>
      <DesignFields value={value} onChange={setValue} categories={categories} products={design.products} disabled={!manage||!!busy}/>
      {manage&&<div style={{marginTop:18}}><button className="adm-purple" type="submit" disabled={!!busy}>{busy==='save'?'Saving…':'Save changes'}</button></div>}
    </section>
    <div className="adm-stack">
      <section className="adm-panel"><h2>Image</h2>
        <div className="adm-checker">{design.preview_url?<img src={imageUrl(design.preview_url)!} alt={design.title}/>:<span className="adm-muted">No image</span>}</div>
        {manage&&<><input ref={input} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={e=>{replace(e.target.files?.[0]);e.target.value=''}}/>
          <button type="button" className="adm-light" style={{marginTop:12}} disabled={!!busy} onClick={()=>input.current?.click()}>{busy==='image'?'Uploading…':'Replace image'}</button></>}
      </section>
      {manage&&moves.length>0&&<section className="adm-panel"><h2>Status</h2><div className="adm-rowactions">{moves.map(m=><button key={m} type="button" className={m==='published'?'adm-purple':'adm-light'} disabled={!!busy} onClick={()=>move(m)}>{MOVE_LABEL[m]}</button>)}</div></section>}
      {(error||saved)&&<section className="adm-panel">{error&&<div className="adm-error">{error}</div>}{saved&&<div className="adm-notice" style={{margin:0}}>{saved}</div>}</section>}
      <section className="adm-panel"><h2>Details</h2><div className="adm-fieldsview">{info.map(([k,v])=><div key={k}><small>{k}</small><strong>{v}</strong></div>)}</div></section>
    </div>
  </form>;
}
