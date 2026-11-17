'use client';
// Admin sections that are connected to the backend: Dashboard, Orders, Users & Roles, Shipping countries.
// The backend checks every permission; the checks here only decide what is shown.
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {ArrowLeft,ArrowRight,ChevronLeft,ChevronRight,Search,X,Plus,Pencil,Trash2,ShoppingBag,Package,Shirt,Users,BarChart3,Clock} from 'lucide-react';
import {
  ApiError,imageUrl,
  getAdminStats,getAdminOrders,getAdminOrder,changeOrderStatus,markOrderPaid,
  getAdminUsers,createAdminUser,setUserRoles,setUserDisabled,
  getAdminRoles,getAdminPermissions,createRole,updateRole,deleteRole,
  getCountrySettings,setCountryShipping,
  type ApiMe,type ApiAdminOrder,type ApiAdminUser,type ApiAdminRole,type ApiPermissionModule,
} from '@/lib/api';

export const can=(me:ApiMe,permission:string)=>me.permissions.includes(permission);
const money=(n:string|number)=>'$'+Number(n).toFixed(2);
const errMsg=(e:unknown)=>e instanceof Error?e.message:String(e);
const when=(s?:string|null)=>s?new Date(s).toLocaleString():'—';
const label=(s:string)=>s.replace(/_/g,' ').replace(/^./,c=>c.toUpperCase());

// A 401 means the login ended: go back to the admin login
function sessionEnded(e:unknown){
  if(e instanceof ApiError&&e.status===401){window.location.assign('/admin-login');return true}
  return false;
}

// Loads data when `key` changes; retry() loads it again
function useLoad<T>(load:()=>Promise<T>,key:string){
  const [data,setData]=useState<T|null>(null),[error,setError]=useState(''),[tick,setTick]=useState(0);
  useEffect(()=>{
    let live=true;setData(null);setError('');
    load().then(r=>{if(live)setData(r)}).catch(e=>{if(live&&!sessionEnded(e))setError(errMsg(e))});
    return()=>{live=false};
  },[key,tick]);
  return {data,setData,error,retry:()=>setTick(t=>t+1)};
}
function LoadState({error,retry}:{error:string;retry:()=>void}){
  return error?<div className="adm-error">{error} <button className="adm-light" onClick={retry}>Retry</button></div>:<p className="adm-muted">Loading…</p>;
}

export function StatusPill({status}:{status:string}){
  const s=status.toLowerCase();
  const cls=/cancel|refund|suspend|disabled|closed|fail/.test(s)?'red'
    :/^(unpaid|payment_pending|pending)/.test(s)?'orange'
    :/delivered|paid|active|enabled|success|confirmed/.test(s)?'green'
    :/shipped|printing|quality|packed/.test(s)?'blue':'purple';
  return <span className={'adm-pill '+cls}>{label(status)}</span>;
}

function Modal({title,onClose,children}:{title:string;onClose:()=>void;children:React.ReactNode}){
  return <div className="adm-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}>
    <div className="adm-modal"><div className="adm-modalhead"><h2>{title}</h2><button onClick={onClose} aria-label="Close"><X size={20}/></button></div>{children}</div>
  </div>;
}

function Thumb({url,title}:{url:string|null;title:string}){
  return <div className="adm-thumb">{url?<img src={imageUrl(url)!} alt={title}/>:<Shirt size={20}/>}</div>;
}

// ---------------------------------------------------------------- Dashboard

