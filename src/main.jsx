import React, {useMemo, useState, useEffect} from 'react';
import { createRoot } from 'react-dom/client';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import { Plus, Wallet, Target, ArrowUpCircle, PiggyBank, Trash2, Pencil, Download, Upload, Search, LayoutDashboard, ListChecks, Tags, X, Save, HardDrive, RotateCcw } from 'lucide-react';
import './styles.css';

const colors = ['#3b82f6','#22c55e','#ec4899','#facc15','#ef4444','#d946ef','#8b5cf6','#60a5fa','#14b8a6','#fb923c','#a3e635','#0f766e','#fb7185','#7dd3fc','#94a3b8'];
const monthKey = () => new Date().toISOString().slice(0,7);
const uid = () => Math.random().toString(36).slice(2,10);
const eur = v => new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR'}).format(Number(v||0));
const today = () => new Date().toISOString().slice(0,10);
const normalize = v => String(v ?? '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
const parseEuro = value => {
  let s = String(value ?? '').trim().replace(/[€\s]/g,'');
  if (!s) return 0;
  if (s.includes(',') && s.includes('.')) s = s.replace(/\./g,'').replace(',', '.');
  else if (s.includes(',')) s = s.replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
};
const normalizeDate = value => {
  const s = String(value ?? '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (m) {
    const y = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${y}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? today() : d.toISOString().slice(0,10);
};
function parseCsv(text){
  const rows=[]; let row=[]; let cur=''; let quoted=false;
  const delimiter = (text.split('\n')[0].match(/;/g)||[]).length > (text.split('\n')[0].match(/,/g)||[]).length ? ';' : ',';
  for(let i=0;i<text.length;i++){
    const ch=text[i], next=text[i+1];
    if(ch==='"' && quoted && next==='"'){ cur+='"'; i++; continue; }
    if(ch==='"'){ quoted=!quoted; continue; }
    if(ch===delimiter && !quoted){ row.push(cur); cur=''; continue; }
    if((ch==='\n'||ch==='\r') && !quoted){
      if(ch==='\r' && next==='\n') i++;
      row.push(cur); cur='';
      if(row.some(v=>String(v).trim()!=='')) rows.push(row.map(v=>String(v).trim()));
      row=[]; continue;
    }
    cur+=ch;
  }
  row.push(cur); if(row.some(v=>String(v).trim()!=='')) rows.push(row.map(v=>String(v).trim()));
  return rows;
}

const defaultCats = [
 ['Spesa',400],['Bar / Colazioni / Snack',250],['Asporto / Delivery',200],['Casa',160],['Affitto',114],['Bollette',85],['Trasporti',70],['Salute',50],['Shopping / Personale',50],['Tempo Libero',30],['Abbonamenti',25],['Rate / Finanziamenti',10],['Regali',10],['Viaggi',10],['Varie / Altro',10]
].map((c,i)=>({id:uid(),name:c[0],budget:c[1],type:'expense',color:colors[i%colors.length]}));
const defaultData = {categories: defaultCats, transactions:[
 {id:uid(),date:today(),description:'Stipendio',categoryId:'income',type:'income',amount:1950,notes:''},
 ...defaultCats.map((c,i)=>({id:uid(),date:today(),description:c.name,categoryId:c.id,type:'expense',amount:[387,240,200,150,114,80,60,48,40,25,20,6,2,0,0][i],notes:''}))
]};
function useStore(){ const [data,setData]=useState(()=>JSON.parse(localStorage.getItem('budgetflow')||'null')||defaultData); useEffect(()=>localStorage.setItem('budgetflow',JSON.stringify(data)),[data]); return [data,setData]; }
const backupFileName = () => `budgetflow-backup-${new Date().toISOString().slice(0,10)}.json`;
const readLastBackup = () => localStorage.getItem('budgetflow_last_backup') || '';
const daysFrom = iso => iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 86400000) : 999;
function downloadJsonBackup(data){
 const backup={app:'BudgetFlow',version:7,createdAt:new Date().toISOString(),data};
 const a=document.createElement('a');
 a.href=URL.createObjectURL(new Blob([JSON.stringify(backup,null,2)],{type:'application/json'}));
 a.download=backupFileName();
 a.click();
 localStorage.setItem('budgetflow_last_backup',new Date().toISOString());
}
function isValidBackup(obj){ return obj && obj.data && Array.isArray(obj.data.categories) && Array.isArray(obj.data.transactions); }
function App(){ const [data,setData]=useStore(); const [tab,setTab]=useState('dashboard'); const [month,setMonth]=useState(monthKey()); const [modal,setModal]=useState(null); const [lastBackup,setLastBackup]=useState(readLastBackup()); const [dismissBackup,setDismissBackup]=useState(false); const cats=data.categories; const tx=data.transactions.filter(t=>t.date?.startsWith(month)); const backupDue=daysFrom(lastBackup)>=7;
 const stats=useMemo(()=>{ const expenseCats=cats.filter(c=>c.type==='expense'); const budget=expenseCats.reduce((s,c)=>s+Number(c.budget||0),0); const income=tx.filter(t=>t.type==='income').reduce((s,t)=>s+Number(t.amount),0); const spent=tx.filter(t=>t.type==='expense').reduce((s,t)=>s+Number(t.amount),0); const byCat=expenseCats.map(c=>{const spent=tx.filter(t=>t.type==='expense'&&t.categoryId===c.id).reduce((s,t)=>s+Number(t.amount),0); return {...c,spent,diff:Number(c.budget||0)-spent,pct:c.budget?spent/c.budget*100:0,share:0}}).sort((a,b)=>b.spent-a.spent); byCat.forEach(c=>c.share=spent?c.spent/spent*100:0); return {budget,income,spent,remaining:budget-spent,balance:income-spent,byCat};},[cats,tx]);
 const saveCat = c => setData(d=>({...d,categories: c.id?d.categories.map(x=>x.id===c.id?c:x):[...d.categories,{...c,id:uid()}]}));
 const delCat = id => { if(confirm('Eliminare questa categoria?')) setData(d=>({...d,categories:d.categories.filter(c=>c.id!==id),transactions:d.transactions.filter(t=>t.categoryId!==id)})); };
 const saveTx = t => setData(d=>({...d,transactions: t.id?d.transactions.map(x=>x.id===t.id?t:x):[...d.transactions,{...t,id:uid()}]}));
 const delTx = id => { if(confirm('Eliminare questa transazione?')) setData(d=>({...d,transactions:d.transactions.filter(t=>t.id!==id)})); };
 const delManyTx = ids => { if(!ids.length) return; if(confirm(`Eliminare ${ids.length} transazioni selezionate?`)) setData(d=>({...d,transactions:d.transactions.filter(t=>!ids.includes(t.id))})); };
 const exportCsv=()=>{ const rows=[['Data','Descrizione','Categoria','Tipo','Importo','Note'],...data.transactions.map(t=>[t.date,t.description,cats.find(c=>c.id===t.categoryId)?.name||'Entrata',t.type,t.amount,t.notes])]; const csv=rows.map(r=>r.map(v=>`"${String(v??'').replaceAll('"','""')}"`).join(',')).join('\n'); const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'})); a.download='budgetflow-transazioni.csv'; a.click(); };
 const importCsv = async file => {
  if(!file) return;
  const text = await file.text();
  const rows = parseCsv(text);
  if(rows.length < 2){ alert('CSV vuoto o non valido.'); return; }
  const header = rows[0].map(normalize);
  const idx = names => names.map(normalize).map(n=>header.indexOf(n)).find(i=>i>=0);
  const dateI=idx(['data','date']);
  const descI=idx(['descrizione','description','nome','causale']);
  const catI=idx(['categoria','category']);
  const typeI=idx(['tipo','type','entrata uscita']);
  const amountI=idx(['importo','amount','valore','spesa']);
  const notesI=idx(['note','notes']);
  const budgetI=idx(['budget','budget mensile']);
  if(amountI===undefined){ alert('CSV non riconosciuto: serve una colonna Importo.'); return; }
  let imported=0, createdCats=0;
  setData(d=>{
    const categories=[...d.categories];
    const findOrCreateCat=(name,type,budget)=>{
      if(type==='income') return 'income';
      const clean=(name||'Varie / Altro').trim() || 'Varie / Altro';
      let cat=categories.find(c=>normalize(c.name)===normalize(clean));
      if(!cat){ cat={id:uid(),name:clean,budget:Number(budget||0),type:'expense',color:colors[categories.length%colors.length]}; categories.push(cat); createdCats++; }
      else if(budgetI!==undefined && budget) cat={...cat,budget:Number(budget)} , categories[categories.findIndex(c=>c.id===cat.id)] = cat;
      return cat.id;
    };
    const transactions=[];
    rows.slice(1).forEach(r=>{
      const amount=parseEuro(r[amountI]);
      if(!amount) return;
      const rawType=normalize(typeI!==undefined?r[typeI]:'');
      const categoryName=catI!==undefined?r[catI]:'';
      const type = rawType.includes('entr') || rawType==='income' || normalize(categoryName).includes('entr') || amount < 0 && rawType.includes('accredit') ? 'income' : 'expense';
      const absAmount=Math.abs(amount);
      transactions.push({id:uid(),date:normalizeDate(dateI!==undefined?r[dateI]:today()),description:(descI!==undefined?r[descI]:'Importazione CSV')||'Importazione CSV',categoryId:findOrCreateCat(categoryName,type, budgetI!==undefined?parseEuro(r[budgetI]):0),type,amount:absAmount,notes:notesI!==undefined?r[notesI]:''});
      imported++;
    });
    return {...d,categories,transactions:[...d.transactions,...transactions]};
  });
  alert(`Import completato: ${imported} transazioni importate${createdCats?`, ${createdCats} categorie create`:''}.`);
 };
 const exportBackup=()=>{ downloadJsonBackup(data); setLastBackup(readLastBackup()); alert('Backup creato. Su iPhone scegli Salva su File e seleziona iCloud Drive > BudgetFlow.'); };
 const importBackup=async file=>{ if(!file) return; try{ const obj=JSON.parse(await file.text()); if(!isValidBackup(obj)){ alert('File backup non riconosciuto.'); return; } if(confirm('Ripristinare questo backup? I dati attuali verranno sostituiti.')){ setData(obj.data); localStorage.setItem('budgetflow_last_backup', new Date().toISOString()); setLastBackup(readLastBackup()); alert('Backup ripristinato correttamente.'); } }catch(e){ alert('File backup non valido.'); } };
 return <main><Header tab={tab} setTab={setTab} month={month} setMonth={setMonth} onAdd={()=>setModal({type:'tx'})}/>{backupDue&&!dismissBackup&&<BackupReminder onBackup={exportBackup} onClose={()=>setDismissBackup(true)} days={daysFrom(lastBackup)}/>} {tab==='dashboard'&&<Dashboard stats={stats}/>} {tab==='tx'&&<Transactions tx={tx} cats={cats} onEdit={t=>setModal({type:'tx',item:t})} onDelete={delTx} onDeleteMany={delManyTx} onAdd={()=>setModal({type:'tx'})} exportCsv={exportCsv} importCsv={importCsv}/>} {tab==='cats'&&<Categories cats={cats} onEdit={c=>setModal({type:'cat',item:c})} onDelete={delCat} onAdd={()=>setModal({type:'cat'})}/>} {tab==='backup'&&<BackupPanel data={data} lastBackup={lastBackup} onBackup={exportBackup} onImport={importBackup}/>} {modal?.type==='tx'&&<TxModal item={modal.item} cats={cats} onClose={()=>setModal(null)} onSave={v=>{saveTx(v);setModal(null)}}/>} {modal?.type==='cat'&&<CatModal item={modal.item} onClose={()=>setModal(null)} onSave={v=>{saveCat(v);setModal(null)}}/>}</main> }
function Header(p){return <div className="top"><div className="brand"><div className="logo">▮▮▮</div><h1>BudgetFlow</h1></div><nav>{[['dashboard','Dashboard',LayoutDashboard],['tx','Transazioni',ListChecks],['cats','Categorie',Tags],['backup','Backup',HardDrive]].map(([id,l,I])=><button className={p.tab===id?'active':''} onClick={()=>p.setTab(id)}><I size={16}/>{l}</button>)}</nav><input type="month" value={p.month} onChange={e=>p.setMonth(e.target.value)}/><button className="add" onClick={p.onAdd}><Plus size={18}/> Aggiungi</button></div>}

function BackupReminder({onBackup,onClose,days}){return <section className="backupBanner"><div><strong>Non fai un backup da 7 giorni.</strong><span>Vuoi salvare ora su iCloud Drive? Il file contiene categorie, budget, transazioni e impostazioni.</span></div><button onClick={onBackup}><Download size={16}/>Salva backup</button><button className="ghost" onClick={onClose}>Più tardi</button></section>}
function BackupPanel({data,lastBackup,onBackup,onImport}){ const txCount=data.transactions.length; const catCount=data.categories.length; return <div className="panel backupPanel"><h2>Backup & Ripristino</h2><p className="muted">Crea un backup completo in formato JSON e salvalo su iCloud Drive. È più completo del CSV perché conserva anche categorie, budget, colori e impostazioni.</p><div className="backupStats"><div><span>Ultimo backup</span><strong>{lastBackup?new Date(lastBackup).toLocaleString('it-IT'):'Mai eseguito'}</strong></div><div><span>Transazioni</span><strong>{txCount}</strong></div><div><span>Categorie</span><strong>{catCount}</strong></div></div><div className="backupActions"><button className="save" onClick={onBackup}><Download size={16}/>Esporta backup completo</button><label className="importBtn"><RotateCcw size={16}/>Ripristina backup<input type="file" accept="application/json,.json" onChange={e=>{onImport(e.target.files?.[0]); e.target.value='';}}/></label></div><div className="tip"><b>Su iPhone:</b> dopo aver premuto Esporta, scegli <b>Salva su File</b> e seleziona <b>iCloud Drive → BudgetFlow</b>. L'app ti ricorderà il backup quando passano 7 giorni.</div></div>}
function Dashboard({stats}){ const cards=[['Uscite totali',stats.spent,`${stats.budget?Math.round(stats.spent/stats.budget*100):0}% del budget`,Wallet,'blue'],['Budget mensile',stats.budget,'Somma budget categorie',Target,'green'],['Rimanente',stats.remaining,`${stats.budget?Math.round(stats.remaining/stats.budget*100):0}% del budget`,PiggyBank,'yellow'],['Accrediti',stats.income,'Entrate del mese',ArrowUpCircle,'purple']]; const pieRows=stats.byCat.filter(c=>Number(c.spent)>0); return <><section className="cards">{cards.map(([a,b,c,I,tone])=><div className={`card ${tone}`}><I/><span>{a}</span><strong>{eur(b)}</strong><small>{c}</small></div>)}</section><section className="grid"><div className="panel distributionPanel"><div className="panelTitleRow"><div><h2>Distribuzione spese</h2><p>Solo categorie con movimenti</p></div><strong>{eur(stats.spent)}</strong></div><div className="chartrow"><div className="pieBox"><div className="pieInner"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={pieRows} dataKey="spent" innerRadius="62%" outerRadius="88%" paddingAngle={2} isAnimationActive={false}>{pieRows.map(c=><Cell key={c.id} fill={c.color}/>)}</Pie><Tooltip formatter={eur}/></PieChart></ResponsiveContainer><div className="donutCenter"><span>Totale</span><b>{eur(stats.spent)}</b></div></div></div><div className="legend mobileLegend">{pieRows.map(c=><div key={c.id}><i style={{background:c.color}}></i><span>{c.name}</span><b>{eur(c.spent)}</b><em>{c.share.toFixed(1)}%</em></div>)}</div></div></div><CategorySpendingPanel rows={stats.byCat}/></section><section className="bottom"><div className="panel wide"><h2>Riepilogo per categoria</h2><Table rows={stats.byCat}/></div><div className="panel saldo"><h2>Saldo mese</h2><p><span>Accrediti</span><b>{eur(stats.income)}</b></p><p><span>Uscite</span><b>{eur(stats.spent)}</b></p><hr/><p><span>Saldo</span><strong className={stats.balance>=0?'ok':'bad'}>{eur(stats.balance)}</strong></p></div></section><BudgetVsSpentChart rows={stats.byCat}/></>}


function CategorySpendingPanel({rows}){ const active=rows.filter(r=>Number(r.spent)>0).sort((a,b)=>b.spent-a.spent); const max=Math.max(1,...active.map(r=>Number(r.spent||0))); return <div className="panel categorySpendPanel"><div className="panelTitleRow"><div><h2>Spese per categoria</h2><p>Ordinate per importo speso</p></div></div><div className="desktopChart"><ResponsiveContainer width="100%" height={330}><BarChart layout="vertical" data={active} margin={{left:70,right:30}}><CartesianGrid strokeDasharray="3 3"/><XAxis type="number" tickFormatter={v=>v+' €'}/><YAxis dataKey="name" type="category" width={130}/><Tooltip formatter={eur}/><Bar dataKey="spent">{active.map(c=><Cell key={c.id} fill={c.color}/>)}</Bar></BarChart></ResponsiveContainer></div><div className="mobileSpendList">{active.length===0?<div className="emptyMini">Nessuna spesa nel mese</div>:active.map(c=><div className="spendItem" key={c.id}><div className="spendTop"><span><i style={{background:c.color}}></i>{c.name}</span><b>{eur(c.spent)}</b></div><div className="spendTrack"><em style={{width:`${Math.max(4,(c.spent/max)*100)}%`,background:c.color}}></em></div></div>)}</div></div>}

function BudgetVsSpentChart({rows}){ const chartRows=rows.filter(r=>r.name!=='TOTALE SPESE').map(r=>({name:r.name,budget:Number(r.budget||0),spent:Number(r.spent||0)})); return <section className="panel finalChart"><h2>Budget vs speso per categoria</h2><ResponsiveContainer width="100%" height={420}><BarChart data={chartRows} margin={{top:20,right:24,left:10,bottom:110}} barGap={4}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="name" interval={0} angle={-90} textAnchor="end" height={120}/><YAxis tickFormatter={v=>eur(v).replace(',00','')} /><Tooltip formatter={eur}/><Legend verticalAlign="bottom" height={36}/><Bar dataKey="budget" name="Budget" fill="#3b82f6" radius={[12,12,0,0]}/><Bar dataKey="spent" name="Speso" fill="#22c55e" radius={[12,12,0,0]}/></BarChart></ResponsiveContainer></section>}
function Table({rows}){return <table><thead><tr><th>Categoria</th><th>Budget</th><th>Speso</th><th>Differenza</th><th>% budget</th></tr></thead><tbody>{rows.map(r=><tr><td><i className="dot" style={{background:r.color}}></i>{r.name}</td><td>{eur(r.budget)}</td><td>{eur(r.spent)}</td><td className={r.diff>=0?'ok':'bad'}>{eur(r.diff)}</td><td><div className="prog"><span style={{width:Math.min(r.pct,100)+'%',background:r.pct>100?'#ef4444':r.pct>90?'#facc15':'#22c55e'}}></span></div>{r.pct.toFixed(1)}%</td></tr>)}</tbody></table>}
function Transactions({tx,cats,onEdit,onDelete,onDeleteMany,onAdd,exportCsv,importCsv}){ const [q,setQ]=useState(''); const [selected,setSelected]=useState([]); const list=tx.filter(t=>(t.description||'').toLowerCase().includes(q.toLowerCase())||(cats.find(c=>c.id===t.categoryId)?.name||'Entrata').toLowerCase().includes(q.toLowerCase())); const shownIds=list.map(t=>t.id); const allShown=shownIds.length>0&&shownIds.every(id=>selected.includes(id)); const toggle=id=>setSelected(s=>s.includes(id)?s.filter(x=>x!==id):[...s,id]); const toggleAll=()=>setSelected(s=>allShown?s.filter(id=>!shownIds.includes(id)):[...new Set([...s,...shownIds])]); const bulkDelete=()=>{onDeleteMany(selected);setSelected([])}; return <div className="panel txPanel"><div className="txHeader"><div><span className="eyebrow">Archivio movimenti</span><h2>Transazioni</h2><p>{list.length} movimenti visualizzati</p></div><div className="txActions"><button className="soft" onClick={exportCsv}><Download size={16}/>Esporta CSV</button><label className="importBtn soft"><Upload size={16}/>Importa CSV<input type="file" accept=".csv,text/csv" onChange={e=>{importCsv(e.target.files?.[0]); e.target.value='';}}/></label><button className="primaryBtn" onClick={onAdd}><Plus size={16}/>Nuova</button></div></div><div className="txTools"><label className="search"><Search size={18}/><input placeholder="Cerca descrizione o categoria" value={q} onChange={e=>setQ(e.target.value)}/></label>{selected.length>0&&<div className="selectionBar"><span>{selected.length} selezionate</span><button className="danger" onClick={bulkDelete}><Trash2 size={16}/>Elimina selezionate</button></div>}</div><div className="tableWrap"><table className="txTable"><thead><tr><th className="check"><input type="checkbox" checked={allShown} onChange={toggleAll} aria-label="Seleziona tutte le transazioni visibili"/></th><th>Data</th><th>Descrizione</th><th>Categoria</th><th>Tipo</th><th className="amountHead">Importo</th><th className="actionsHead">Azioni</th></tr></thead><tbody>{list.length===0?<tr><td colSpan="7"><div className="emptyState"><strong>Nessuna transazione trovata</strong><span>Aggiungi una nuova spesa oppure importa un CSV per iniziare.</span></div></td></tr>:list.map(t=>{const cat=cats.find(c=>c.id===t.categoryId); return <tr className={selected.includes(t.id)?'selected':''}><td className="check"><input type="checkbox" checked={selected.includes(t.id)} onChange={()=>toggle(t.id)} aria-label={`Seleziona ${t.description}`}/></td><td data-label="Data">{new Date(t.date).toLocaleDateString('it-IT',{day:'2-digit',month:'short',year:'numeric'})}</td><td data-label="Descrizione"><strong>{t.description}</strong>{t.note&&<small>{t.note}</small>}</td><td data-label="Categoria"><span className="catPill"><i style={{background:cat?.color||'#94a3b8'}}></i>{cat?.name||'Entrata'}</span></td><td data-label="Tipo"><span className={t.type==='income'?'typePill income':'typePill expense'}>{t.type==='income'?'Entrata':'Uscita'}</span></td><td data-label="Importo" className={t.type==='income'?'ok amount':'bad amount'}>{eur(t.amount)}</td><td className="rowActions"><button title="Modifica" onClick={()=>onEdit(t)}><Pencil size={15}/></button><button title="Elimina" onClick={()=>onDelete(t.id)}><Trash2 size={15}/></button></td></tr>})}</tbody></table></div></div>}

function Categories({cats,onEdit,onDelete,onAdd}){return <div className="panel"><div className="bar"><h2>Categorie e budget</h2><button onClick={onAdd}><Plus size={16}/>Nuova categoria</button></div><div className="catgrid">{cats.map(c=><div className="cat"><i style={{background:c.color}}></i><h3>{c.name}</h3><span>{c.type==='income'?'Entrata':'Uscita'}</span><strong>{eur(c.budget)}</strong><button onClick={()=>onEdit(c)}><Pencil size={15}/> Modifica</button><button onClick={()=>onDelete(c.id)}><Trash2 size={15}/> Elimina</button></div>)}</div></div>}
function TxModal({item,cats,onClose,onSave}){ const [v,set]=useState(item||{date:today(),description:'',categoryId:cats[0]?.id,type:'expense',amount:'',notes:''}); return <Modal title="Transazione" onClose={onClose}><input value={v.date} type="date" onChange={e=>set({...v,date:e.target.value})}/><input placeholder="Descrizione" value={v.description} onChange={e=>set({...v,description:e.target.value})}/><select value={v.type} onChange={e=>set({...v,type:e.target.value,categoryId:e.target.value==='income'?'income':cats[0]?.id})}><option value="expense">Uscita</option><option value="income">Entrata</option></select>{v.type==='expense'&&<select value={v.categoryId} onChange={e=>set({...v,categoryId:e.target.value})}>{cats.filter(c=>c.type==='expense').map(c=><option value={c.id}>{c.name}</option>)}</select>}<input placeholder="Importo" type="number" value={v.amount} onChange={e=>set({...v,amount:e.target.value})}/><textarea placeholder="Note" value={v.notes} onChange={e=>set({...v,notes:e.target.value})}/><button className="save" onClick={()=>onSave({...v,amount:Number(v.amount)})}><Save size={16}/>Salva</button></Modal>}
function CatModal({item,onClose,onSave}){ const [v,set]=useState(item||{name:'',budget:0,type:'expense',color:colors[Math.floor(Math.random()*colors.length)]}); return <Modal title="Categoria" onClose={onClose}><input placeholder="Nome categoria" value={v.name} onChange={e=>set({...v,name:e.target.value})}/><input placeholder="Budget mensile" type="number" value={v.budget} onChange={e=>set({...v,budget:e.target.value})}/><select value={v.type} onChange={e=>set({...v,type:e.target.value})}><option value="expense">Uscita</option><option value="income">Entrata</option></select><input type="color" value={v.color} onChange={e=>set({...v,color:e.target.value})}/><button className="save" onClick={()=>onSave({...v,budget:Number(v.budget)})}><Save size={16}/>Salva</button></Modal>}
function Modal({title,children,onClose}){return <div className="overlay"><div className="modal"><button className="x" onClick={onClose}><X/></button><h2>{title}</h2>{children}</div></div>}
createRoot(document.getElementById('root')).render(<App/>);
