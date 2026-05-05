import React, {useEffect, useMemo, useRef, useState} from 'react';
import { createRoot } from 'react-dom/client';
import { BarChart3, CalendarClock, CheckCircle2, ChevronRight, Copy, Download, FileJson, LayoutDashboard, ListChecks, Lock, Plus, Repeat, RotateCcw, Search, ShieldCheck, Tags, Trash2, Upload, Wallet, X } from 'lucide-react';
import './styles.css';

const COLORS=['#3b82f6','#22c55e','#ec4899','#facc15','#ef4444','#d946ef','#8b5cf6','#60a5fa','#14b8a6','#fb923c','#a3e635','#0f766e','#fb7185','#7dd3fc','#94a3b8'];
const uid=()=>crypto?.randomUUID?.()||Math.random().toString(36).slice(2,10);
const today=()=>new Date().toISOString().slice(0,10);
const monthKey=(d=new Date())=>d.toISOString().slice(0,7);
const eur=v=>new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR'}).format(Number(v||0));
const norm=v=>String(v??'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
const daysInMonth=m=>new Date(Number(m.slice(0,4)),Number(m.slice(5,7)),0).getDate();
const dayOfMonth=()=>new Date().getDate();
const parseEuro=v=>{let s=String(v??'').replace(/[€\s]/g,'').trim(); if(!s)return 0; if(s.includes(',')&&s.includes('.'))s=s.replace(/\./g,'').replace(',','.'); else if(s.includes(','))s=s.replace(',','.'); const n=Number(s); return Number.isFinite(n)?n:0};
const normDate=v=>{const s=String(v??'').trim(); if(/^\d{4}-\d{2}-\d{2}$/.test(s))return s; const m=s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/); if(m){const y=m[3].length===2?'20'+m[3]:m[3]; return `${y}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`} const d=new Date(s); return Number.isNaN(d)?today():d.toISOString().slice(0,10)};
const prevMonth=m=>{const d=new Date(Number(m.slice(0,4)),Number(m.slice(5,7))-2,1); return monthKey(d)};

function parseCsv(text){const rows=[];let row=[],cur='',q=false;const first=text.split(/\r?\n/)[0]||'';const sep=(first.match(/;/g)||[]).length>(first.match(/,/g)||[]).length?';':',';for(let i=0;i<text.length;i++){const ch=text[i],nx=text[i+1];if(ch==='"'&&q&&nx==='"'){cur+='"';i++;continue}if(ch==='"'){q=!q;continue}if(ch===sep&&!q){row.push(cur);cur='';continue}if((ch==='\n'||ch==='\r')&&!q){if(ch==='\r'&&nx==='\n')i++;row.push(cur);cur='';if(row.some(x=>String(x).trim()))rows.push(row.map(x=>String(x).trim()));row=[];continue}cur+=ch}row.push(cur);if(row.some(x=>String(x).trim()))rows.push(row.map(x=>String(x).trim()));return rows}

const defaultCats=[['Spesa',400,'variable'],['Bar / Colazioni / Snack',250,'variable'],['Asporto / Delivery',200,'variable'],['Casa',160,'fixed'],['Affitto',650,'fixed'],['Bollette',90,'fixed'],['Trasporti',70,'variable'],['Salute',50,'variable'],['Shopping / Personale',50,'variable'],['Tempo Libero',30,'variable'],['Abbonamenti',25,'fixed'],['Rate / Finanziamenti',10,'fixed'],['Regali',10,'variable'],['Viaggi',10,'variable'],['Varie / Altro',10,'variable']].map((x,i)=>({id:uid(),name:x[0],budget:x[1],kind:x[2],type:'expense',color:COLORS[i%COLORS.length]}));
const demoTx=[{id:uid(),date:today(),description:'Stipendio',categoryId:'income',type:'income',amount:1950,notes:'Entrata ricorrente'}];
[387,240,200,150,114,80,60,48,40,25,20,6,2,0,0].forEach((a,i)=>{if(a)demoTx.push({id:uid(),date:today(),description:defaultCats[i].name,categoryId:defaultCats[i].id,type:'expense',amount:a,notes:''})});
// Updated to version 17 for the v17 release. When merging user data with defaults
// we use this version to signal the current schema. This must increment on
// breaking changes.
const defaultData={version:17,categories:defaultCats,transactions:demoTx,recurrences:[{id:uid(),description:'Stipendio',categoryId:'income',type:'income',amount:1950,day:1,active:true,frequency:'monthly',remindDays:2,autoApply:false},{id:uid(),description:'Affitto',categoryId:defaultCats[4].id,type:'expense',amount:650,day:1,active:true,frequency:'monthly',remindDays:3,autoApply:false},{id:uid(),description:'Netflix',categoryId:defaultCats[10].id,type:'expense',amount:12.99,day:7,active:true,frequency:'monthly',remindDays:2,autoApply:false},{id:uid(),description:'Bollette luce/gas',categoryId:defaultCats[5].id,type:'expense',amount:85,day:15,active:true,frequency:'monthly',remindDays:5,autoApply:false},{id:uid(),description:'Rata finanziamento',categoryId:defaultCats[11].id,type:'expense',amount:120,day:20,active:true,frequency:'monthly',remindDays:3,autoApply:false}],settings:{pin:'',lastCategoryId:defaultCats[0].id,dirtyCount:0,quickFavorites:defaultCats.slice(0,6).map(c=>c.id)}};