export function DashboardPanel(){
  const a=useLoad(getAdminStats,'stats');
  if(!a.data)return <LoadState error={a.error} retry={a.retry}/>;
  const s=a.data;
  const cards:[string,string|number,string,React.ReactNode][]=[
    ['Orders today',s.orders_today,'blue',<Clock key="a"/>],
    ['Total orders',s.orders_total,'purple',<ShoppingBag key="b"/>],
    ...(s.revenue_total!==null?[['Revenue',money(s.revenue_total),'green',<BarChart3 key="c"/>] as [string,string,string,React.ReactNode]]:[]),
    ['Published designs',s.designs_published,'amber',<Package key="d"/>],
    ['Customers',s.customers_total,'red',<Users key="e"/>],
  ];
  const statuses=Object.entries(s.orders_by_status);
  const max=Math.max(1,...statuses.map(([,n])=>n));
  return <>
    <div className="adm-stats">{cards.map(([name,value,color,icon])=><div className="adm-stat" key={name}><div className={'adm-stat-icon '+color}>{icon}</div><div><small>{name}</small><strong>{value}</strong></div></div>)}</div>
    <div className="adm-dashgrid">
      <section className="adm-panel"><h2>Recent orders</h2>
        {s.recent_orders.length===0?<p className="adm-muted">No orders yet.</p>:<div className="adm-scroll"><table className="adm-table"><thead><tr><th>Order</th><th>Customer</th><th>Date</th><th>Total</th><th>Status</th></tr></thead><tbody>
          {s.recent_orders.map(o=><tr key={o.order_public_code}><td><b>{o.order_public_code}</b></td><td>{o.customer}</td><td>{when(o.placed_at)}</td><td>{money(o.order_total)}</td><td><StatusPill status={o.order_status}/></td></tr>)}
        </tbody></table></div>}
        <Link href="/admin/orders" className="adm-link">View all orders <ArrowRight size={15}/></Link>
      </section>
      <section className="adm-panel"><h2>Orders by status</h2>
        {statuses.map(([status,n])=><div className="adm-progressrow" key={status}><div><b>{label(status)}</b><span>{n}</span></div><div><span style={{width:(n/max*100)+'%'}}/></div></div>)}
      </section>
    </div>
  </>;
}

// ---------------------------------------------------------------- Orders

const STATUS_TABS:[string,string][]=[['','All'],['payment_pending','Payment pending'],['confirmed','Confirmed'],['printing','Printing'],['quality_check','Quality check'],['packed','Packed'],['shipped','Shipped'],['delivered','Delivered'],['cancelled','Cancelled'],['refunded','Refunded']];
// Allowed status moves (the backend checks them again)
const MOVES:Record<string,string[]>={payment_pending:['confirmed','cancelled'],confirmed:['printing','cancelled'],printing:['quality_check'],quality_check:['packed','printing'],packed:['shipped'],shipped:['delivered']};
const PER_PAGE=20;

export function OrdersPanel({me}:{me:ApiMe}){
  const [code,setCode]=useState(''),[status,setStatus]=useState(''),[search,setSearch]=useState(''),[page,setPage]=useState(1);
  if(code)return <OrderDetail me={me} code={code} onBack={()=>setCode('')}/>;
  return <OrdersList status={status} setStatus={setStatus} search={search} setSearch={setSearch} page={page} setPage={setPage} onOpen={setCode}/>;
}

