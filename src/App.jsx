
import React, {useEffect, useMemo, useRef, useState} from 'react';
// createRoot is used in main.jsx to mount the app. Not needed here.
import { BarChart3, CalendarClock, CheckCircle2, ChevronRight, Copy, Download, FileJson, LayoutDashboard, ListChecks, Lock, Plus, Repeat, RotateCcw, Search, ShieldCheck, Tags, Trash2, Upload, Wallet, X } from 'lucide-react';
// Import storage helpers and migrations
import { loadData, saveData, isIndexedDBAvailable } from './data/storage.js';
import { migrateData } from './data/migrations.js';
import { defaultData as initialDefaultData } from './data/defaultData.js';
import {
  today as utilToday,
  monthKey as utilMonthKey,
  daysInMonth as utilDaysInMonth,
  dayOfMonth as utilDayOfMonth,
  prevMonth as utilPrevMonth,
  normDate as utilNormDate,
} from './utils/dates.js';
import { parseEuro as utilParseEuro, eur as utilEur } from './utils/money.js';
import { guessCategoryName } from './utils/categories.js';
import './styles.css';

const COLORS=['#3b82f6','#22c55e','#ec4899','#facc15','#ef4444','#d946ef','#8b5cf6','#60a5fa','#14b8a6','#fb923c','#a3e635','#0f766e','#fb7185','#7dd3fc','#94a3b8'];
const uid=()=>crypto?.randomUUID?.()||Math.random().toString(36).slice(2,10);
const today=()=>new Date().toISOString().slice(0,10);
const monthKey=(d=new Date())=>d.toISOString().slice(0,7);
const eur=v=>new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR'}).format(Number(v||0));
const norm=v=>String(v??'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
const daysInMonth=m=>new Date(Number(m.slice(0,4)),Number(m.slice(5,7)),0).getDate();
const dayOfMonth=()=>new Date().getDate();
// Parse a Euro amount from a variety of formats. Handles comma or dot as decimal
// separators, optional euro symbol and spaces, negative numbers indicated
// by a minus sign or parentheses. Returns 0 for invalid input.
const parseEuro=v=>{
  let s=String(v??'').replace(/[€\s]/g,'').trim();
  if(!s)return 0;
  // Handle numbers enclosed in parentheses as negative (e.g. (12,50) => -12.50)
  let neg=false;
  if(s.startsWith('(') && s.endsWith(')')){
    s=s.slice(1,-1);
    neg=true;
  }
  // Replace thousand separators and unify decimal separator
  if(s.includes(',') && s.includes('.')){
    // assume period is thousands and comma is decimal
    s=s.replace(/\./g,'').replace(',','.');
  } else if(s.includes(',')){
    s=s.replace(',','.');
  }
  const n=Number(s);
  return Number.isFinite(n)?(neg?-n:n):0;
};
// Italian month abbreviations map for parsing dates like "5 mag 2026" or "05 maggio 2026".
const MONTHS_IT={gen:'01',feb:'02',mar:'03',apr:'04',mag:'05',giu:'06',lug:'07',ago:'08',set:'09',ott:'10',nov:'11',dic:'12'};
// Normalize various date formats into yyyy-mm-dd. Supports ISO, dd/mm/yyyy, dd-mm-yyyy,
// and Italian month names (both abbreviated and full) such as "5 mag 2026".
const normDate=v=>{
  const s=String(v??'').trim();
  // ISO format yyyy-mm-dd
  if(/^\d{4}-\d{2}-\d{2}$/.test(s))return s;
  // Formats dd/mm/yyyy or dd-mm-yyyy
  let m=s.match(/^(\d{1,2})[\/\.\-](\d{1,2})[\/\.\-](\d{2,4})$/);
  if(m){
    const y=m[3].length===2?'20'+m[3]:m[3];
    return `${y}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
  }
  // Format with month name: e.g. "5 mag 2026" or "05 maggio 2026"
  m=s.match(/^(\d{1,2})\s*([A-Za-zÀ-ÿ]{3,})\s*(\d{2,4})$/);
  if(m){
    const day=m[1].padStart(2,'0');
    // Use the first three letters of the month, normalized (without accents)
    let monthKeyStr=m[2].slice(0,3);
    monthKeyStr=norm(monthKeyStr).slice(0,3);
    let month=MONTHS_IT[monthKeyStr];
    if(!month){
      try{
        // Fallback: let Date.parse handle some month names
        const dtmp=new Date(`${m[2]} 1`);
        if(!Number.isNaN(dtmp)){
          const mm=dtmp.getMonth()+1;
          month=String(mm).padStart(2,'0');
        }
      }catch{}
    }
    const year=m[3].length===2?'20'+m[3]:m[3];
    return `${year}-${month||'01'}-${day}`;
  }
  const d=new Date(s);
  return Number.isNaN(d)?today():d.toISOString().slice(0,10);
};
const prevMonth=m=>{const d=new Date(Number(m.slice(0,4)),Number(m.slice(5,7))-2,1); return monthKey(d)};

function parseCsv(text){const rows=[];let row=[],cur='',q=false;const first=text.split(/\r?\n/)[0]||'';const sep=(first.match(/;/g)||[]).length>(first.match(/,/g)||[]).length?';':',';for(let i=0;i<text.length;i++){const ch=text[i],nx=text[i+1];if(ch==='"'&&q&&nx==='"'){cur+='"';i++;continue}if(ch==='"'){q=!q;continue}if(ch===sep&&!q){row.push(cur);cur='';continue}if((ch==='\n'||ch==='\r')&&!q){if(ch==='\r'&&nx==='\n')i++;row.push(cur);cur='';if(row.some(x=>String(x).trim()))rows.push(row.map(x=>String(x).trim()));row=[];continue}cur+=ch}row.push(cur);if(row.some(x=>String(x).trim()))rows.push(row.map(x=>String(x).trim()));return rows}

const defaultCats=[['Spesa',400,'variable'],['Bar / Colazioni / Snack',250,'variable'],['Asporto / Delivery',200,'variable'],['Casa',160,'fixed'],['Affitto',650,'fixed'],['Bollette',90,'fixed'],['Trasporti',70,'variable'],['Salute',50,'variable'],['Shopping / Personale',50,'variable'],['Tempo Libero',30,'variable'],['Abbonamenti',25,'fixed'],['Rate / Finanziamenti',10,'fixed'],['Regali',10,'variable'],['Viaggi',10,'variable'],['Varie / Altro',10,'variable']].map((x,i)=>({id:uid(),name:x[0],budget:x[1],kind:x[2],type:'expense',color:COLORS[i%COLORS.length]}));
const demoTx=[{id:uid(),date:today(),description:'Stipendio',categoryId:'income',type:'income',amount:1950,notes:'Entrata ricorrente'}];
[387,240,200,150,114,80,60,48,40,25,20,6,2,0,0].forEach((a,i)=>{if(a)demoTx.push({id:uid(),date:today(),description:defaultCats[i].name,categoryId:defaultCats[i].id,type:'expense',amount:a,notes:''})});
// Updated to version 18 for the v18 release. When merging user data with defaults
// we use this version to signal the current schema. This must increment on
// breaking changes.  The `budgets` field allows storing per-month budgets for each
// category.  Initially it is empty and budgets fall back to each category's
// `budget` property.  When editing budgets for a specific month, entries in
// `budgets[month][categoryId]` override the default.
const defaultData={
  // Current schema version. Increment this when breaking changes are introduced.
  // v25: update the application data version. This number is stored alongside
  // user data in localStorage and signals the schema version for migrations.
  version:25,
  categories:defaultCats,
  transactions:demoTx,
  recurrences:[
    {id:uid(),description:'Stipendio',categoryId:'income',type:'income',amount:1950,day:1,active:true,frequency:'monthly',remindDays:2,autoApply:false},
    {id:uid(),description:'Affitto',categoryId:defaultCats[4].id,type:'expense',amount:650,day:1,active:true,frequency:'monthly',remindDays:3,autoApply:false},
    {id:uid(),description:'Netflix',categoryId:defaultCats[10].id,type:'expense',amount:12.99,day:7,active:true,frequency:'monthly',remindDays:2,autoApply:false},
    {id:uid(),description:'Bollette luce/gas',categoryId:defaultCats[5].id,type:'expense',amount:85,day:15,active:true,frequency:'monthly',remindDays:5,autoApply:false},
    {id:uid(),description:'Rata finanziamento',categoryId:defaultCats[11].id,type:'expense',amount:120,day:20,active:true,frequency:'monthly',remindDays:3,autoApply:false}
  ],
  settings:{
    pin:'',
    lastCategoryId:defaultCats[0].id,
    dirtyCount:0,
    quickFavorites:defaultCats.slice(0,6).map(c=>c.id)
  },
  // monthly budgets keyed by YYYY-MM. Each entry contains categoryId => budget.
  budgets:{},
  // Saved CSV column mappings keyed by user-specified names. Each mapping
  // defines column indices for date, description, category, type, amount and notes.
  mappings:{},
  // Stores the ID of the most recent import batch for undoing imports.
  lastImportBatchId:null
};

function useData(){
  // Load persisted data from localStorage and merge with defaults. Use try/catch in case of malformed JSON.
  const [data,setData] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('budgetflow') || 'null') || {};
      // Merge saved data with defaults. Combine budgets so that saved budgets override defaults
      return {
        ...defaultData,
        ...saved,
        // merge budgets so that saved budgets override defaults
        budgets:{...defaultData.budgets, ...(saved.budgets || {})},
        // merge saved mappings overriding defaults
        mappings:{...defaultData.mappings, ...(saved.mappings || {})},
        // restore last import batch ID if present
        lastImportBatchId: saved.lastImportBatchId ?? defaultData.lastImportBatchId
      };
    } catch {
      return defaultData;
    }
  });
  // Save current data back to localStorage on every change, carrying the latest version number.
  useEffect(() => {
    // Persist data with the current version number. Spread only the data object
    // and override version to help with future migrations.
    // Persist the user data with the current schema version (25). This value is
    // used to detect outdated data in future updates. See defaultData.version.
    localStorage.setItem('budgetflow', JSON.stringify({ ...data, version: 25 }));
  }, [data]);
  return [data, setData];
}
function lastBackup(){return localStorage.getItem('budgetflow_last_backup')||''}
function daysFrom(iso){return iso?Math.floor((Date.now()-new Date(iso).getTime())/86400000):999}
function download(name,content,type='application/json'){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([content],{type}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}

function App(){
 const [data,setData]=useData();
 const [tab,setTab]=useState('dashboard');
 const [month,setMonth]=useState(monthKey());
 const [modal,setModal]=useState(null);
 const [query,setQuery]=useState('');
 const [selected,setSelected]=useState([]);
 const [lastB,setLastB]=useState(lastBackup());
 const [locked,setLocked]=useState(Boolean(data.settings?.pin));
 const [pinTry,setPinTry]=useState('');
 // importer state holds information about the current CSV file being imported. When not null,
 // it triggers the CsvImportModal component.
 const [importer,setImporter]=useState(null);
 const cats=data.categories||[]; const txAll=data.transactions||[]; const monthTx=txAll.filter(t=>String(t.date).startsWith(month));
 const expenseCats=cats.filter(c=>c.type==='expense');
 const stats=useMemo(()=>{
   // Determine budgets for the current month. If no entry exists for a category,
   // fall back to the category's default budget.
   const monthBudgets=(data.budgets&&data.budgets[month])||{};
   const budget=expenseCats.reduce((s,c)=>s+Number((monthBudgets[c.id]??c.budget)||0),0);
   const income=monthTx.filter(t=>t.type==='income').reduce((s,t)=>s+Number(t.amount),0);
   const spent=monthTx.filter(t=>t.type==='expense').reduce((s,t)=>s+Number(t.amount),0);
   let byCat=expenseCats.map(c=>{
     const spentCat=monthTx.filter(t=>t.type==='expense'&&t.categoryId===c.id).reduce((s,t)=>s+Number(t.amount),0);
     const catBudget=monthBudgets[c.id]??c.budget;
     const pct=catBudget?spentCat/catBudget*100:0;
     return {...c, budget:catBudget, spent:spentCat, diff:Number(catBudget||0)-spentCat, pct, share:spent?0:0};
   }).sort((a,b)=>b.spent-a.spent);
   byCat=byCat.map(c=>({...c,share:spent?c.spent/spent*100:0}));
   return{budget,income,spent,remaining:budget-spent,balance:income-spent,byCat};
 },[monthTx,cats,data.budgets,month]);
 const prev=useMemo(()=>{const p=prevMonth(month);return txAll.filter(t=>String(t.date).startsWith(p)&&t.type==='expense').reduce((m,t)=>({...m,[t.categoryId]:(m[t.categoryId]||0)+Number(t.amount)}),{})},[txAll,month]);

 const recurrenceInfo=useMemo(()=>{const list=(data.recurrences||[]).filter(r=>r.active);const todayD=new Date();const cur=todayD.toISOString().slice(0,7);const y=Number(month.slice(0,4)),m=Number(month.slice(5,7))-1;const upcoming=list.map(r=>{const date=`${month}-${String(Math.min(Number(r.day||1),daysInMonth(month))).padStart(2,'0')}`;const d=new Date(date+'T12:00:00');const diff=Math.ceil((d-todayD)/86400000);const exists=txAll.some(t=>t.date===date&&t.description===r.description&&Number(t.amount)===Number(r.amount)&&t.type===r.type);return{...r,date,diff,exists,categoryName:cats.find(c=>c.id===r.categoryId)?.name||'Accrediti'}}).filter(r=>!r.exists&&r.diff>=0).sort((a,b)=>a.diff-b.diff);const pendingMonth=list.map(r=>{const date=`${month}-${String(Math.min(Number(r.day||1),daysInMonth(month))).padStart(2,'0')}`;const exists=txAll.some(t=>t.date===date&&t.description===r.description&&Number(t.amount)===Number(r.amount)&&t.type===r.type);return exists?null:{...r,date}}).filter(Boolean);const futureIncome=pendingMonth.filter(r=>r.type==='income').reduce((s,r)=>s+Number(r.amount||0),0);const futureExpense=pendingMonth.filter(r=>r.type==='expense').reduce((s,r)=>s+Number(r.amount||0),0);return{upcoming,pendingMonth,futureIncome,futureExpense,forecastBalance:stats.balance+futureIncome-futureExpense}} ,[data.recurrences,month,txAll,cats,stats.balance]); const due=daysFrom(lastB)>=7;
 useEffect(()=>{ if(due && !sessionStorage.getItem('bf_backup_popup')){sessionStorage.setItem('bf_backup_popup','1'); setModal({type:'backupReminder'});} },[]);
 const touch=()=>setData(d=>({...d,settings:{...d.settings,dirtyCount:(d.settings?.dirtyCount||0)+1}}));
 const saveTx=t=>{setData(d=>({...d,transactions:t.id?d.transactions.map(x=>x.id===t.id?t:x):[{...t,id:uid()},...d.transactions],settings:{...d.settings,lastCategoryId:t.categoryId,dirtyCount:(d.settings?.dirtyCount||0)+1}}));setModal(null)};
 const delTx=ids=>{if(!ids.length)return;if(confirm(`Eliminare ${ids.length} transazioni?`)){setData(d=>({...d,transactions:d.transactions.filter(t=>!ids.includes(t.id)),settings:{...d.settings,dirtyCount:(d.settings?.dirtyCount||0)+1}}));setSelected([])}};
 const duplicate=t=>saveTx({...t,id:undefined,date:today(),description:t.description+' copia'});
 const saveCat=c=>{setData(d=>({...d,categories:c.id?d.categories.map(x=>x.id===c.id?c:x):[...d.categories,{...c,id:uid()}],settings:{...d.settings,dirtyCount:(d.settings?.dirtyCount||0)+1}}));setModal(null)};
 const delCat=id=>{if(confirm('Eliminare categoria e transazioni collegate?'))setData(d=>({...d,categories:d.categories.filter(c=>c.id!==id),transactions:d.transactions.filter(t=>t.categoryId!==id)}))};
 const copyPrevBudget=()=>{
   const pm=prevMonth(month);
   setData(d=>{
     const prevBud=(d.budgets&&d.budgets[pm])||{};
     // Build a budgets map for the current month: copy from previous month budgets
     const currBud={};
     (d.categories||[]).filter(c=>c.type==='expense').forEach(c=>{
       currBud[c.id]=prevBud[c.id]??c.budget;
     });
     return {
       ...d,
       budgets:{
         ...(d.budgets||{}),
         [month]:currBud
       },
       settings:{...d.settings,dirtyCount:(d.settings?.dirtyCount||0)+1}
     };
   });
 };

  // Undo the most recent CSV import by removing all transactions with the stored batch ID.
  const undoLastImport = () => {
    const batchId = data.lastImportBatchId;
    if(!batchId) return;
    if(!confirm('Annullare l\'ultimo import?')) return;
    setData(d => {
      return {
        ...d,
        transactions: d.transactions.filter(t => t.importBatchId !== batchId),
        lastImportBatchId: null,
        settings:{...d.settings, dirtyCount:(d.settings?.dirtyCount||0)+1}
      };
    });
  };
 const exportCsv=()=>{const rows=[['Data','Descrizione','Categoria','Tipo','Importo','Note'],...txAll.map(t=>[t.date,t.description,cats.find(c=>c.id===t.categoryId)?.name||'Accrediti',t.type,t.amount,t.notes||''])];download('budgetflow-transazioni.csv',rows.map(r=>r.map(v=>`"${String(v??'').replaceAll('"','""')}"`).join(',')).join('\n'),'text/csv')};
// Export a backup of all data to a JSON file. The exported backup contains
// the current version number (v17) so that future restores can handle schema
// changes gracefully.
const makeBackup=()=>{
  // Create a comprehensive backup including schema and app version numbers. Include the
  // entire data object so that categories (with budgets and colors), transactions,
  // recurrences, settings, budgets, mappings and histories are preserved. The
  // version fields are pulled from the current data or default to 30 for v30.
  const backupObj = {
    app: 'BudgetFlow',
    version: data?.version ?? 34,
    schemaVersion: data?.schemaVersion ?? 34,
    appVersion: data?.appVersion ?? '34',
    createdAt: new Date().toISOString(),
    data,
  };
  download(
    `budgetflow-backup-${today()}.json`,
    JSON.stringify(backupObj, null, 2)
  );
  localStorage.setItem('budgetflow_last_backup', new Date().toISOString());
  setLastB(lastBackup());
  setData(d => ({ ...d, settings: { ...d.settings, dirtyCount: 0 } }));
  setModal(null);
};
 const restoreBackup=async f=>{if(!f)return;const obj=JSON.parse(await f.text());if(!obj?.data?.transactions||!obj?.data?.categories)return alert('Backup non valido');if(confirm(`Ripristinare backup del ${new Date(obj.createdAt||Date.now()).toLocaleString('it-IT')}?`)){setData({...defaultData,...obj.data});setModal(null)}};
 // Deprecated CSV import function retained for backward compatibility. In v20 use CsvImportModal.
 const prepareCsv = async (f) => {
   // This function is intentionally left blank. The CSV import is handled by CsvImportModal.
 };
 // Deprecated confirm import function retained for backward compatibility. In v20 imports are confirmed in CsvImportModal.
 const confirmImport = () => {};
 const applyRecurrences=()=>{let added=0;setData(d=>{const out=[...d.transactions];for(const r of d.recurrences||[]){if(!r.active)continue;const date=`${month}-${String(Math.min(Number(r.day||1),daysInMonth(month))).padStart(2,'0')}`;const key=`${date}|${r.description}|${r.amount}|${r.type}`;if(!out.some(t=>`${t.date}|${t.description}|${t.amount}|${t.type}`===key)){out.push({id:uid(),date,description:r.description,categoryId:r.categoryId,type:r.type,amount:Number(r.amount||0),notes:`Ricorrenza automatica · ${r.frequency||'mensile'}`});added++}}return{...d,transactions:out,settings:{...d.settings,dirtyCount:(d.settings?.dirtyCount||0)+added}}});alert(added?`Aggiunte ${added} ricorrenze per il mese.`:'Nessuna ricorrenza da aggiungere.');};
 if(locked)return <LockScreen pin={data.settings.pin} pinTry={pinTry} setPinTry={setPinTry} unlock={()=>pinTry===data.settings.pin?setLocked(false):alert('PIN errato')}/>;
 return (
    <div className="app">
      <header className="top">
        <div>
          <h1>BudgetFlow</h1>
          <p>{new Date(month + '-01').toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })}</p>
        </div>
        <input type="month" value={month} onChange={e => setMonth(e.target.value)} />
      </header>
      {due && (
        <div className="backupBanner">
          <ShieldCheck size={18} />
          <span>Non fai un backup da 7 giorni. Vuoi salvare ora su iCloud Drive?</span>
          <button onClick={makeBackup}>Salva backup</button>
        </div>
      )}
      <main className="content">
        {tab === 'dashboard' && (
          <>
            <Dashboard
              stats={stats}
              prev={prev}
              month={month}
              cats={cats}
              setTab={setTab}
              recurrenceInfo={recurrenceInfo}
            />
            {/* Quick add card becomes a standard new transaction card. It opens the full transaction modal instead of the quick sheet. */}
            <div className="panel quickAddCard">
              <h2>+ Aggiungi spesa</h2>
              <p>Scegli importo, categoria e salva in pochi secondi.</p>
              <button className="primary" onClick={() => setModal({ type: 'tx' })}>
                <Plus size={16} />
                Nuova spesa
              </button>
            </div>
          </>
        )}
        {tab === 'transactions' && (
          <Transactions
            tx={monthTx}
            cats={cats}
            selected={selected}
            setSelected={setSelected}
            query={query}
            setQuery={setQuery}
            // Use the full transaction modal for adding a new transaction on the
            // transactions page. This preserves the linear, simple form design.
            onAdd={() => setModal({ type: 'tx' })}
            onEdit={t => setModal({ type: 'tx', tx: t })}
            onDelete={delTx}
            onDup={duplicate}
            exportCsv={exportCsv}
            importCsv={f => setImporter({ file: f })}
            undoImport={undoLastImport}
            lastImportBatchId={data.lastImportBatchId}
          />
        )}
        {tab === 'categories' && (
          <Categories
            cats={cats}
            saveCat={saveCat}
            delCat={delCat}
            edit={c => setModal({ type: 'cat', cat: c })}
            add={() => setModal({ type: 'cat' })}
            copyPrevBudget={copyPrevBudget}
            month={month}
            budgets={data.budgets}
          />
        )}
        {tab === 'recurrences' && (
          <Recurrences
            data={data}
            cats={cats}
            setData={setData}
            applyRecurrences={applyRecurrences}
            month={month}
            txAll={txAll}
            recurrenceInfo={recurrenceInfo}
          />
        )}
        {tab === 'reports' && (
          <Reports
            stats={stats}
            txAll={txAll}
            cats={cats}
            month={month}
            prev={prev}
            recurrenceInfo={recurrenceInfo}
          />
        )}
        {tab === 'backup' && (
          <Backup
            lastB={lastB}
            dirty={data.settings?.dirtyCount || 0}
            makeBackup={makeBackup}
            restoreBackup={restoreBackup}
            data={data}
            setData={setData}
          />
        )}
      </main>
      {/* Floating action button removed in v25.  The quick add is now available via
          a card on the dashboard and the “+ Nuova” button on the Transazioni page.
          Keeping this section empty prevents the button from overlaying content on mobile. */}
      {false && (
        <button
          className="fab"
          onClick={() => {
            setModal({ type: 'quick' });
          }}
        >
          <Plus />
        </button>
      )}
      {/* Navigation bar: include a new Report tab. The bottom class defaults to 5-column layout. */}
      <nav className="bottom">
        <Tab id="dashboard" tab={tab} setTab={setTab} icon={<LayoutDashboard />} label="Dashboard" />
        <Tab id="transactions" tab={tab} setTab={setTab} icon={<ListChecks />} label="Transazioni" />
        <Tab id="categories" tab={tab} setTab={setTab} icon={<Tags />} label="Categorie" />
        <Tab id="recurrences" tab={tab} setTab={setTab} icon={<Repeat />} label="Ricorr." />
        <Tab id="reports" tab={tab} setTab={setTab} icon={<BarChart3 />} label="Report" />
        <Tab id="backup" tab={tab} setTab={setTab} icon={<FileJson />} label="Backup" />
      </nav>
      {modal?.type === 'tx' && (
        // Pass setData to TxModal so it can update settings.quickFavorites
        <TxModal
          tx={modal.tx}
          cats={cats}
          save={saveTx}
          close={() => setModal(null)}
          settings={data.settings || {}}
          setData={setData}
        />
      )}
      {modal?.type === 'quick' && (
        <QuickAdd
          cats={cats}
          last={data.settings?.lastCategoryId}
          settings={data.settings || {}}
          setData={setData}
          txAll={txAll}
          save={saveTx}
          close={() => setModal(null)}
        />
      )}
      {modal?.type === 'cat' && (
        <CatModal
          cat={modal.cat}
          month={month}
          data={data}
          setData={setData}
          txAll={txAll}
          close={() => setModal(null)}
        />
      )}
      {modal?.type === 'backupReminder' && (
        <Reminder makeBackup={makeBackup} close={() => setModal(null)} />
      )}
      {importer && (
        <CsvImportModal file={importer.file} cats={cats} data={data} setData={setData} setImporter={setImporter} />
      )}
    </div>
  );
}
function Tab(p){return <button className={p.tab===p.id?'active':''} onClick={()=>p.setTab(p.id)}>{React.cloneElement(p.icon,{size:20})}<span>{p.label}</span></button>}
function LockScreen({pinTry,setPinTry,unlock}){return <div className="lock"><Lock size={42}/><h1>BudgetFlow</h1><p>Inserisci il PIN locale</p><input value={pinTry} onChange={e=>setPinTry(e.target.value)} type="password" inputMode="numeric" autoFocus/><button onClick={unlock}>Sblocca</button></div>}
function Card({title,value,sub,cls}){return <div className={'stat '+cls}><div className="statIcon"></div><div><p>{title}</p><h2>{value}</h2><span>{sub}</span></div></div>}
function Dashboard({stats,prev,cats,setTab,recurrenceInfo}){const positive=stats.byCat.filter(c=>c.spent>0);const circumference=2*Math.PI*72;let offset=0;return <><section className="mobileHero"><div><span>Saldo del mese</span><h2>{eur(stats.balance)}</h2><p>{stats.balance>=0?'Sei in positivo':'Saldo negativo'} · Budget rimasto {eur(stats.remaining)}</p></div><button onClick={()=>setTab('transactions')}>Transazioni</button></section><section className="stats"><Card cls="blue" title="Uscite" value={eur(stats.spent)} sub={`${Math.round(stats.budget?stats.spent/stats.budget*100:0)}% del budget`}/><Card cls="green" title="Budget" value={eur(stats.budget)} sub="Somma categorie"/><Card cls="yellow" title="Rimanente" value={eur(stats.remaining)} sub="Disponibile"/><Card cls="purple" title="Accrediti" value={eur(stats.income)} sub="Entrate del mese"/></section><section className="grid dashGrid"><div className="panel mobileCompact"><h2>Distribuzione spese</h2><div className="donutWrap"><svg viewBox="0 0 180 180" className="donut">{positive.map(c=>{const dash=c.share/100*circumference;const el=<circle key={c.id} cx="90" cy="90" r="72" fill="none" stroke={c.color} strokeWidth="22" strokeDasharray={`${dash} ${circumference-dash}`} strokeDashoffset={-offset} strokeLinecap="butt"/>;offset+=dash;return el})}<circle cx="90" cy="90" r="50" fill="var(--card)"/><text x="90" y="86" textAnchor="middle" className="donutTotal">{eur(stats.spent)}</text><text x="90" y="105" textAnchor="middle" className="donutSub">spese</text></svg></div><div className="legend compact">{positive.slice(0,8).map(c=><div key={c.id}><span style={{background:c.color}}/><b>{c.name}</b><strong>{eur(c.spent)}</strong><em>{c.share.toFixed(1)}%</em></div>)}</div></div><div className="panel mobileCompact"><h2>Spese per categoria</h2><CategoryBars items={positive}/></div></section><div className="recMini"><div><span>Previsione saldo con ricorrenze</span><b>{eur(recurrenceInfo?.forecastBalance||stats.balance)}</b><p>{recurrenceInfo?.pendingMonth?.length||0} ricorrenze ancora da applicare nel mese</p></div><button onClick={()=>setTab('recurrences')}>Gestisci</button></div><section className="panel mobileCompact"><div className="sectionTitle"><h2>Riepilogo intelligente</h2><button onClick={()=>setTab('reports')}>Report <ChevronRight size={16}/></button></div><div className="insights"><Insight text={`Ti restano ${eur(stats.remaining)}. Puoi spendere circa ${eur(Math.max(0,stats.remaining)/(daysInMonth(monthKey())-dayOfMonth()+1))} al giorno fino a fine mese.`}/>{stats.byCat.filter(c=>c.spent>prev[c.id]&&prev[c.id]).slice(0,2).map(c=><Insight key={c.id} text={`Hai speso ${eur(c.spent-prev[c.id])} in più in ${c.name} rispetto al mese scorso.`}/>)}</div></section><section className="panel mobileDetail"><h2>Budget vs speso</h2><div className="budgetList">{stats.byCat.map(c=><div key={c.id} className="budgetRow"><div><span style={{background:c.color}}/>{c.name}</div><strong>{eur(c.spent)} / {eur(c.budget)}</strong><div className="track"><i style={{width:`${Math.min(100,c.pct)}%`,background:c.pct>=100?'#ef4444':c.pct>=80?'#facc15':'#22c55e'}}/></div></div>)}</div></section></>}
function CategoryBars({items}){const max=Math.max(1,...items.map(i=>i.spent));return <div className="mobileBars">{items.map(i=><div key={i.id} className="mbar"><div className="mbarTop"><span style={{background:i.color}}/>{i.name}<b>{eur(i.spent)}</b></div><div className="track"><i style={{width:`${i.spent/max*100}%`,background:i.color}}/></div></div>)}</div>}
function Insight({text}){return <div className="insight"><CheckCircle2 size={18}/>{text}</div>}
function SwipeTx({t,c,selected,setSelected,onEdit,onDelete,onDup}){const [x,setX]=useState(0);const sx=useRef(0);const dx=useRef(0);const start=e=>{sx.current=e.touches?.[0]?.clientX||0;dx.current=0};const move=e=>{const v=(e.touches?.[0]?.clientX||0)-sx.current;dx.current=v;if(Math.abs(v)>8)setX(Math.max(-96,Math.min(96,v)))};const end=()=>{if(dx.current<-74){setX(-96);setTimeout(()=>{setX(0);onDelete([t.id])},120)}else if(dx.current>74){setX(96);setTimeout(()=>{setX(0);onEdit(t)},120)}else setX(0)};return <div className="swipeShell"><div className="swipeBg left">Modifica</div><div className="swipeBg right">Elimina</div><div className="txCard nativeCard" style={{transform:`translateX(${x}px)`}} onTouchStart={start} onTouchMove={move} onTouchEnd={end}><input aria-label="Seleziona transazione" type="checkbox" checked={selected.includes(t.id)} onChange={e=>setSelected(s=>e.target.checked?[...s,t.id]:s.filter(x=>x!==t.id))}/><div className="dot" style={{background:t.type==='income'?'#a855f7':c?.color}}/><div className="txMain"><b>{t.description}</b><span>{new Date(t.date).toLocaleDateString('it-IT')} · {t.type==='income'?'Accrediti':c?.name}</span></div><strong className={t.type}>{t.type==='income'?'+':'-'}{eur(t.amount)}</strong><button className="desktopAction" onClick={()=>onDup(t)}><Copy size={16}/></button><button className="desktopAction" onClick={()=>onEdit(t)}>Modifica</button></div></div>}
function TxModal({ tx, cats, save, close, settings, setData }) {
  const [f, setF] = useState(tx || {
    date: today(),
    description: '',
    categoryId: cats[0]?.id,
    type: 'expense',
    amount: '',
    notes: '',
  });
  const [showCats, setShowCats] = useState(false);
  // Toggle favourite editing mode
  const [editFav, setEditFav] = useState(false);
  // Determine expense categories and favourites
  const expenseCats = cats.filter((c) => c.type === 'expense');
  // Favourite category IDs from settings. Do not auto-select defaults; allow user choice.
  const favIds = settings?.quickFavorites && settings.quickFavorites.length
    ? settings.quickFavorites
    : [];
  const favCats = expenseCats.filter((c) => favIds.includes(c.id));
  const allCats = expenseCats;
  // Whether there are any favourite categories saved
  const hasFavs = favCats.length > 0;
  const selectCat = (id) => setF((prev) => ({ ...prev, categoryId: id }));
  // Toggle a category as favourite. Limit to 6 favourites.
  const toggleFav = (id) => {
    const exists = favIds.includes(id);
    let next = exists ? favIds.filter((x) => x !== id) : [...favIds, id];
    if (next.length > 6) {
      alert('Puoi scegliere al massimo 6 categorie preferite');
      return;
    }
    // Persist in settings using setData
    if (setData) {
      setData((d) => ({
        ...d,
        settings: {
          ...d.settings,
          quickFavorites: next,
          dirtyCount: (d.settings?.dirtyCount || 0) + 1,
        },
      }));
    }
  };
  const onSubmit = (e) => {
    e.preventDefault();
    save({ ...f, amount: parseEuro(f.amount) });
  };
  const handleTypeChange = (val) => {
    if (val === 'income') {
      setF((prev) => ({ ...prev, type: val, categoryId: 'income' }));
    } else {
      setF((prev) => ({ ...prev, type: val, categoryId: expenseCats[0]?.id }));
    }
  };
  return (
    <div className="modal">
      <form className="sheet txSheet" onSubmit={onSubmit}>
        <button className="x" type="button" onClick={close}>
          <X />
        </button>
        <h2>{tx ? 'Modifica transazione' : (f.type === 'income' ? 'Nuova entrata' : 'Nuova uscita')}</h2>
        <input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
        <input
          className="txAmount"
          inputMode="decimal"
          placeholder="0,00 €"
          value={f.amount}
          onChange={(e) => setF({ ...f, amount: e.target.value })}
        />
        <input
          placeholder="Descrizione"
          value={f.description}
          onChange={(e) => setF({ ...f, description: e.target.value })}
        />
        <div className="txTypeRow">
          <label>Tipo</label>
          <select
            value={f.type}
            onChange={(e) => handleTypeChange(e.target.value)}
          >
            <option value="expense">Uscita</option>
            <option value="income">Entrata</option>
          </select>
        </div>
        {f.type === 'expense' && (
          editFav ? (
            <div className="favoriteEditorTx">
              <p className="info">
                Scegli fino a 6 categorie da mostrare nell’inserimento rapido.
              </p>
              {expenseCats.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={favIds.includes(c.id) ? 'on' : ''}
                  onClick={() => toggleFav(c.id)}
                >
                  <span style={{ background: c.color || '#3b82f6' }} />
                  {c.name}
                  {favIds.includes(c.id) && <small>✓</small>}
                </button>
              ))}
              <button type="button" onClick={() => setEditFav(false)}>
                Fine
              </button>
            </div>
          ) : (
            <div className="txCategories">
              <div className="txCatHeader">
                <b>Categorie</b>
                {hasFavs && expenseCats.length > favCats.length && (
                  <button type="button" onClick={() => setShowCats((s) => !s)}>
                    {showCats ? 'Preferite' : 'Tutte'}
                  </button>
                )}
                <button type="button" onClick={() => setEditFav(true)}>
                  Modifica preferiti
                </button>
              </div>
              {!hasFavs && !showCats && (
                <p className="noFav">
                  Nessuna categoria preferita. Tocca “Modifica preferiti” per
                  scegliere fino a 6 categorie.
                </p>
              )}
              <div className="txCatList">
                {(
                  showCats || !hasFavs ? allCats : favCats
                ).map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={f.categoryId === c.id ? 'sel' : ''}
                    onClick={() => selectCat(c.id)}
                  >
                    <span style={{ background: c.color || '#3b82f6' }} />
                    {c.name}
                  </button>
                ))}
              </div>
            </div>
          )
        )}
        {f.type === 'income' && (
          <div className="txCategories">
            <div className="txCatList">
              <button type="button" className="sel">
                <span style={{ background: '#22c55e' }} />
                Accrediti / Entrata
              </button>
            </div>
          </div>
        )}
        <textarea
          placeholder="Note"
          value={f.notes || ''}
          onChange={(e) => setF({ ...f, notes: e.target.value })}
        />
        <button className="primary txSave">Salva</button>
      </form>
    </div>
  );
}
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
  <button className="primary saveFast">Salva spesa</button>
 </form></div>
}