function useData(){
  // Load persisted data from localStorage and merge with defaults. Use try/catch in case of malformed JSON.
  const [data,setData] = useState(() => {
    try {
      return { ...defaultData, ...JSON.parse(localStorage.getItem('budgetflow') || 'null') };
    } catch {
      return defaultData;
    }
  });
  // Save current data back to localStorage on every change, carrying the latest version number.
  useEffect(() => {
    localStorage.setItem('budgetflow', JSON.stringify({ ...data, version: 17 }));
  }, [data]);
  return [data, setData];
}
function lastBackup(){return localStorage.getItem('budgetflow_last_backup')||''}
function daysFrom(iso){return iso?Math.floor((Date.now()-new Date(iso).getTime())/86400000):999}
function download(name,content,type='application/json'){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([content],{type}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}

function App(){
 const [data,setData]=useData(); const [tab,setTab]=useState('dashboard'); const [month,setMonth]=useState(monthKey()); const [modal,setModal]=useState(null); const [query,setQuery]=useState(''); const [selected,setSelected]=useState([]); const [lastB,setLastB]=useState(lastBackup()); const [locked,setLocked]=useState(Boolean(data.settings?.pin)); const [pinTry,setPinTry]=useState(''); const [preview,setPreview]=useState(null);
 const cats=data.categories||[]; const txAll=data.transactions||[]; const monthTx=txAll.filter(t=>String(t.date).startsWith(month));
 const expenseCats=cats.filter(c=>c.type==='expense');
 const stats=useMemo(()=>{const budget=expenseCats.reduce((s,c)=>s+Number(c.budget||0),0);const income=monthTx.filter(t=>t.type==='income').reduce((s,t)=>s+Number(t.amount),0);const spent=monthTx.filter(t=>t.type==='expense').reduce((s,t)=>s+Number(t.amount),0);let byCat=expenseCats.map(c=>{const spent=monthTx.filter(t=>t.type==='expense'&&t.categoryId===c.id).reduce((s,t)=>s+Number(t.amount),0);return{...c,spent,diff:Number(c.budget||0)-spent,pct:c.budget?spent/c.budget*100:0,share:spent?0:0}}).sort((a,b)=>b.spent-a.spent);byCat=byCat.map(c=>({...c,share:spent?c.spent/spent*100:0}));return{budget,income,spent,remaining:budget-spent,balance:income-spent,byCat}},[monthTx,cats]);
 const prev=useMemo(()=>{const p=prevMonth(month);return txAll.filter(t=>String(t.date).startsWith(p)&&t.type==='expense').reduce((m,t)=>({...m,[t.categoryId]:(m[t.categoryId]||0)+Number(t.amount)}),{})},[txAll,month]);

 const recurrenceInfo=useMemo(()=>{const list=(data.recurrences||[]).filter(r=>r.active);const todayD=new Date();const cur=todayD.toISOString().slice(0,7);const y=Number(month.slice(0,4)),m=Number(month.slice(5,7))-1;const upcoming=list.map(r=>{const date=`${month}-${String(Math.min(Number(r.day||1),daysInMonth(month))).padStart(2,'0')}`;const d=new Date(date+'T12:00:00');const diff=Math.ceil((d-todayD)/86400000);const exists=txAll.some(t=>t.date===date&&t.description===r.description&&Number(t.amount)===Number(r.amount)&&t.type===r.type);return{...r,date,diff,exists,categoryName:cats.find(c=>c.id===r.categoryId)?.name||'Accrediti'}}).filter(r=>!r.exists&&r.diff>=0).sort((a,b)=>a.diff-b.diff);const pendingMonth=list.map(r=>{const date=`${month}-${String(Math.min(Number(r.day||1),daysInMonth(month))).padStart(2,'0')}`;const exists=txAll.some(t=>t.date===date&&t.description===r.description&&Number(t.amount)===Number(r.amount)&&t.type===r.type);return exists?null:{...r,date}}).filter(Boolean);const futureIncome=pendingMonth.filter(r=>r.type==='income').reduce((s,r)=>s+Number(r.amount||0),0);const futureExpense=pendingMonth.filter(r=>r.type==='expense').reduce((s,r)=>s+Number(r.amount||0),0);return{upcoming,pendingMonth,futureIncome,futureExpense,forecastBalance:stats.balance+futureIncome-futureExpense}} ,[data.recurrences,month,txAll,cats,stats.balance]); const due=daysFrom(lastB)>=7;
 useEffect(()=>{ if(due && !sessionStorage.getItem('bf_backup_popup')){sessionStorage.setItem('bf_backup_popup','1'); setModal({type:'backupReminder'});} },[]);
 const touch=()=>setData(d=>({...d,settings:{...d.settings,dirtyCount:(d.settings?.dirtyCount||0)+1}}));
 const saveTx=t=>{setData(d=>({...d,transactions:t.id?d.transactions.map(x=>x.id===t.id?t:x):[{...t,id:uid()},...d.transactions],settings:{...d.settings,lastCategoryId:t.categoryId,dirtyCount:(d.settings?.dirtyCount||0)+1}}));setModal(null)};
 const delTx=ids=>{if(!ids.length)return;if(confirm(`Eliminare ${ids.length} transazioni?`)){setData(d=>({...d,transactions:d.transactions.filter(t=>!ids.includes(t.id)),settings:{...d.settings,dirtyCount:(d.settings?.dirtyCount||0)+1}}));setSelected([])}};
 const duplicate=t=>saveTx({...t,id:undefined,date:today(),description:t.description+' copia'});
 const saveCat=c=>{setData(d=>({...d,categories:c.id?d.categories.map(x=>x.id===c.id?c:x):[...d.categories,{...c,id:uid()}],settings:{...d.settings,dirtyCount:(d.settings?.dirtyCount||0)+1}}));setModal(null)};
 const delCat=id=>{if(confirm('Eliminare categoria e transazioni collegate?'))setData(d=>({...d,categories:d.categories.filter(c=>c.id!==id),transactions:d.transactions.filter(t=>t.categoryId!==id)}))};
 const copyPrevBudget=()=>{const map={};txAll.filter(t=>String(t.date).startsWith(prevMonth(month))&&t.type==='expense').forEach(t=>map[t.categoryId]=(map[t.categoryId]||0)+Number(t.amount));setData(d=>({...d,categories:d.categories.map(c=>c.type==='expense'?{...c,budget:map[c.id]||c.budget}:c)}));};
 const exportCsv=()=>{const rows=[['Data','Descrizione','Categoria','Tipo','Importo','Note'],...txAll.map(t=>[t.date,t.description,cats.find(c=>c.id===t.categoryId)?.name||'Accrediti',t.type,t.amount,t.notes||''])];download('budgetflow-transazioni.csv',rows.map(r=>r.map(v=>`"${String(v??'').replaceAll('"','""')}"`).join(',')).join('\n'),'text/csv')};
// Export a backup of all data to a JSON file. The exported backup contains
// the current version number (v17) so that future restores can handle schema
// changes gracefully.
const makeBackup=()=>{
  download(
    `budgetflow-backup-${today()}.json`,
    JSON.stringify({ app:'BudgetFlow', version:17, createdAt:new Date().toISOString(), data }, null, 2 )
  );
  localStorage.setItem('budgetflow_last_backup', new Date().toISOString());
  setLastB(lastBackup());
  setData(d => ({ ...d, settings: { ...d.settings, dirtyCount: 0 } }));
  setModal(null);
};
 const restoreBackup=async f=>{if(!f)return;const obj=JSON.parse(await f.text());if(!obj?.data?.transactions||!obj?.data?.categories)return alert('Backup non valido');if(confirm(`Ripristinare backup del ${new Date(obj.createdAt||Date.now()).toLocaleString('it-IT')}?`)){setData({...defaultData,...obj.data});setModal(null)}};
 const prepareCsv=async f=>{if(!f)return;const rows=parseCsv(await f.text());const header=(rows[0]||[]).map(norm);const idx=names=>names.map(norm).map(n=>header.indexOf(n)).find(i=>i>=0);const amountI=idx(['importo','amount','valore','spesa']);if(amountI===undefined)return alert('Serve una colonna Importo');const dateI=idx(['data','date']),descI=idx(['descrizione','description','causale','nome']),catI=idx(['categoria','category']),typeI=idx(['tipo','type']),notesI=idx(['note','notes']);const mapped=rows.slice(1).map((r,i)=>{const rawType=norm(typeI!==undefined?r[typeI]:'');const amount=parseEuro(r[amountI]);const catName=catI!==undefined?r[catI]:'Varie / Altro';const type=rawType.includes('entr')||rawType==='income'||norm(catName).includes('accredit')?'income':'expense';return{id:uid(),date:normDate(dateI!==undefined?r[dateI]:today()),description:(descI!==undefined?r[descI]:'Import CSV')||'Import CSV',categoryName:catName,type,amount:Math.abs(amount),notes:notesI!==undefined?r[notesI]:'',sourceRow:i+2}}).filter(x=>x.amount);const existing=new Set(txAll.map(t=>`${t.date}|${norm(t.description)}|${t.amount}|${t.type}`));setPreview({rows:mapped,duplicates:mapped.filter(t=>existing.has(`${t.date}|${norm(t.description)}|${t.amount}|${t.type}`)).length})};
 const confirmImport=()=>{const rows=preview.rows;setData(d=>{const categories=[...d.categories];const existing=new Set(d.transactions.map(t=>`${t.date}|${norm(t.description)}|${t.amount}|${t.type}`));const transactions=[];for(const r of rows){if(existing.has(`${r.date}|${norm(r.description)}|${r.amount}|${r.type}`))continue;let categoryId='income';if(r.type==='expense'){let c=categories.find(c=>norm(c.name)===norm(r.categoryName));if(!c){c={id:uid(),name:r.categoryName||'Varie / Altro',budget:0,type:'expense',kind:'variable',color:COLORS[categories.length%COLORS.length]};categories.push(c)}categoryId=c.id}transactions.push({...r,categoryId});}return{...d,categories,transactions:[...transactions,...d.transactions],settings:{...d.settings,dirtyCount:(d.settings?.dirtyCount||0)+1}}});alert('Importazione completata. I duplicati rilevati sono stati saltati.');setPreview(null)};
 const applyRecurrences=()=>{let added=0;setData(d=>{const out=[...d.transactions];for(const r of d.recurrences||[]){if(!r.active)continue;const date=`${month}-${String(Math.min(Number(r.day||1),daysInMonth(month))).padStart(2,'0')}`;const key=`${date}|${r.description}|${r.amount}|${r.type}`;if(!out.some(t=>`${t.date}|${t.description}|${t.amount}|${t.type}`===key)){out.push({id:uid(),date,description:r.description,categoryId:r.categoryId,type:r.type,amount:Number(r.amount||0),notes:`Ricorrenza automatica · ${r.frequency||'mensile'}`});added++}}return{...d,transactions:out,settings:{...d.settings,dirtyCount:(d.settings?.dirtyCount||0)+added}}});alert(added?`Aggiunte ${added} ricorrenze per il mese.`:'Nessuna ricorrenza da aggiungere.');};
 if(locked)return <LockScreen pin={data.settings.pin} pinTry={pinTry} setPinTry={setPinTry} unlock={()=>pinTry===data.settings.pin?setLocked(false):alert('PIN errato')}/>;
 return <div className="app"><header className="top"><div><h1>BudgetFlow</h1><p>{new Date(month+'-01').toLocaleDateString('it-IT',{month:'long',year:'numeric'})}</p></div><input type="month" value={month} onChange={e=>setMonth(e.target.value)}/></header>{due&&<div className="backupBanner"><ShieldCheck size={18}/><span>Non fai un backup da 7 giorni. Vuoi salvare ora su iCloud Drive?</span><button onClick={makeBackup}>Salva backup</button></div>}<main className="content">{tab==='dashboard'&&<Dashboard stats={stats} prev={prev} month={month} cats={cats} setTab={setTab} recurrenceInfo={recurrenceInfo}/>} {tab==='transactions'&&<Transactions tx={monthTx} cats={cats} selected={selected} setSelected={setSelected} query={query} setQuery={setQuery} onAdd={()=>setModal({type:'tx'})} onEdit={t=>setModal({type:'tx',tx:t})} onDelete={delTx} onDup={duplicate} exportCsv={exportCsv} importCsv={prepareCsv}/>} {tab==='categories'&&<Categories cats={cats} saveCat={saveCat} delCat={delCat} edit={c=>setModal({type:'cat',cat:c})} add={()=>setModal({type:'cat'})} copyPrevBudget={copyPrevBudget}/>} {tab==='recurrences'&&<Recurrences data={data} cats={cats} setData={setData} applyRecurrences={applyRecurrences} month={month} txAll={txAll} recurrenceInfo={recurrenceInfo}/>} {tab==='reports'&&<Reports stats={stats} txAll={txAll} cats={cats} month={month} prev={prev}/>} {tab==='backup'&&<Backup lastB={lastB} dirty={data.settings?.dirtyCount||0} makeBackup={makeBackup} restoreBackup={restoreBackup} data={data} setData={setData}/>}</main><button className="fab" onClick={()=>setModal({type:'quick'})}><Plus/></button><nav className="bottom bottom4"><Tab id="dashboard" tab={tab} setTab={setTab} icon={<LayoutDashboard/>} label="Dashboard"/><Tab id="transactions" tab={tab} setTab={setTab} icon={<ListChecks/>} label="Transazioni"/><Tab id="categories" tab={tab} setTab={setTab} icon={<Tags/>} label="Categorie"/><Tab id="recurrences" tab={tab} setTab={setTab} icon={<Repeat/>} label="Ricorr."/><Tab id="backup" tab={tab} setTab={setTab} icon={<FileJson/>} label="Backup"/></nav>{modal?.type==='tx'&&<TxModal tx={modal.tx} cats={cats} save={saveTx} close={()=>setModal(null)}/>} {modal?.type==='quick'&&<QuickAdd cats={cats} last={data.settings?.lastCategoryId} settings={data.settings||{}} setData={setData} txAll={txAll} save={saveTx} close={()=>setModal(null)}/>} {modal?.type==='cat'&&<CatModal cat={modal.cat} save={saveCat} close={()=>setModal(null)}/>} {modal?.type==='backupReminder'&&<Reminder makeBackup={makeBackup} close={()=>setModal(null)}/>} {preview&&<CsvPreview preview={preview} close={()=>setPreview(null)} confirm={confirmImport}/>}</div>
}
function Tab(p){return <button className={p.tab===p.id?'active':''} onClick={()=>p.setTab(p.id)}>{React.cloneElement(p.icon,{size:20})}<span>{p.label}</span></button>}
function LockScreen({pinTry,setPinTry,unlock}){return <div className="lock"><Lock size={42}/><h1>BudgetFlow</h1><p>Inserisci il PIN locale</p><input value={pinTry} onChange={e=>setPinTry(e.target.value)} type="password" inputMode="numeric" autoFocus/><button onClick={unlock}>Sblocca</button></div>}
function Card({title,value,sub,cls}){return <div className={'stat '+cls}><div className="statIcon"></div><div><p>{title}</p><h2>{value}</h2><span>{sub}</span></div></div>}
function Dashboard({stats,prev,cats,setTab,recurrenceInfo}){const positive=stats.byCat.filter(c=>c.spent>0);const circumference=2*Math.PI*72;let offset=0;return <><section className="mobileHero"><div><span>Saldo del mese</span><h2>{eur(stats.balance)}</h2><p>{stats.balance>=0?'Sei in positivo':'Saldo negativo'} · Budget rimasto {eur(stats.remaining)}</p></div><button onClick={()=>setTab('transactions')}>Transazioni</button></section><section className="stats"><Card cls="blue" title="Uscite" value={eur(stats.spent)} sub={`${Math.round(stats.budget?stats.spent/stats.budget*100:0)}% del budget`}/><Card cls="green" title="Budget" value={eur(stats.budget)} sub="Somma categorie"/><Card cls="yellow" title="Rimanente" value={eur(stats.remaining)} sub="Disponibile"/><Card cls="purple" title="Accrediti" value={eur(stats.income)} sub="Entrate del mese"/></section><section className="grid dashGrid"><div className="panel mobileCompact"><h2>Distribuzione spese</h2><div className="donutWrap"><svg viewBox="0 0 180 180" className="donut">{positive.map(c=>{const dash=c.share/100*circumference;const el=<circle key={c.id} cx="90" cy="90" r="72" fill="none" stroke={c.color} strokeWidth="22" strokeDasharray={`${dash} ${circumference-dash}`} strokeDashoffset={-offset} strokeLinecap="butt"/>;offset+=dash;return el})}<circle cx="90" cy="90" r="50" fill="var(--card)"/><text x="90" y="86" textAnchor="middle" className="donutTotal">{eur(stats.spent)}</text><text x="90" y="105" textAnchor="middle" className="donutSub">spese</text></svg></div><div className="legend compact">{positive.slice(0,8).map(c=><div key={c.id}><span style={{background:c.color}}/><b>{c.name}</b><strong>{eur(c.spent)}</strong><em>{c.share.toFixed(1)}%</em></div>)}</div></div><div className="panel mobileCompact"><h2>Spese per categoria</h2><CategoryBars items={positive}/></div></section><div className="recMini"><div><span>Previsione saldo con ricorrenze</span><b>{eur(recurrenceInfo?.forecastBalance||stats.balance)}</b><p>{recurrenceInfo?.pendingMonth?.length||0} ricorrenze ancora da applicare nel mese</p></div><button onClick={()=>setTab('recurrences')}>Gestisci</button></div><section className="panel mobileCompact"><div className="sectionTitle"><h2>Riepilogo intelligente</h2><button onClick={()=>setTab('reports')}>Report <ChevronRight size={16}/></button></div><div className="insights"><Insight text={`Ti restano ${eur(stats.remaining)}. Puoi spendere circa ${eur(Math.max(0,stats.remaining)/(daysInMonth(monthKey())-dayOfMonth()+1))} al giorno fino a fine mese.`}/>{stats.byCat.filter(c=>c.spent>prev[c.id]&&prev[c.id]).slice(0,2).map(c=><Insight key={c.id} text={`Hai speso ${eur(c.spent-prev[c.id])} in più in ${c.name} rispetto al mese scorso.`}/>)}</div></section><section className="panel mobileDetail"><h2>Budget vs speso</h2><div className="budgetList">{stats.byCat.map(c=><div key={c.id} className="budgetRow"><div><span style={{background:c.color}}/>{c.name}</div><strong>{eur(c.spent)} / {eur(c.budget)}</strong><div className="track"><i style={{width:`${Math.min(100,c.pct)}%`,background:c.pct>=100?'#ef4444':c.pct>=80?'#facc15':'#22c55e'}}/></div></div>)}</div></section></>}
function CategoryBars({items}){const max=Math.max(1,...items.map(i=>i.spent));return <div className="mobileBars">{items.map(i=><div key={i.id} className="mbar"><div className="mbarTop"><span style={{background:i.color}}/>{i.name}<b>{eur(i.spent)}</b></div><div className="track"><i style={{width:`${i.spent/max*100}%`,background:i.color}}/></div></div>)}</div>}
function Insight({text}){return <div className="insight"><CheckCircle2 size={18}/>{text}</div>}
function Transactions({tx,cats,selected,setSelected,query,setQuery,onAdd,onEdit,onDelete,onDup,exportCsv,importCsv}){const filtered=tx.filter(t=>norm(t.description).includes(norm(query))||norm(cats.find(c=>c.id===t.categoryId)?.name).includes(norm(query)));const file=useRef();return <section className="panel trans nativePanel"><div className="sectionTitle nativeTitle"><div><h2>Transazioni</h2><p>Scorri una card a sinistra per eliminare o a destra per modificare.</p></div><div className="actions nativeActions"><button onClick={exportCsv}><Download size={16}/>CSV</button><button onClick={()=>file.current.click()}><Upload size={16}/>Importa</button><input hidden ref={file} type="file" accept=".csv,text/csv" onChange={e=>importCsv(e.target.files[0])}/><button className="primary" onClick={onAdd}><Plus size={16}/>Nuova</button></div></div><div className="toolbar"><div className="search"><Search size={18}/><input placeholder="Cerca spesa, categoria, nota" value={query} onChange={e=>setQuery(e.target.value)}/></div>{selected.length>0&&<button className="danger" onClick={()=>onDelete(selected)}><Trash2 size={16}/>Elimina {selected.length}</button>}</div>{filtered.length===0?<div className="empty">Nessuna transazione. Tocca + per aggiungere una spesa in pochi secondi.</div>:<div className="txCards nativeList">{filtered.map(t=>{const c=cats.find(c=>c.id===t.categoryId);return <SwipeTx key={t.id} t={t} c={c} selected={selected} setSelected={setSelected} onEdit={onEdit} onDelete={onDelete} onDup={onDup}/>} )}</div>}</section>}
function SwipeTx({t,c,selected,setSelected,onEdit,onDelete,onDup}){const [x,setX]=useState(0);const sx=useRef(0);const dx=useRef(0);const start=e=>{sx.current=e.touches?.[0]?.clientX||0;dx.current=0};const move=e=>{const v=(e.touches?.[0]?.clientX||0)-sx.current;dx.current=v;if(Math.abs(v)>8)setX(Math.max(-96,Math.min(96,v)))};const end=()=>{if(dx.current<-74){setX(-96);setTimeout(()=>{setX(0);onDelete([t.id])},120)}else if(dx.current>74){setX(96);setTimeout(()=>{setX(0);onEdit(t)},120)}else setX(0)};return <div className="swipeShell"><div className="swipeBg left">Modifica</div><div className="swipeBg right">Elimina</div><div className="txCard nativeCard" style={{transform:`translateX(${x}px)`}} onTouchStart={start} onTouchMove={move} onTouchEnd={end}><input aria-label="Seleziona transazione" type="checkbox" checked={selected.includes(t.id)} onChange={e=>setSelected(s=>e.target.checked?[...s,t.id]:s.filter(x=>x!==t.id))}/><div className="dot" style={{background:t.type==='income'?'#a855f7':c?.color}}/><div className="txMain"><b>{t.description}</b><span>{new Date(t.date).toLocaleDateString('it-IT')} · {t.type==='income'?'Accrediti':c?.name}</span></div><strong className={t.type}>{t.type==='income'?'+':'-'}{eur(t.amount)}</strong><button className="desktopAction" onClick={()=>onDup(t)}><Copy size={16}/></button><button className="desktopAction" onClick={()=>onEdit(t)}>Modifica</button></div></div>}
function TxModal({tx,cats,save,close}){const [f,setF]=useState(tx||{date:today(),description:'',categoryId:cats[0]?.id,type:'expense',amount:'',notes:''});return <div className="modal"><form className="sheet" onSubmit={e=>{e.preventDefault();save({...f,amount:parseEuro(f.amount)})}}><button className="x" type="button" onClick={close}><X/></button><h2>{tx?'Modifica':'Nuova'} transazione</h2><input type="date" value={f.date} onChange={e=>setF({...f,date:e.target.value})}/><input placeholder="Descrizione" value={f.description} onChange={e=>setF({...f,description:e.target.value})}/><input inputMode="decimal" placeholder="Importo" value={f.amount} onChange={e=>setF({...f,amount:e.target.value})}/><select value={f.type} onChange={e=>setF({...f,type:e.target.value,categoryId:e.target.value==='income'?'income':cats[0]?.id})}><option value="expense">Uscita</option><option value="income">Entrata</option></select>{f.type==='expense'&&<select value={f.categoryId} onChange={e=>setF({...f,categoryId:e.target.value})}>{cats.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>}<textarea placeholder="Note" value={f.notes||''} onChange={e=>setF({...f,notes:e.target.value})}/><button className="primary">Salva</button></form></div>}
function QuickAdd({cats,last,settings,setData,txAll,save,close}){
 const [amount,setAmount]=useState('');
 const [desc,setDesc]=useState('');
 const [cat,setCat]=useState(last||cats[0]?.id);
 const [note,setNote]=useState('');
 const [date,setDate]=useState(today());
 const [editFav,setEditFav]=useState(false);
 const lastExpense=txAll.find(t=>t.type==='expense');
 const expenseCats=cats.filter(c=>c.type==='expense');
 const favIds=(settings.quickFavorites&&settings.quickFavorites.length?settings.quickFavorites:expenseCats.slice(0,6).map(c=>c.id)).filter(id=>expenseCats.some(c=>c.id===id));
 const fav=expenseCats.filter(c=>favIds.includes(c.id));
 const toggleFav=id=>{const exists=favIds.includes(id);let next=exists?favIds.filter(x=>x!==id):[...favIds,id]; if(next.length>8)next=next.slice(next.length-8); setData(d=>({...d,settings:{...d.settings,quickFavorites:next,dirtyCount:(d.settings?.dirtyCount||0)+1}}));};
 const rules=[
  {keys:['netflix','spotify','icloud','apple','prime','disney','dazn'],hint:'Abbonamenti'},
  {keys:['esselunga','conad','coop','lidl','aldi','eurospin','carrefour'],hint:'Spesa'},
  {keys:['glovo','deliveroo','just eat','pizza','mc donald','burger'],hint:'Asporto / Delivery'},
  {keys:['bar','caffe','caffè','cornetto','colazione'],hint:'Bar / Colazioni / Snack'},
  {keys:['benzina','eni','q8','tamoil','treno','metro','bus'],hint:'Trasporti'},
  {keys:['farmacia','medico','dentista'],hint:'Salute'}
 ];
 useEffect(()=>{const n=norm(desc); if(!n)return; const rule=rules.find(r=>r.keys.some(k=>n.includes(k))); const byRule=rule&&cats.find(c=>norm(c.name).includes(norm(rule.hint).split('/')[0].trim())); const byName=cats.find(c=>n.includes(norm(c.name).split(' ')[0])); const match=byRule||byName; if(match)setCat(match.id)},[desc]);
 const chosen=cats.find(c=>c.id===cat);
 const submit=()=>{const value=parseEuro(amount); if(!value)return alert('Inserisci un importo'); save({date,description:desc||chosen?.name||'Spesa',categoryId:cat,type:'expense',amount:value,notes:note})};
 const repeatLast=()=>{if(!lastExpense)return; setAmount(String(lastExpense.amount).replace('.',',')); setDesc(lastExpense.description); setCat(lastExpense.categoryId); setNote(lastExpense.notes||''); setDate(today())};
 return <div className="modal quickModal"><form className="sheet quick quickV14" onSubmit={e=>{e.preventDefault();submit()}}>
  <button className="x" type="button" onClick={close}><X/></button>
  <div className="quickHead"><span>Nuova uscita</span><b>Inserimento rapido</b><p>Data di oggi già pronta. Scegli categoria, importo e salva.</p></div>
  <input className="bigAmount" autoFocus inputMode="decimal" placeholder="0,00 €" value={amount} onChange={e=>setAmount(e.target.value)} />
  <div className="quickDate"><label>Data</label><input type="date" value={date} onChange={e=>setDate(e.target.value)} /></div>
  <input className="quickDesc" placeholder="Descrizione opzionale, es. Netflix, Esselunga..." value={desc} onChange={e=>setDesc(e.target.value)} />
  {chosen&&<div className="suggestion"><CheckCircle2 size={16}/><span>Categoria suggerita:</span><b>{chosen.name}</b></div>}
  <div className="quickRowTitle"><b>Categorie preferite</b><div className="quickRowActions">{lastExpense&&<button type="button" onClick={repeatLast}><RotateCcw size={15}/>Ripeti ultima</button>}<button type="button" onClick={()=>setEditFav(v=>!v)}>{editFav?'Fine':'Modifica preferiti'}</button></div></div>
  {!editFav?<div className="quickChips">{fav.map(c=><button type="button" className={cat===c.id?'sel':''} key={c.id} onClick={()=>setCat(c.id)}><span style={{background:c.color}}/>{c.name}</button>)}</div>:<div className="favoriteEditor">{expenseCats.map(c=><button type="button" key={c.id} className={favIds.includes(c.id)?'on':''} onClick={()=>toggleFav(c.id)}><span style={{background:c.color}}/>{c.name}<small>{favIds.includes(c.id)?'✓':''}</small></button>)}</div>}
  <textarea className="quickNote" placeholder="Nota opzionale" value={note} onChange={e=>setNote(e.target.value)} />
  <button className="primary saveFast">Salva spesa in 5 secondi</button>
 </form></div>
}
function Categories({cats,saveCat,delCat,edit,add,copyPrevBudget}){return <section className="panel"><div className="sectionTitle"><h2>Budget categorie</h2><div className="actions"><button onClick={copyPrevBudget}>Copia mese scorso</button><button className="primary" onClick={add}><Plus size={16}/>Nuova</button></div></div><div className="catGrid">{cats.map(c=><div className="catCard" key={c.id}><span style={{background:c.color}}/><div><b>{c.name}</b><p>{c.kind==='fixed'?'Fissa':'Variabile'} · {eur(c.budget)}</p></div><button onClick={()=>edit(c)}>Modifica</button><button onClick={()=>delCat(c.id)}><Trash2 size={16}/></button></div>)}</div></section>}
function CatModal({cat,save,close}){const [f,setF]=useState(cat||{name:'',budget:'',type:'expense',kind:'variable',color:COLORS[0]});return <div className="modal"><form className="sheet" onSubmit={e=>{e.preventDefault();save({...f,budget:parseEuro(f.budget)})}}><button className="x" type="button" onClick={close}><X/></button><h2>Categoria</h2><input placeholder="Nome" value={f.name} onChange={e=>setF({...f,name:e.target.value})}/><input inputMode="decimal" placeholder="Budget mensile" value={f.budget} onChange={e=>setF({...f,budget:e.target.value})}/><select value={f.kind} onChange={e=>setF({...f,kind:e.target.value})}><option value="variable">Variabile</option><option value="fixed">Fissa</option></select><input type="color" value={f.color} onChange={e=>setF({...f,color:e.target.value})}/><button className="primary">Salva</button></form></div>}
function Recurrences({data,cats,setData,applyRecurrences,month,txAll,recurrenceInfo}){
  const templates=[
  {description:'Stipendio',type:'income',categoryId:'income',amount:1950,day:1,remindDays:2},
  {description:'Affitto',type:'expense',hint:'Affitto',amount:650,day:1,remindDays:3},
  {description:'Netflix / Streaming',type:'expense',hint:'Abbonamenti',amount:12.99,day:7,remindDays:2},
  {description:'Bollette',type:'expense',hint:'Bollette',amount:90,day:15,remindDays:5},
  {description:'Rata / Finanziamento',type:'expense',hint:'Rate / Finanziamenti',amount:120,day:20,remindDays:3}
 ];
 const defaultCat=cats[0]?.id;
  // State for the new recurrence form
  const [f,setF]=useState({description:'',amount:'',day:1,type:'expense',categoryId:defaultCat,active:true,remindDays:3,frequency:'monthly'});
  // Toggle to show/hide the new recurrence form (mobile friendly)
  const [showAdd,setShowAdd] = useState(false);
  // Holds the recurrence currently being edited. When non-null, shows edit modal.
  const [editRec,setEditRec] = useState(null);
 const catName=id=>cats.find(c=>c.id===id)?.name||'Accrediti';
 const save=()=>{if(!f.description||!parseEuro(f.amount))return alert('Inserisci descrizione e importo');setData(d=>({...d,recurrences:[...(d.recurrences||[]),{...f,id:uid(),amount:parseEuro(f.amount),day:Number(f.day||1),remindDays:Number(f.remindDays||0),frequency:'monthly'}],settings:{...d.settings,dirtyCount:(d.settings?.dirtyCount||0)+1}}));setF({...f,description:'',amount:''})};
 const addTemplate=t=>{const c=t.categoryId||cats.find(x=>norm(x.name).includes(norm(t.hint||'')))?.id||defaultCat;setF({...f,...t,categoryId:c,amount:String(t.amount).replace('.',','),active:true,frequency:'monthly'})};
 const toggle=id=>setData(d=>({...d,recurrences:(d.recurrences||[]).map(r=>r.id===id?{...r,active:!r.active}:r)}));
 const update=(id,patch)=>setData(d=>({...d,recurrences:(d.recurrences||[]).map(r=>r.id===id?{...r,...patch,amount:patch.amount!==undefined?parseEuro(patch.amount):r.amount,day:patch.day!==undefined?Number(patch.day):r.day,remindDays:patch.remindDays!==undefined?Number(patch.remindDays):r.remindDays}:r)}));
 const remove=id=>{if(confirm('Eliminare questa ricorrenza?'))setData(d=>({...d,recurrences:(d.recurrences||[]).filter(x=>x.id!==id)}))};
 const upcoming=(recurrenceInfo?.upcoming||[]).slice(0,5);
  // Editor modal for modifying an existing recurrence. When `editRec` holds a recurrence, this
  // component is rendered. It uses its own local state to allow editing fields before saving.
  const RecurrenceEditor = ({rec, close}) => {
    const [temp,setTemp] = useState(() => ({
      id: rec.id,
      description: rec.description || '',
      amount: String(rec.amount ?? '').replace('.', ','),
      day: rec.day ?? 1,
      type: rec.type || 'expense',
      categoryId: rec.categoryId || defaultCat,
      remindDays: rec.remindDays ?? 0,
      active: rec.active ?? true
    }));
    const saveEdit = () => {
      if(!temp.description || !parseEuro(temp.amount)) { alert('Inserisci descrizione e importo'); return; }
      update(temp.id, {
        description: temp.description,
        amount: temp.amount,
        day: temp.day,
        type: temp.type,
        categoryId: temp.type==='income' ? 'income' : temp.categoryId,
        remindDays: temp.remindDays,
        active: temp.active
      });
      setEditRec(null);
    };
    return <div className="modal">
      <form className="sheet" onSubmit={e => { e.preventDefault(); saveEdit(); }}>
        <button className="x" type="button" onClick={close}><X/></button>
        <h2>Modifica ricorrenza</h2>
        <input placeholder="Descrizione" value={temp.description} onChange={e=>setTemp({...temp, description: e.target.value})}/>
        <input placeholder="Importo" inputMode="decimal" value={temp.amount} onChange={e=>setTemp({...temp, amount: e.target.value})}/>
        <input type="number" min="1" max="31" value={temp.day} onChange={e=>setTemp({...temp, day: e.target.value})}/>
        <select value={temp.type} onChange={e=>setTemp({...temp, type: e.target.value, categoryId: e.target.value==='income'?'income':temp.categoryId})}>
          <option value="expense">Uscita</option>
          <option value="income">Entrata</option>
        </select>
        {temp.type==='expense' && <select value={temp.categoryId} onChange={e=>setTemp({...temp, categoryId: e.target.value})}>{cats.map(c=> <option key={c.id} value={c.id}>{c.name}</option>)}</select>}
        <input type="number" min="0" max="15" value={temp.remindDays} onChange={e=>setTemp({...temp, remindDays: e.target.value})} title="Giorni di preavviso"/>
        <label style={{display:'flex',alignItems:'center',gap:'8px'}}>
          <input type="checkbox" checked={temp.active} onChange={e=>setTemp({...temp, active: e.target.checked})}/>
          Attiva
        </label>
        <button className="primary" type="submit">Salva</button>
      </form>
    </div>;
  };
  return <section className="panel recurrencesV15">
    <div className="sectionTitle">
      <div>
        <h2>Ricorrenze automatiche</h2>
        <p>Affitto, stipendio, abbonamenti, bollette e rate senza reinserirli ogni mese.</p>
      </div>
      <button className="primary" onClick={applyRecurrences}><Repeat size={16}/>Applica al mese</button>
    </div>
    <div className="forecastGrid">
      <div>
        <span>Saldo attuale</span>
        <b>{eur((txAll||[]).filter(t=>String(t.date).startsWith(month)).reduce((s,t)=>s+(t.type==='income'?Number(t.amount):-Number(t.amount)),0))}</b>
      </div>
      <div>
        <span>Ricorrenze future</span>
        <b>{eur((recurrenceInfo?.futureIncome||0)-(recurrenceInfo?.futureExpense||0))}</b>
      </div>
      <div className="accent">
        <span>Saldo previsto fine mese</span>
        <b>{eur(recurrenceInfo?.forecastBalance||0)}</b>
      </div>
    </div>
    {upcoming.length>0 && <div className="dueBox"><CalendarClock/><div><b>Promemoria scadenze</b>{upcoming.map(r => <p key={r.id}>{r.description}: {eur(r.amount)} il {new Date(r.date).toLocaleDateString('it-IT')} {r.diff===0 ? '· oggi' : `· tra ${r.diff} giorni`}</p>)}</div></div>}
    <h3>Modelli rapidi</h3>
    <div className="templateChips">{templates.map(t => <button key={t.description} onClick={() => addTemplate(t)}><Plus size={14}/>{t.description}</button>)}</div>
    {/* Collapsible form for adding a new recurrence */}
    <div style={{margin:'8px 0'}}>
      {!showAdd ? <button className="primary" onClick={() => setShowAdd(true)}><Plus size={14}/>Aggiungi ricorrenza</button> :
        <div className="recForm smart" style={{marginTop:'8px'}}>
          <input placeholder="Descrizione" value={f.description} onChange={e=>setF({...f,description:e.target.value})}/>
          <input placeholder="Importo" inputMode="decimal" value={f.amount} onChange={e=>setF({...f,amount:e.target.value})}/>
          <input type="number" min="1" max="31" value={f.day} onChange={e=>setF({...f,day:e.target.value})}/>
          <select value={f.type} onChange={e=>setF({...f,type:e.target.value,categoryId:e.target.value==='income'?'income':defaultCat})}>
            <option value="expense">Uscita</option>
            <option value="income">Entrata</option>
          </select>
          {f.type==='expense' && <select value={f.categoryId} onChange={e=>setF({...f,categoryId:e.target.value})}>{cats.map(c=> <option key={c.id} value={c.id}>{c.name}</option>)}</select>}
          <input type="number" min="0" max="15" value={f.remindDays} onChange={e=>setF({...f,remindDays:e.target.value})} title="Giorni di preavviso"/>
          <button onClick={() => { save(); setShowAdd(false); }}>Aggiungi</button>
        </div>
      }
    </div>
    <div className="txCards recCards">
      {(data.recurrences||[]).map(r => {
        const date = `${month}-${String(Math.min(Number(r.day||1),daysInMonth(month))).padStart(2,'0')}`;
        const exists = txAll.some(t => t.date===date && t.description===r.description && Number(t.amount)===Number(r.amount) && t.type===r.type);
        const color = r.type === 'income' ? '#22c55e' : (cats.find(c => c.id === r.categoryId)?.color || '#3b82f6');
        return <div className={`txCard recCard ${!r.active?'muted':''}`} style={{gridTemplateColumns:'auto 14px 1fr auto auto auto auto'}} key={r.id}>
          <CalendarClock/>
          <span className="dot" style={{background: color}}></span>
          <div className="txMain">
            <b>{r.description}</b>
            <span>{r.type==='income'?'Entrata':'Uscita'} · giorno {r.day} · {catName(r.categoryId)} · avviso {r.remindDays??0}g</span>
            <small>{exists ? 'Già applicata al mese corrente' : 'Da applicare al mese corrente'}</small>
          </div>
          <strong className={r.type==='income' ? 'pos' : 'neg'}>{r.type==='income' ? '+' : '-'}{eur(r.amount)}</strong>
          <button onClick={() => toggle(r.id)}>{r.active ? 'On' : 'Off'}</button>
          <button onClick={() => setEditRec(r)}>Modifica</button>
          <button onClick={() => remove(r.id)}><Trash2 size={16}/></button>
        </div>;
      })}
    </div>
    {editRec && <RecurrenceEditor rec={editRec} close={() => setEditRec(null)} />}
  </section>
}
function Reports({stats,txAll,cats,month,prev}){const last6=[...Array(6)].map((_,i)=>{const d=new Date(Number(month.slice(0,4)),Number(month.slice(5,7))-1-i,1);const m=monthKey(d);const spent=txAll.filter(t=>t.type==='expense'&&String(t.date).startsWith(m)).reduce((s,t)=>s+Number(t.amount),0);return{m,spent}}).reverse();const fixed=stats.byCat.filter(c=>c.kind==='fixed').reduce((s,c)=>s+c.spent,0);return <section className="panel"><h2>Report utili</h2><div className="reportGrid"><Insight text={`Spese fisse: ${eur(fixed)} · variabili: ${eur(stats.spent-fixed)}.`}/><Insight text={`Media giornaliera spese: ${eur(stats.spent/dayOfMonth())}.`}/><Insight text={`Previsione fine mese: ${eur(stats.spent/dayOfMonth()*daysInMonth(month))}.`}/>{stats.byCat.filter(c=>c.pct>=80).map(c=><Insight key={c.id} text={`${c.name} è al ${Math.round(c.pct)}% del budget.`}/>)}</div><h3>Ultimi 6 mesi</h3><div className="budgetList">{last6.map(x=><div className="budgetRow" key={x.m}><div>{x.m}</div><strong>{eur(x.spent)}</strong><div className="track"><i style={{width:`${Math.min(100,x.spent/Math.max(1,...last6.map(z=>z.spent))*100)}%`}}/></div></div>)}</div></section>}
function Backup({lastB,dirty,makeBackup,restoreBackup,data,setData}){const file=useRef();return <section className="panel"><h2>Backup & sicurezza</h2><div className="backupBox"><p><b>Ultimo backup:</b> {lastB?new Date(lastB).toLocaleString('it-IT'):'mai'}</p><p><b>Modifiche non salvate in backup:</b> {dirty}</p><button className="primary" onClick={makeBackup}><Download size={16}/>Esporta backup completo</button><button onClick={()=>file.current.click()}><RotateCcw size={16}/>Ripristina backup</button><input hidden type="file" accept=".json" ref={file} onChange={e=>restoreBackup(e.target.files[0])}/></div><PinSettings data={data} setData={setData}/></section>}
function PinSettings({data,setData}){const [pin,setPin]=useState('');return <div className="backupBox"><h3>PIN locale</h3><p>Protegge l’apertura su questo dispositivo. Non è sincronizzato.</p><input placeholder="Nuovo PIN" type="password" inputMode="numeric" value={pin} onChange={e=>setPin(e.target.value)}/><button onClick={()=>{setData(d=>({...d,settings:{...d.settings,pin}}));alert(pin?'PIN impostato':'PIN rimosso')}}>{pin?'Imposta PIN':'Rimuovi PIN'}</button></div>}
function Reminder({makeBackup,close}){return <div className="modal"><div className="sheet"><h2>Backup consigliato</h2><p>Non fai un backup da 7 giorni. Vuoi salvare ora su iCloud Drive?</p><button className="primary" onClick={makeBackup}>Salva backup</button><button onClick={close}>Più tardi</button></div></div>}
function CsvPreview({preview,close,confirm}){return <div className="modal"><div className="sheet large"><button className="x" onClick={close}><X/></button><h2>Anteprima import CSV</h2><p>{preview.rows.length} righe rilevate · {preview.duplicates} possibili duplicati verranno saltati.</p><div className="preview">{preview.rows.slice(0,20).map(r=><div key={r.id}><span>{r.date}</span><b>{r.description}</b><span>{r.categoryName}</span><strong>{eur(r.amount)}</strong></div>)}</div><button className="primary" onClick={confirm}>Importa senza duplicati</button></div></div>}

createRoot(document.getElementById('root')).render(<App/>);