function OrdersList({status,setStatus,search,setSearch,page,setPage,onOpen}:{status:string;setStatus:(s:string)=>void;search:string;setSearch:(s:string)=>void;page:number;setPage:(n:number)=>void;onOpen:(code:string)=>void}){
  const [q,setQ]=useState(search);
  const a=useLoad(()=>getAdminOrders({status,search,limit:PER_PAGE,offset:(page-1)*PER_PAGE}),'orders|'+status+'|'+search+'|'+page);
  const pages=a.data?Math.max(1,Math.ceil(a.data.total/PER_PAGE)):1;
  return <section className="adm-table-panel">
    <div className="adm-tabs">{STATUS_TABS.map(([value,name])=><button key={value} className={status===value?'active':''} onClick={()=>{setStatus(value);setPage(1)}}>{name}</button>)}</div>
    <form className="adm-table-tools" onSubmit={e=>{e.preventDefault();setSearch(q.trim());setPage(1)}}>
      <div className="adm-search"><Search size={16}/><input placeholder="Search by order number or email..." value={q} onChange={e=>setQ(e.target.value)}/></div>
      <button className="adm-purple" type="submit">Search</button>
      {(search||status)&&<button className="adm-light" type="button" onClick={()=>{setQ('');setSearch('');setStatus('');setPage(1)}}>Reset</button>}
    </form>
    {!a.data?<LoadState error={a.error} retry={a.retry}/>:<>
      <div className="adm-resultcount">{a.data.total} {a.data.total===1?'order':'orders'}</div>
      {a.data.items.length===0?<div className="adm-empty">No orders match these filters.</div>:<div className="adm-scroll"><table className="adm-table"><thead><tr><th>Order</th><th>Date</th><th>Customer</th><th>Items</th><th>Total</th><th>Payment</th><th>Status</th><th></th></tr></thead><tbody>
        {a.data.items.map(o=><tr key={o.order_public_code}><td><b>{o.order_public_code}</b></td><td>{when(o.placed_at)}</td><td>{o.customer_name||o.contact_email}</td><td>{o.item_count}</td><td>{money(o.order_total)}</td><td><StatusPill status={o.payment_status}/></td><td><StatusPill status={o.order_status}/></td><td><button className="adm-light" onClick={()=>onOpen(o.order_public_code)}>View</button></td></tr>)}
      </tbody></table></div>}
      {pages>1&&<div className="adm-table-footer"><span>Page {page} of {pages}</span><div><button disabled={page<=1} onClick={()=>setPage(page-1)} aria-label="Previous page"><ChevronLeft size={16}/></button><b>{page}</b><button disabled={page>=pages} onClick={()=>setPage(page+1)} aria-label="Next page"><ChevronRight size={16}/></button></div></div>}
    </>}
  </section>;
}

function OrderDetail({me,code,onBack}:{me:ApiMe;code:string;onBack:()=>void}){
  const a=useLoad(()=>getAdminOrder(code),'order|'+code);
  const o=a.data;
  return <>
    <button className="adm-light" onClick={onBack} style={{marginBottom:16}}><ArrowLeft size={15}/> All orders</button>
    {!o?<LoadState error={a.error} retry={a.retry}/>:<>
      <div className="adm-orderhead"><h2>{o.order_public_code}</h2><StatusPill status={o.order_status}/><StatusPill status={o.payment_status}/><span className="adm-muted">Placed {when(o.placed_at)}</span></div>
      <div className="adm-dashgrid">
        <div className="adm-stack">
          <section className="adm-panel"><h2>Items</h2>
            <div className="adm-scroll"><table className="adm-table"><thead><tr><th>Item</th><th>Options</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead><tbody>
              {o.items.map((x,i)=><tr key={i}><td><div className="adm-itemcell"><Thumb url={x.preview_url} title={x.title}/><span>{x.title}</span></div></td><td>{[x.color_name,x.size_code].filter(Boolean).join(' / ')||'—'}</td><td>{x.quantity}</td><td>{money(x.unit_price)}</td><td>{money(x.line_total)}</td></tr>)}
            </tbody></table></div>
            <div className="adm-totals">
              <div className="adm-line"><span>Subtotal</span><b>{money(o.item_subtotal)}</b></div>
              {Number(o.discount_total)>0&&<div className="adm-line"><span>{o.discount_name||'Discount'}</span><b>-{money(o.discount_total)}</b></div>}
              <div className="adm-line"><span>Shipping</span><b>{Number(o.shipping_total)===0?'FREE':money(o.shipping_total)}</b></div>
              <div className="adm-line"><span>Tax</span><b>{money(o.tax_total)}</b></div>
              <div className="adm-line total"><span>Total</span><b>{money(o.order_total)}</b></div>
            </div>
          </section>
          <section className="adm-panel"><h2>Payments</h2>
            {o.payments.length===0?<p className="adm-muted">No payments recorded.</p>:<div className="adm-scroll"><table className="adm-table"><thead><tr><th>Reference</th><th>Type</th><th>Provider</th><th>Amount</th><th>Status</th><th>Processed</th></tr></thead><tbody>
              {o.payments.map(p=><tr key={p.payment_public_code}><td>{p.payment_public_code}</td><td>{label(p.action_type)}</td><td>{p.provider_code}</td><td>{money(p.amount)} {p.currency_code}</td><td><StatusPill status={p.payment_status}/></td><td>{when(p.processed_at)}</td></tr>)}
            </tbody></table></div>}
          </section>
          <section className="adm-panel"><h2>Status history</h2>
            <div className="adm-history">{o.status_history.map((h,i)=><div key={i}><div><StatusPill status={h.status_code}/> <span className="adm-muted">{when(h.changed_at)}{h.changed_by_name?' · '+h.changed_by_name:''}</span>{!h.is_customer_visible&&<span className="adm-pill purple" style={{marginLeft:8}}>Hidden from customer</span>}</div>{h.status_message&&<p>{h.status_message}</p>}</div>)}</div>
          </section>
        </div>
        <div className="adm-stack">
          <OrderActions me={me} order={o} onUpdated={a.setData}/>
          <section className="adm-panel"><h2>Customer</h2>
            <p className="adm-muted" style={{margin:0}}>{o.customer?<>{o.customer.full_name}<br/>{o.customer.email}</>:'Guest order'}<br/>Contact: {o.contact_email}</p>
          </section>
          <section className="adm-panel"><h2>Shipping address</h2>
            {o.shipping_address?<p className="adm-muted" style={{margin:0}}>{o.shipping_address.recipient_name}<br/>{o.shipping_address.line_1}{o.shipping_address.line_2&&<><br/>{o.shipping_address.line_2}</>}<br/>{o.shipping_address.city}, {o.shipping_address.state_region} {o.shipping_address.postal_code}<br/>{o.shipping_address.country_code}<br/>{o.shipping_address.phone_number}</p>:<p className="adm-muted">No address.</p>}
          </section>
        </div>
      </div>
    </>}
  </>;
}