/*
 * Enhanced Transactions component for v20.
 * Adds support for undoing the last CSV import and integrates with the new CSV import modal.
 * Accepts additional props: undoImport and lastImportBatchId.
 */
function Transactions({tx,cats,selected,setSelected,query,setQuery,onAdd,onEdit,onDelete,onDup,exportCsv,importCsv,undoImport,lastImportBatchId}){
  // Filter transactions based on search query matching description or category name
  const filtered=tx.filter(t=>norm(t.description).includes(norm(query))||norm(cats.find(c=>c.id===t.categoryId)?.name).includes(norm(query)));
  const file=useRef();
  return (
    <section className="panel trans nativePanel">
      <div className="sectionTitle nativeTitle">
        <div>
          <h2>Transazioni</h2>
          <p>Scorri una card a sinistra per eliminare o a destra per modificare.</p>
        </div>
        <div className="actions nativeActions">
          <button onClick={exportCsv}><Download size={16}/>CSV</button>
          <button onClick={()=>file.current.click()}><Upload size={16}/>Importa</button>
          <input hidden ref={file} type="file" accept=".csv,text/csv" onChange={e=>importCsv(e.target.files[0])}/>
          <button className="primary" onClick={onAdd}><Plus size={16}/>Nuova</button>
        </div>
      </div>
      <div className="toolbar">
        <div className="search">
          <Search size={18}/>
          <input placeholder="Cerca spesa, categoria, nota" value={query} onChange={e=>setQuery(e.target.value)}/>
        </div>
        {lastImportBatchId && <button className="warning" onClick={undoImport}><RotateCcw size={16}/>Annulla import</button>}
      </div>
      {/* When some transactions are selected, show a selection toolbar with additional actions. */}
      {selected.length > 0 && (
        <div className="selectToolbar">
          <span>{selected.length} selezionate</span>
          <button type="button" onClick={() => setSelected(filtered.map(t => t.id))}>Seleziona tutto</button>
          <button type="button" onClick={() => setSelected([])}>Deseleziona</button>
          <button type="button" className="danger" onClick={() => onDelete(selected)}><Trash2 size={16}/>Elimina</button>
        </div>
      )}
      {filtered.length===0 ? (
        <div className="empty">Nessuna transazione. Tocca + per aggiungere una spesa in pochi secondi.</div>
      ) : (
        <div className="txCards nativeList">
          {filtered.map(t => {
            const c=cats.find(c=>c.id===t.categoryId);
            return <SwipeTx key={t.id} t={t} c={c} selected={selected} setSelected={setSelected} onEdit={onEdit} onDelete={onDelete} onDup={onDup}/>;
          })}
        </div>
      )}
    </section>
  );
}
function Categories({cats,saveCat,delCat,edit,add,copyPrevBudget,month,budgets}){
  // budgets is the top-level budgets object. Determine budgets for the given month.
  const monthBudgets=(budgets&&budgets[month])||{};
  return <section className="panel">
    <div className="sectionTitle"><h2>Budget categorie</h2>
      <div className="actions">
        <button onClick={copyPrevBudget}>Copia mese scorso</button>
        <button className="primary" onClick={add}><Plus size={16}/>Nuova</button>
      </div>
    </div>
    <div className="catGrid">
      {cats.map(c=>{
        // Use monthly budget if available, otherwise fall back to the category's default budget
        const currentBudget=monthBudgets[c.id]??c.budget;
        return <div className="catCard" key={c.id}>
          <span style={{background:c.color}}/>
          <div><b>{c.name}</b><p>{c.kind==='fixed'?'Fissa':'Variabile'} · {eur(currentBudget)}</p></div>
          <button onClick={()=>edit(c)}>Modifica</button>
          <button onClick={()=>delCat(c.id)}><Trash2 size={16}/></button>
        </div>;
      })}
    </div>
  </section>;
}
// Modal for editing or creating a category. When editing an existing category this
// modal also allows adjusting the budget for the current month and provides
// quick suggestions based on previous spending. It updates the categories
// array and the budgets map via setData directly rather than using saveCat.
function CatModal({cat, close, month, data, setData, txAll}) {
  // Initialize form state with defaults or the existing category. Use a
  // string for the budget input so users can type comma/period formats.
  const [f, setF] = useState(() => {
    if (cat) {
      return {
        name: cat.name,
        budget: String(cat.budget ?? '').replace('.', ','),
        kind: cat.kind || 'variable',
        color: cat.color || COLORS[0],
      };
    }
    return { name: '', budget: '', kind: 'variable', color: COLORS[0] };
  });

  // Compute budget suggestions: last month spent, average spend of last 3 months,
  // and last month budget. Only available when editing an existing category.
  const suggestions = [];
  if (cat) {
    try {
      const lastMonth = prevMonth(month);
      // Sum spent in the previous month for this category
      const lastSpent = txAll
        .filter(
          (t) =>
            t.type === 'expense' &&
            t.categoryId === cat.id &&
            String(t.date).startsWith(lastMonth)
        )
        .reduce((s, t) => s + Number(t.amount), 0);
      // Determine previous month budget (from budgets or default)
      const prevBud =
        (data.budgets?.[lastMonth] && data.budgets[lastMonth][cat.id]) ??
        cat.budget;
      // Compute average spend over last 3 months
      const months = [month, lastMonth, prevMonth(lastMonth)];
      const spends = months.map((mKey) =>
        txAll
          .filter(
            (t) =>
              t.type === 'expense' &&
              t.categoryId === cat.id &&
              String(t.date).startsWith(mKey)
          )
          .reduce((s, t) => s + Number(t.amount), 0)
      );
      const avgSpent = spends.reduce((a, b) => a + b, 0) / spends.length;
      if (lastSpent > 0) {
        suggestions.push({ label: 'Spesa ultimo mese', value: lastSpent });
      }
      if (avgSpent > 0) {
        suggestions.push({ label: 'Media ultimi 3 mesi', value: avgSpent });
      }
      if (prevBud > 0) {
        suggestions.push({ label: 'Budget mese scorso', value: prevBud });
      }
    } catch (e) {
      // Ignore any errors in computing suggestions
    }
  }

  // Helper to apply a suggestion to the budget input. Converts number to
  // Italian string with comma as decimal separator.
  const applySuggestion = (val) => {
    const num = Number(val) || 0;
    const str = num.toFixed(2).replace('.', ',');
    setF((prev) => ({ ...prev, budget: str }));
  };

  // Save handler: updates categories and budgets. When editing, update the
  // existing category and set the monthly budget; when creating, create a new
  // category with a new id and assign the monthly budget. Also update the
  // default budget on the category for future months.
  const onSave = (e) => {
    e.preventDefault();
    // Validate name and budget
    if (!f.name.trim()) {
      alert('Inserisci un nome');
      return;
    }
    const parsedBudget = parseEuro(f.budget);
    if (!Number.isFinite(parsedBudget) || parsedBudget < 0) {
      alert('Inserisci un importo valido');
      return;
    }
    if (cat) {
      // Editing existing category
      setData((d) => {
        const categories = d.categories.map((x) =>
          x.id === cat.id ? { ...x, name: f.name, color: f.color, kind: f.kind, budget: parsedBudget } : x
        );
        const monthBud = { ...(d.budgets?.[month] || {}) };
        monthBud[cat.id] = parsedBudget;
        return {
          ...d,
          categories,
          budgets: { ...d.budgets, [month]: monthBud },
          settings: { ...d.settings, dirtyCount: (d.settings?.dirtyCount || 0) + 1 },
        };
      });
    } else {
      // Creating new category
      const newId = uid();
      setData((d) => {
        const newCat = {
          id: newId,
          name: f.name,
          budget: parsedBudget,
          type: 'expense',
          kind: f.kind,
          color: f.color,
        };
        const monthBud = { ...(d.budgets?.[month] || {}) };
        monthBud[newId] = parsedBudget;
        return {
          ...d,
          categories: [...d.categories, newCat],
          budgets: { ...d.budgets, [month]: monthBud },
          settings: { ...d.settings, dirtyCount: (d.settings?.dirtyCount || 0) + 1 },
        };
      });
    }
    close();
  };
  return (
    <div className="modal">
      <form className="sheet" onSubmit={onSave}>
        <button className="x" type="button" onClick={close}>
          <X />
        </button>
        <h2>{cat ? 'Modifica categoria' : 'Nuova categoria'}</h2>
        <input
          placeholder="Nome"
          value={f.name}
          onChange={(e) => setF({ ...f, name: e.target.value })}
        />
        <input
          inputMode="decimal"
          placeholder="Budget mensile"
          value={f.budget}
          onChange={(e) => setF({ ...f, budget: e.target.value })}
        />
        {suggestions.length > 0 && (
          <div className="budgetSuggestions">
            {suggestions.map((s) => (
              <button
                key={s.label}
                type="button"
                onClick={() => applySuggestion(s.value)}
              >
                {s.label}: {eur(s.value)}
              </button>
            ))}
          </div>
        )}
        <select
          value={f.kind}
          onChange={(e) => setF({ ...f, kind: e.target.value })}
        >
          <option value="variable">Variabile</option>
          <option value="fixed">Fissa</option>
        </select>
        <input
          type="color"
          value={f.color}
          onChange={(e) => setF({ ...f, color: e.target.value })}
        />
        <button className="primary">Salva</button>
      </form>
    </div>
  );
}
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
      return (
        <div className={`txCard recCard ${!r.active ? 'muted' : ''}`} key={r.id}>
          <CalendarClock />
          <span className="dot" style={{ background: color }}></span>
          <div className="txMain">
            <b>{r.description}</b>
            <span>{r.type === 'income' ? 'Entrata' : 'Uscita'} · pagamento giorno {r.day} · {catName(r.categoryId)} · promemoria {r.remindDays ?? 0}g</span>
            <small>{exists ? 'Già applicata al mese corrente' : 'Da applicare al mese corrente'}</small>
          </div>
          <strong className={r.type === 'income' ? 'pos' : 'neg'}>
            {r.type === 'income' ? '+' : '-'}{eur(r.amount)}
          </strong>
          <div className="recActions">
            <button type="button" onClick={() => toggle(r.id)}>{r.active ? 'Disattiva' : 'Attiva'}</button>
            <button type="button" onClick={() => setEditRec(r)}>Modifica</button>
            <button type="button" onClick={() => remove(r.id)}><Trash2 size={16} /></button>
          </div>
        </div>
      );
      })}
    </div>
    {editRec && <RecurrenceEditor rec={editRec} close={() => setEditRec(null)} />}
  </section>
}
function Reports({ stats, txAll, cats, month, prev, recurrenceInfo }) {
  // Compute totals for the last 6 months: expenses, incomes and net balance
  const last6 = [...Array(6)].map((_, i) => {
    const d = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1 - i, 1);
    const m = monthKey(d);
    const spent = txAll
      .filter((t) => t.type === 'expense' && String(t.date).startsWith(m))
      .reduce((s, t) => s + Number(t.amount), 0);
    const income = txAll
      .filter((t) => t.type === 'income' && String(t.date).startsWith(m))
      .reduce((s, t) => s + Number(t.amount), 0);
    const net = income - spent;
    // Label: show month abbreviation and year (e.g. 'Mag 24') in Italian
    const label = new Date(m + '-01').toLocaleDateString('it-IT', { month: 'short', year: '2-digit' });
    return { m, label, spent, income, net };
  }).reverse();
  // Top 5 categories by spending this month
  const totalSpent = stats.spent || 0;
  const topCats = stats.byCat
    .filter((c) => c.type === 'expense')
    .slice(0, 5)
    .map((c) => {
      const diffPrev = (c.spent || 0) - (prev[c.id] || 0);
      const pct = totalSpent ? (c.spent / totalSpent) * 100 : 0;
      return { ...c, diffPrev, pct };
    });
  // Fixed vs variable expenses
  const fixedTotal = stats.byCat
    .filter((c) => c.kind === 'fixed')
    .reduce((s, c) => s + Number(c.spent || 0), 0);
  const variableTotal = totalSpent - fixedTotal;
  const fixedPct = totalSpent ? (fixedTotal / totalSpent) * 100 : 0;
  // Daily and forecast calculations
  const currentDay = dayOfMonth();
  const daysTotal = daysInMonth(month);
  const avgSpent = currentDay ? stats.spent / currentDay : 0;
  const avgIncome = currentDay ? stats.income / currentDay : 0;
  const remainingDays = Math.max(1, daysTotal - currentDay);
  const dailyBudget = remainingDays ? stats.remaining / remainingDays : 0;
  const predSpend = avgSpent * daysTotal;
  const futureIncome = recurrenceInfo?.futureIncome || 0;
  const futureExpense = recurrenceInfo?.futureExpense || 0;
  const predNetBalance = (stats.income + futureIncome) - (predSpend + futureExpense);
  // Income vs expenses ratio
  const ratio = stats.income ? (stats.spent / stats.income) * 100 : 0;
  // Alerts for categories out of control
  const alerts = [];
  stats.byCat.forEach((c) => {
    // Only expense categories
    if (c.type !== 'expense') return;
    const pct = c.pct || 0;
    const diff = (c.spent || 0) - (c.budget || 0);
    if (pct >= 100) {
      alerts.push(`${c.name} ha superato il budget di ${eur(Math.abs(diff))}.`);
    } else if (pct >= 90) {
      alerts.push(`${c.name} è al ${Math.round(pct)}% del budget.`);
    } else if (pct >= 80) {
      alerts.push(`${c.name} è all'${Math.round(pct)}% del budget.`);
    }
  });
  // Alerts for strong growth compared to previous month
  stats.byCat.forEach((c) => {
    if (c.type !== 'expense') return;
    const diffPrev = (c.spent || 0) - (prev[c.id] || 0);
    if (diffPrev > 0) {
      alerts.push(`${c.name} è aumentata di ${eur(diffPrev)} rispetto al mese scorso.`);
    }
  });
  // Suggestions
  const suggestions = [];
  // Suggestions for categories over budget
  stats.byCat.forEach((c) => {
    if (c.type !== 'expense') return;
    if (c.pct > 100) {
      const over = (c.spent || 0) - (c.budget || 0);
      suggestions.push(`Riduci ${c.name} di circa ${eur(Math.abs(over))} per rientrare nel budget.`);
    }
  });
  if (dailyBudget < 0) {
    suggestions.push(`Sei oltre budget di ${eur(Math.abs(stats.remaining))}. Dovresti ridurre le spese nei prossimi giorni.`);
  } else if (avgSpent > dailyBudget) {
    suggestions.push(
      `Stai spendendo in media ${eur(avgSpent)} al giorno. Per rientrare nel budget dovresti limitarti a ${eur(dailyBudget)} al giorno.`
    );
  } else {
    suggestions.push(`Hai ancora margine: puoi spendere circa ${eur(dailyBudget)} al giorno fino a fine mese.`);
  }
  if (predSpend > stats.budget) {
    const over = predSpend - stats.budget;
    suggestions.push(
      `Se continui così, spenderai circa ${eur(predSpend)} a fine mese, oltre il budget di ${eur(over)}.`
    );
  }
  if (fixedPct > 60) {
    suggestions.push(
      `Le spese fisse assorbono il ${Math.round(fixedPct)}% delle tue uscite: controlla abbonamenti e rate.`
    );
  }
  // Highlight categories with significant increase
  topCats.forEach((c) => {
    if (c.diffPrev > 0) {
      suggestions.push(`La categoria ${c.name} è cresciuta di ${eur(c.diffPrev)} rispetto al mese scorso.`);
    }
  });
  return (
    <section className="panel reports">
      <h2>Analisi &amp; Report</h2>
      {/* Last 6 months trend */}
      <div className="reportSection">
        <h3>Andamento ultimi 6 mesi</h3>
        <div className="last6">
          {last6.map((item) => (
            <div key={item.m} className="monthCard">
              <strong>{item.label}</strong>
              <p>Uscite: {eur(item.spent)}</p>
              <p>Entrate: {eur(item.income)}</p>
              <p>Saldo: {eur(item.net)}</p>
            </div>
          ))}
        </div>
      </div>
      {/* Top categories */}
      <div className="reportSection">
        <h3>Top categorie</h3>
        <div className="topCatsList">
          {topCats.map((c) => (
            <div key={c.id} className="topCatRow">
              <div className="topCatInfo">
                <span style={{ background: c.color }} className="catDot" />
                <div className="catText">
                  <b>{c.name}</b>
                  <small>
                    {eur(c.spent)} · {c.diffPrev >= 0 ? '+' : '-'}{eur(Math.abs(c.diffPrev))} vs mese scorso
                  </small>
                </div>
              </div>
              <div className="topCatStats">
                <strong>{c.pct.toFixed(1)}%</strong>
              </div>
            </div>
          ))}
        </div>
      </div>
      {/* Fixed vs variable expenses */}
      <div className="reportSection">
        <h3>Fisse vs variabili</h3>
        <p>Fisse: {eur(fixedTotal)} · Variabili: {eur(variableTotal)}</p>
        <p>{`Il ${Math.round(fixedPct)}% delle tue uscite è composto da spese fisse.`}</p>
      </div>
      {/* Daily averages and forecast */}
      <div className="reportSection">
        <h3>Previsione fine mese</h3>
        <p>Spesa attuale: {eur(stats.spent)}</p>
        <p>Media giornaliera: {eur(avgSpent)}</p>
        <p>Previsione spesa totale: {eur(predSpend)}</p>
        <p>Saldo previsto: {eur(predNetBalance)}</p>
      </div>
      {/* Daily budget calculation */}
      <div className="reportSection">
        <h3>Quanto puoi spendere al giorno</h3>
        {stats.remaining >= 0 ? (
          <p>
            Ti restano {eur(stats.remaining)}. Puoi spendere circa {eur(dailyBudget)} al giorno fino a fine mese.
          </p>
        ) : (
          <p>Sei oltre budget di {eur(Math.abs(stats.remaining))}. Dovresti ridurre le spese nei prossimi giorni.</p>
        )}
      </div>
      {/* Income vs expenses */}
      <div className="reportSection">
        <h3>Confronto entrate/uscite</h3>
        {stats.income > 0 ? (
          <p>
            Entrate: {eur(stats.income)} · Uscite: {eur(stats.spent)} · Hai speso il {Math.round(ratio)}% delle
            entrate.
          </p>
        ) : (
          <p>Non hai ancora registrato entrate questo mese.</p>
        )}
      </div>
      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="reportSection">
          <h3>Alert categorie fuori controllo</h3>
          <ul className="alertsList">
            {alerts.map((msg, idx) => (
              <li key={idx} className="insight">
                {msg}
              </li>
            ))}
          </ul>
        </div>
      )}
      {/* Suggestions */}
      {suggestions.length > 0 && (
        <div className="reportSection">
          <h3>Suggerimenti</h3>
          <ul className="suggestionsList">
            {suggestions.map((msg, idx) => (
              <li key={idx} className="insight">
                {msg}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
function Backup({lastB,dirty,makeBackup,restoreBackup,data,setData}){const file=useRef();return <section className="panel"><h2>Backup & sicurezza</h2><div className="backupBox"><p><b>Ultimo backup:</b> {lastB?new Date(lastB).toLocaleString('it-IT'):'mai'}</p><p><b>Modifiche non salvate in backup:</b> {dirty}</p><button className="primary" onClick={makeBackup}><Download size={16}/>Esporta backup completo</button><button onClick={()=>file.current.click()}><RotateCcw size={16}/>Ripristina backup</button><input hidden type="file" accept=".json" ref={file} onChange={e=>restoreBackup(e.target.files[0])}/></div><PinSettings data={data} setData={setData}/></section>}
function PinSettings({data,setData}){const [pin,setPin]=useState('');return <div className="backupBox"><h3>PIN locale</h3><p>Protegge l’apertura su questo dispositivo. Non è sincronizzato.</p><input placeholder="Nuovo PIN" type="password" inputMode="numeric" value={pin} onChange={e=>setPin(e.target.value)}/><button onClick={()=>{setData(d=>({...d,settings:{...d.settings,pin}}));alert(pin?'PIN impostato':'PIN rimosso')}}>{pin?'Imposta PIN':'Rimuovi PIN'}</button></div>}
function Reminder({makeBackup,close}){return <div className="modal"><div className="sheet"><h2>Backup consigliato</h2><p>Non fai un backup da 7 giorni. Vuoi salvare ora su iCloud Drive?</p><button className="primary" onClick={makeBackup}>Salva backup</button><button onClick={close}>Più tardi</button></div></div>}

/*
 * CsvImportModal component provides an interactive interface for importing CSV files.
 * It allows the user to map CSV columns to fields, preview rows, detect duplicates,
 * infer categories using rules when not provided, save/load mappings, and
 * confirm or cancel the import. Duplicates can be optionally imported.
 */
function CsvImportModal({file,cats,data,setData,setImporter}) {
  const [rows,setRows] = useState([]);
  const [header,setHeader] = useState([]);
  const [mapping,setMapping] = useState({date:-1,description:-1,category:-1,type:-1,amount:-1,notes:-1});
  const [previewRows,setPreviewRows] = useState([]);
  const [importDuplicates,setImportDuplicates] = useState(false);
  const [mappingName,setMappingName] = useState('');
  // Parse the CSV file on mount and guess initial mapping
  useEffect(() => {
    (async () => {
      const text = await file.text();
      const raw = parseCsv(text);
      if(!raw || raw.length < 1) {
        setRows([]);
        setHeader([]);
        return;
      }
      const hdr = raw[0];
      setHeader(hdr);
      setRows(raw.slice(1));
      // Guess mapping by matching normalized header names against typical labels
      const hdrNorm = hdr.map(h => norm(h));
      const guessField = (names) => {
        for(const n of names) {
          const idx = hdrNorm.indexOf(norm(n));
          if(idx >= 0) return idx;
        }
        return -1;
      };
      const m = {
        date: guessField(['data','date','operation date','transaction date']),
        description: guessField(['descrizione','description','merchant','causale','nome']),
        amount: guessField(['importo','amount','valore','spesa']),
        category: guessField(['categoria','category']),
        type: guessField(['tipo','type']),
        notes: guessField(['note','notes'])
      };
      setMapping(m);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file]);
  // Recompute preview rows whenever the CSV rows or mapping change
  useEffect(() => {
    if(!rows.length) {
      setPreviewRows([]);
      return;
    }
    const existing = new Set(data.transactions.map(t => `${t.date}|${norm(t.description)}|${t.amount}|${t.type}`));
    const out = [];
    rows.forEach((r,i) => {
      // Extract fields based on mapping or defaults
      let date = '', description = '', amount = 0, typ = 'expense', catName = '', notes = '';
      if(mapping.date >= 0) {
        date = normDate(r[mapping.date]);
      } else {
        date = today();
      }
      if(mapping.description >= 0) {
        description = r[mapping.description] || 'Import CSV';
      } else {
        description = 'Import CSV';
      }
      if(mapping.amount >= 0) {
        amount = parseEuro(r[mapping.amount]);
      } else {
        amount = 0;
      }
      if(mapping.type >= 0) {
        const rawType = norm(r[mapping.type] || '');
        typ = (rawType.includes('entr') || rawType === 'income' || rawType.includes('accredit')) ? 'income' : 'expense';
      } else {
        // Determine type from amount sign; negative indicates expense
        typ = amount < 0 ? 'expense' : 'income';
      }
      const absAmount = Math.abs(amount);
      if(mapping.category >= 0 && r[mapping.category]) {
        catName = r[mapping.category];
      } else {
        // Guess category only for expenses
        if(typ === 'expense') catName = guessCategoryName(description);
        else catName = 'Accrediti / Entrata';
      }
      if(mapping.notes >= 0) {
        notes = r[mapping.notes];
      }
      const key = `${date}|${norm(description)}|${absAmount}|${typ}`;
      const duplicate = existing.has(key);
      const status = duplicate ? 'duplicate' : 'ok';
      out.push({index: i, date, description, amount: absAmount, type: typ, categoryName: catName, notes, status});
    });
    setPreviewRows(out);
  }, [rows, mapping, data.transactions]);
  const handleMappingChange = (field, idx) => {
    setMapping(m => ({...m, [field]: Number(idx)}));
  };
  const handleSaveMapping = () => {
    const name = mappingName.trim();
    if(!name) {
      alert('Inserisci un nome per il mapping');
      return;
    }
    setData(d => {
      const newMappings = {...d.mappings, [name]: mapping};
      return {...d, mappings: newMappings, settings: {...d.settings, dirtyCount: (d.settings?.dirtyCount || 0) + 1}};
    });
    setMappingName('');
    alert('Mapping salvato');
  };
  const handleLoadMapping = (name) => {
    if(!name) return;
    const mapObj = data.mappings?.[name];
    if(mapObj) setMapping(mapObj);
  };
  const handleConfirm = () => {
    if(!previewRows.length) {
      alert('Nessuna riga da importare');
      return;
    }
    const batchId = uid();
    setData(d => {
      const categories = [...d.categories];
      const transactions = [...d.transactions];
      let importedCount = 0;
      previewRows.forEach(row => {
        if(row.status === 'duplicate' && !importDuplicates) return;
        let categoryId = 'income';
        if(row.type === 'expense') {
          let cat = categories.find(c => norm(c.name) === norm(row.categoryName));
          if(!cat) {
            cat = {id: uid(), name: row.categoryName || 'Varie / Altro', budget: 0, type: 'expense', kind: 'variable', color: COLORS[categories.length % COLORS.length]};
            categories.push(cat);
          }
          categoryId = cat.id;
        }
        transactions.push({id: uid(), date: row.date, description: row.description, categoryId, type: row.type, amount: row.amount, notes: row.notes || '', importBatchId: batchId, importedAt: new Date().toISOString(), importSource: file.name});
        importedCount++;
      });
      const newMappings = {...d.mappings};
      const saveName = mappingName.trim();
      if(saveName) newMappings[saveName] = mapping;
      return {...d, categories, transactions, mappings: newMappings, lastImportBatchId: batchId, settings: {...d.settings, dirtyCount: (d.settings?.dirtyCount || 0) + importedCount}};
    });
    alert('Importazione completata');
    setImporter(null);
  };
  return (
    <div className="modal">
      <div className="sheet large">
        <button className="x" onClick={() => setImporter(null)}><X/></button>
        <h2>Importa CSV</h2>
        <p>{rows.length} righe totali. {previewRows.filter(r => r.status === 'duplicate').length} possibili duplicati.</p>
        {header.length > 0 && (
          <div className="mapping">
            <h3>Associa colonne</h3>
            {['date','description','amount','category','type','notes'].map(field => (
              <div key={field} className="mapRow">
                <label>{field === 'date' ? 'Data' : field === 'description' ? 'Descrizione' : field === 'amount' ? 'Importo' : field === 'category' ? 'Categoria' : field === 'type' ? 'Tipo' : 'Note'}</label>
                <select value={mapping[field]} onChange={e => handleMappingChange(field, e.target.value)}>
                  <option value={-1}>Ignora</option>
                  {header.map((h, idx) => <option key={idx} value={idx}>{h}</option>)}
                </select>
              </div>
            ))}
          </div>
        )}
        {data.mappings && Object.keys(data.mappings).length > 0 && (
          <div className="mappingSelect">
            <label>Mapping salvati</label>
            <select onChange={e => handleLoadMapping(e.target.value)} defaultValue="">
              <option value="">-- Seleziona --</option>
              {Object.keys(data.mappings).map(name => <option key={name} value={name}>{name}</option>)}
            </select>
          </div>
        )}
        <div className="saveMapping">
          <input placeholder="Nome mapping (opzionale)" value={mappingName} onChange={e => setMappingName(e.target.value)} />
          <button type="button" onClick={handleSaveMapping}>Salva mapping</button>
        </div>
        <div className="dupToggle">
          <label><input type="checkbox" checked={importDuplicates} onChange={e => setImportDuplicates(e.target.checked)} /> Importa anche i duplicati</label>
        </div>
        <div className="previewRows">
          <h3>Anteprima</h3>
          {previewRows.slice(0,20).map(row => (
            <div key={row.index} className={`previewRow ${row.status}`}>
              <span>{row.date}</span>
              <b>{row.description}</b>
              <span>{row.categoryName}</span>
              <strong>{row.type === 'income' ? '+' : '-'}{eur(row.amount)}</strong>
              {row.status === 'duplicate' && <em>Duplicato</em>}
            </div>
          ))}
        </div>
        <div className="importActions">
          <button className="secondary" onClick={() => setImporter(null)}>Annulla</button>
          <button className="primary" onClick={handleConfirm}>Conferma importazione</button>
        </div>
      </div>
    </div>
  );
}
function CsvPreview({preview,close,confirm}){return <div className="modal"><div className="sheet large"><button className="x" onClick={close}><X/></button><h2>Anteprima import CSV</h2><p>{preview.rows.length} righe rilevate · {preview.duplicates} possibili duplicati verranno saltati.</p><div className="preview">{preview.rows.slice(0,20).map(r=><div key={r.id}><span>{r.date}</span><b>{r.description}</b><span>{r.categoryName}</span><strong>{eur(r.amount)}</strong></div>)}</div><button className="primary" onClick={confirm}>Importa senza duplicati</button></div></div>}

// Export the main App component as the default export.
export default App;