function OrderActions({me,order,onUpdated}:{me:ApiMe;order:ApiAdminOrder;onUpdated:(o:ApiAdminOrder)=>void}){
  const moves=MOVES[order.order_status]||[];
  const [next,setNext]=useState(moves[0]||''),[message,setMessage]=useState(''),[visible,setVisible]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState('');
  useEffect(()=>{setNext((MOVES[order.order_status]||[])[0]||'');setMessage('');setError('')},[order.order_status]);
  const manage=can(me,'orders.manage'),canPay=can(me,'finance.manage')&&order.payment_status==='unpaid';
  if(!manage&&!canPay)return null;
  async function run(job:()=>Promise<ApiAdminOrder>){
    setBusy(true);setError('');
    try{onUpdated(await job())}catch(e){if(!sessionEnded(e))setError(errMsg(e))}finally{setBusy(false)}
  }
  function submit(e:React.FormEvent){
    e.preventDefault();
    if(!next)return;
    if(next==='cancelled'&&!window.confirm('Cancel order '+order.order_public_code+'? This cannot be undone.'))return;
    run(()=>changeOrderStatus(order.order_public_code,{new_status:next,message:message.trim()||undefined,customer_visible:visible}));
  }
  return <section className="adm-panel"><h2>Update order</h2>
    {manage&&(moves.length>0?<form className="adm-form" onSubmit={submit}>
      <label>Next status<select value={next} onChange={e=>setNext(e.target.value)}>{moves.map(m=><option key={m} value={m}>{label(m)}</option>)}</select></label>
      <label>Message (optional)<input type="text" maxLength={250} value={message} onChange={e=>setMessage(e.target.value)} placeholder="Shown in the order history"/></label>
      <label className="adm-check"><input type="checkbox" checked={visible} onChange={e=>setVisible(e.target.checked)}/> Visible to customer</label>
      <button className="adm-purple" type="submit" disabled={busy}>{busy?'Saving…':'Update status'}</button>
    </form>:<p className="adm-muted">No further status changes are possible.</p>)}
    {canPay&&<button className="adm-light" style={{marginTop:manage?14:0}} disabled={busy} onClick={()=>{if(window.confirm('Mark order '+order.order_public_code+' as paid?'))run(()=>markOrderPaid(order.order_public_code))}}>Mark as paid</button>}
    {error&&<div className="adm-error" style={{marginTop:14}}>{error}</div>}
  </section>;
}

// ---------------------------------------------------------------- Users & Roles

export function UsersRolesPanel({me}:{me:ApiMe}){
  const [tab,setTab]=useState<'users'|'roles'>('users');
  return <>
    <div className="adm-tabs" style={{background:'#fff',padding:'0 14px',borderRadius:10}}>
      <button className={tab==='users'?'active':''} onClick={()=>setTab('users')}>Users</button>
      <button className={tab==='roles'?'active':''} onClick={()=>setTab('roles')}>Roles</button>
    </div>
    {tab==='users'?<UsersTab me={me}/>:<RolesTab me={me}/>}
  </>;
}

// Role checkboxes used when adding a user or changing a user's roles
function RolePicker({roles,value,onChange}:{roles:ApiAdminRole[];value:string[];onChange:(v:string[])=>void}){
  return <div className="adm-rolepicker">{roles.map(r=><label className="adm-check" key={r.role_code}><input type="checkbox" checked={value.includes(r.role_code)} onChange={e=>onChange(e.target.checked?[...value,r.role_code]:value.filter(x=>x!==r.role_code))}/> <span><b>{r.role_name}</b>{r.description&&<small>{r.description}</small>}</span></label>)}</div>;
}

function UsersTab({me}:{me:ApiMe}){
  const [q,setQ]=useState(''),[search,setSearch]=useState('');
  const users=useLoad(()=>getAdminUsers(search),'users|'+search);
  const roles=useLoad(getAdminRoles,'roles-for-users');
  const [modal,setModal]=useState<'add'|ApiAdminUser|null>(null),[busyId,setBusyId]=useState(0),[error,setError]=useState('');
  const manage=can(me,'users.manage');
  // Staff roles that this admin may hand out (only a Super Admin can give the admin role)
  const givable=(roles.data||[]).filter(r=>r.is_staff&&(r.role_code!=='admin'||me.is_super_admin));
  const replace=(u:ApiAdminUser)=>users.setData(list=>list&&list.map(x=>x.user_id===u.user_id?u:x));
  async function toggle(u:ApiAdminUser){
    const disable=u.account_status==='active';
    if(!window.confirm((disable?'Disable ':'Enable ')+u.full_name+'?'+(disable?' They will be signed out everywhere.':'')))return;
    setBusyId(u.user_id);setError('');
    try{replace(await setUserDisabled(u.user_id,disable))}catch(e){if(!sessionEnded(e))setError(errMsg(e))}finally{setBusyId(0)}
  }
  return <section className="adm-table-panel" style={{marginTop:16}}>
    <form className="adm-table-tools" onSubmit={e=>{e.preventDefault();setSearch(q.trim())}}>
      <div className="adm-search"><Search size={16}/><input placeholder="Search by name or email..." value={q} onChange={e=>setQ(e.target.value)}/></div>
      <button className="adm-light" type="submit">Search</button>
      {manage&&<button className="adm-purple" type="button" onClick={()=>setModal('add')}><Plus size={16}/> Add user</button>}
    </form>
    {error&&<div className="adm-error" style={{marginTop:14}}>{error}</div>}
    {!users.data?<LoadState error={users.error} retry={users.retry}/>:users.data.length===0?<div className="adm-empty">No users found.</div>:<div className="adm-scroll" style={{marginTop:16}}><table className="adm-table"><thead><tr><th>Name</th><th>Email</th><th>Roles</th><th>Status</th><th>Last login</th>{manage&&<th></th>}</tr></thead><tbody>
      {users.data.map(u=><tr key={u.user_id}><td><b>{u.full_name}</b></td><td>{u.email}</td><td>{u.roles.length?u.roles.map(r=><span key={r.role_code} className="adm-pill purple" style={{marginRight:4}}>{r.role_name}</span>):<span className="adm-muted">None</span>}</td><td><StatusPill status={u.account_status}/></td><td>{when(u.last_login_at)}</td>
        {manage&&<td><div className="adm-rowactions"><button className="adm-light" onClick={()=>setModal(u)}><Pencil size={14}/> Roles</button>{u.account_status==='active'?<button className="adm-light" disabled={busyId===u.user_id} onClick={()=>toggle(u)}>Disable</button>:/^(suspended|disabled)$/.test(u.account_status)&&<button className="adm-light" disabled={busyId===u.user_id} onClick={()=>toggle(u)}>Enable</button>}</div></td>}
      </tr>)}
    </tbody></table></div>}
    {modal==='add'&&<AddUserModal roles={givable} onClose={()=>setModal(null)} onSaved={u=>{users.setData(list=>list?[u,...list]:[u]);setModal(null)}}/>}
    {modal&&modal!=='add'&&<EditRolesModal user={modal} roles={givable} onClose={()=>setModal(null)} onSaved={u=>{replace(u);setModal(null)}}/>}
  </section>;
}

function AddUserModal({roles,onClose,onSaved}:{roles:ApiAdminRole[];onClose:()=>void;onSaved:(u:ApiAdminUser)=>void}){
  const [name,setName]=useState(''),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[picked,setPicked]=useState<string[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState('');
  async function submit(e:React.FormEvent){
    e.preventDefault();
    if(password.length<12){setError('The temporary password needs at least 12 characters.');return}
    if(picked.length===0){setError('Choose at least one role.');return}
    setBusy(true);setError('');
    try{onSaved(await createAdminUser({full_name:name.trim(),email:email.trim(),password,roles:picked}))}catch(err){if(!sessionEnded(err))setError(errMsg(err))}finally{setBusy(false)}
  }
  return <Modal title="Add user" onClose={onClose}><form className="adm-form" onSubmit={submit}>
    <label>Full name<input type="text" required maxLength={150} value={name} onChange={e=>setName(e.target.value)}/></label>
    <label>Email<input type="email" required maxLength={320} value={email} onChange={e=>setEmail(e.target.value)}/></label>
    <label>Temporary password<input type="password" required minLength={12} maxLength={128} autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="At least 12 characters"/></label>
    <div><b style={{fontSize:12}}>Roles</b><RolePicker roles={roles} value={picked} onChange={setPicked}/></div>
    {error&&<div className="adm-error">{error}</div>}
    <div className="adm-modalactions"><button type="button" className="adm-light" onClick={onClose}>Cancel</button><button className="adm-purple" type="submit" disabled={busy}>{busy?'Saving…':'Create user'}</button></div>
  </form></Modal>;
}

function EditRolesModal({user,roles,onClose,onSaved}:{user:ApiAdminUser;roles:ApiAdminRole[];onClose:()=>void;onSaved:(u:ApiAdminUser)=>void}){
  const [picked,setPicked]=useState(user.roles.map(r=>r.role_code)),[busy,setBusy]=useState(false),[error,setError]=useState('');
  // Keep roles the user already has even if this admin could not hand them out themselves
  const shown=[...roles,...user.roles.filter(r=>!roles.some(x=>x.role_code===r.role_code)).map(r=>({role_code:r.role_code,role_name:r.role_name,description:null,is_system:false,is_staff:true,permissions:[],user_count:0}))];
  async function submit(e:React.FormEvent){
    e.preventDefault();setBusy(true);setError('');
    try{onSaved(await setUserRoles(user.user_id,picked))}catch(err){if(!sessionEnded(err))setError(errMsg(err))}finally{setBusy(false)}
  }
  return <Modal title={'Roles for '+user.full_name} onClose={onClose}><form className="adm-form" onSubmit={submit}>
    <RolePicker roles={shown} value={picked} onChange={setPicked}/>
    {error&&<div className="adm-error">{error}</div>}
    <div className="adm-modalactions"><button type="button" className="adm-light" onClick={onClose}>Cancel</button><button className="adm-purple" type="submit" disabled={busy}>{busy?'Saving…':'Save roles'}</button></div>
  </form></Modal>;
}

function RolesTab({me}:{me:ApiMe}){
  const a=useLoad(getAdminRoles,'roles');
  const [modal,setModal]=useState<'new'|ApiAdminRole|null>(null),[error,setError]=useState('');
  const superAdmin=me.is_super_admin;
  async function remove(r:ApiAdminRole){
    if(!window.confirm('Delete the role "'+r.role_name+'"?'))return;
    setError('');
    try{await deleteRole(r.role_code);a.setData(list=>list&&list.filter(x=>x.role_code!==r.role_code))}catch(e){if(!sessionEnded(e))setError(errMsg(e))}
  }
  function saved(r:ApiAdminRole){
    a.setData(list=>{if(!list)return [r];return list.some(x=>x.role_code===r.role_code)?list.map(x=>x.role_code===r.role_code?r:x):[...list,r]});
    setModal(null);
  }
  return <section className="adm-table-panel" style={{marginTop:16}}>
    <div className="adm-table-tools"><span className="adm-muted" style={{flex:1}}>{superAdmin?'Roles decide which admin sections and actions a user can use.':'Only a Super Admin can create, edit or delete roles.'}</span>{superAdmin&&<button className="adm-purple" onClick={()=>setModal('new')}><Plus size={16}/> New role</button>}</div>
    {error&&<div className="adm-error" style={{marginTop:14}}>{error}</div>}
    {!a.data?<LoadState error={a.error} retry={a.retry}/>:<div className="adm-scroll" style={{marginTop:16}}><table className="adm-table"><thead><tr><th>Role</th><th>Description</th><th>Users</th><th>Permissions</th>{superAdmin&&<th></th>}</tr></thead><tbody>
      {a.data.map(r=><tr key={r.role_code}>
        <td><b>{r.role_name}</b><br/><small className="adm-muted">{r.role_code}{r.is_system&&' · system role'}</small></td>
        <td style={{whiteSpace:'normal',maxWidth:260}}>{r.description||'—'}</td>
        <td>{r.user_count}</td>
        <td style={{whiteSpace:'normal',maxWidth:340}}>{r.permissions.length===0?<span className="adm-muted">None</span>:<>{r.permissions.slice(0,5).map(p=><span key={p} className="adm-pill purple" style={{marginRight:4,display:'inline-block',marginBottom:4}}>{p}</span>)}{r.permissions.length>5&&<span className="adm-muted"> +{r.permissions.length-5} more</span>}</>}</td>
        {superAdmin&&<td>{r.is_system?<span className="adm-muted">Read-only</span>:<div className="adm-rowactions"><button className="adm-light" onClick={()=>setModal(r)}><Pencil size={14}/> Edit</button><button className="adm-light" onClick={()=>remove(r)}><Trash2 size={14}/> Delete</button></div>}</td>}
      </tr>)}
    </tbody></table></div>}
    {modal&&<RoleFormModal role={modal==='new'?null:modal} onClose={()=>setModal(null)} onSaved={saved}/>}
  </section>;
}

function RoleFormModal({role,onClose,onSaved}:{role:ApiAdminRole|null;onClose:()=>void;onSaved:(r:ApiAdminRole)=>void}){
  const modules=useLoad(getAdminPermissions,'permissions');
  const [name,setName]=useState(role?.role_name||''),[code,setCode]=useState(''),[description,setDescription]=useState(role?.description||''),[selected,setSelected]=useState<string[]>(role?.permissions||[]),[busy,setBusy]=useState(false),[error,setError]=useState('');
  // Ticking Manage also ticks View; unticking View also unticks Manage
  function toggle(m:ApiPermissionModule,perm:{permission_code:string;action:string},on:boolean){
    const view=m.permissions.find(x=>x.action==='view'),manage=m.permissions.find(x=>x.action==='manage');
    setSelected(list=>{
      const set=new Set(list);
      if(on){set.add(perm.permission_code);if(perm.action==='manage'&&view)set.add(view.permission_code)}
      else{set.delete(perm.permission_code);if(perm.action==='view'&&manage)set.delete(manage.permission_code)}
      return [...set];
    });
  }
  async function submit(e:React.FormEvent){
    e.preventDefault();
    if(!role&&!/^[a-z][a-z0-9_]{1,29}$/.test(code.trim())){setError('Code: 2–30 characters, lowercase letters, numbers and underscores, starting with a letter.');return}
    setBusy(true);setError('');
    try{
      const body={role_name:name.trim(),description:description.trim(),permissions:selected};
      onSaved(role?await updateRole(role.role_code,body):await createRole({role_code:code.trim(),...body}));
    }catch(err){if(!sessionEnded(err))setError(errMsg(err))}finally{setBusy(false)}
  }
  const cell=(m:ApiPermissionModule,action:string)=>{const p=m.permissions.find(x=>x.action===action);return p?<input type="checkbox" checked={selected.includes(p.permission_code)} onChange={e=>toggle(m,p,e.target.checked)} aria-label={m.module+' '+action}/>:<span className="adm-muted">—</span>};
  return <Modal title={role?'Edit role':'New role'} onClose={onClose}><form className="adm-form" onSubmit={submit}>
    <label>Name<input type="text" required maxLength={80} value={name} onChange={e=>setName(e.target.value)}/></label>
    {!role&&<label>Code<input type="text" required maxLength={30} value={code} onChange={e=>setCode(e.target.value)} placeholder="for example: support_agent"/></label>}
    <label>Description<input type="text" maxLength={250} value={description} onChange={e=>setDescription(e.target.value)}/></label>
    <div><b style={{fontSize:12}}>Permissions</b>
      {!modules.data?<LoadState error={modules.error} retry={modules.retry}/>:<div className="adm-scroll"><table className="adm-table adm-permgrid"><thead><tr><th>Module</th><th>View</th><th>Manage</th><th>Other</th></tr></thead><tbody>
        {modules.data.map(m=><tr key={m.module}><td><b>{label(m.module)}</b></td><td>{cell(m,'view')}</td><td>{cell(m,'manage')}</td><td>{m.permissions.filter(p=>p.action!=='view'&&p.action!=='manage').map(p=><label key={p.permission_code} className="adm-check"><input type="checkbox" checked={selected.includes(p.permission_code)} onChange={e=>toggle(m,p,e.target.checked)}/> {p.label}</label>)}</td></tr>)}
      </tbody></table></div>}
    </div>
    {error&&<div className="adm-error">{error}</div>}
    <div className="adm-modalactions"><button type="button" className="adm-light" onClick={onClose}>Cancel</button><button className="adm-purple" type="submit" disabled={busy||!modules.data}>{busy?'Saving…':'Save role'}</button></div>
  </form></Modal>;
}

// ---------------------------------------------------------------- Settings: shipping countries

export function CountriesPanel({me}:{me:ApiMe}){
  const a=useLoad(getCountrySettings,'countries');
  const [busy,setBusy]=useState(''),[error,setError]=useState('');
  const manage=can(me,'settings.manage');
  async function toggle(code:string,enabled:boolean){
    setBusy(code);setError('');
    try{const u=await setCountryShipping(code,enabled);a.setData(list=>list&&list.map(x=>x.code===u.code?u:x))}
    catch(e){if(!sessionEnded(e))setError(errMsg(e))}finally{setBusy('')}
  }
  return <section className="adm-panel" style={{marginBottom:18}}><h2>Shipping countries</h2>
    <p className="adm-muted" style={{marginTop:-8}}>Customers can only order to countries that are enabled. A country needs its states and cities loaded first.</p>
    {error&&<div className="adm-error" style={{marginBottom:12}}>{error}</div>}
    {!a.data?<LoadState error={a.error} retry={a.retry}/>:<div className="adm-scroll"><table className="adm-table"><thead><tr><th>Country</th><th>Code</th><th>Phone</th><th>States loaded</th><th>Shipping</th></tr></thead><tbody>
      {a.data.map(c=><tr key={c.code}><td><b>{c.name}</b></td><td>{c.code}</td><td>+{c.phone_code}</td><td>{c.states_count}</td><td>{manage
        ?<label className="adm-check" style={{margin:0}}><input type="checkbox" checked={c.is_shipping_enabled} disabled={busy===c.code} onChange={e=>toggle(c.code,e.target.checked)}/> {c.is_shipping_enabled?'Enabled':'Disabled'}</label>
        :<StatusPill status={c.is_shipping_enabled?'enabled':'disabled'}/>}</td></tr>)}
    </tbody></table></div>}
  </section>;
}
