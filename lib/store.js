"use client";
import {createContext,useContext,useEffect,useRef,useState} from "react";
import {fmt,norm} from "./shared";
export {fmt,norm};

// Store multi-boutique : les données vivent côté serveur (SQLite, isolées par tenant),
// identifié par le cookie httpOnly « tid ». Le code de 6 caractères ouvre la boutique
// sur d'autres appareils. Interface : db, find, addProduct, recordSales, notify, leave…
const Ctx=createContext(null);
export const useStore=()=>useContext(Ctx);

const post=async(body)=>{
 const r=await fetch("/api/tenant",{method:"POST",headers:{"Content-Type":"application/json"},
  body:JSON.stringify(body)});
 const j=await r.json().catch(()=>({}));
 if(!r.ok)throw new Error(j.error||"Le serveur n’a pas répondu. Réessayez.");
 return j};

export function StoreProvider({children}){
 const [db,setDb]=useState({products:[],sales:[],photos:[]});
 const [tenant,setTenant]=useState(undefined); // undefined = chargement · null = aucune boutique
 const [ready,setReady]=useState(false);
 const [view,setView]=useState("choice"),[created,setCreated]=useState(null);
 const [name,setName]=useState(""),[code,setCode]=useState(""),[busy,setBusy]=useState(false);
 const [nerr,setNerr]=useState(""),[cerr,setCerr]=useState("");
 const [toast,setToast]=useState("");const t=useRef();

 useEffect(()=>{let alive=true;(async()=>{
  try{
   const r=await fetch("/api/tenant");
   if(!r.ok){setTenant(null);return}
   const {tenant}=await r.json();
   const s=await fetch("/api/store");
   setTenant(tenant);
   if(s.ok)setDb(await s.json());
  }catch{setTenant(null)}
  finally{if(alive)setReady(true)}
 })();return()=>{alive=false}},[]);

 const load=async()=>{const s=await fetch("/api/store");if(s.ok)setDb(await s.json())};
 const notify=m=>{setToast(m);clearTimeout(t.current);t.current=setTimeout(()=>setToast(""),2000)};

 const create=async()=>{
  const n=name.trim();
  setCerr("");
  if(n.length<2){setNerr("Donnez un nom d’au moins 2 caractères.");return}
  setNerr("");setBusy(true);
  try{const {tenant}=await post({mode:"create",name:n});setCreated(tenant);setView("code")}
  catch(e){setNerr(e.message)}
  finally{setBusy(false)}};
 const start=async()=>{setBusy(true);setTenant(created);await load();setBusy(false)};
 const join=async()=>{
  const c=code.trim();
  setNerr("");
  if(c.length<6){setCerr("Le code comporte 6 caractères.");return}
  setCerr("");setBusy(true);
  try{const {tenant}=await post({mode:"join",code:c});setTenant(tenant);await load()}
  catch(e){setCerr(e.message)}
  finally{setBusy(false)}};
 const leave=async()=>{try{await fetch("/api/tenant",{method:"DELETE"})}catch{}
  setDb({products:[],sales:[],photos:[]});setTenant(null);setView("choice");
  setName("");setCode("");setNerr("");setCerr("")};
 // Suppression définitive (RGPD) : la boutique et toutes ses données sont effacées.
 const destroy=async()=>{
  if(!tenant)return;
  if(!window.confirm("Supprimer définitivement la boutique « "+tenant.name+
    " » et toutes ses ventes, produits et photos ?\nCette action est irréversible."))return;
  try{await fetch("/api/tenant?purge=1",{method:"DELETE"})}catch{}
  setDb({products:[],sales:[],photos:[]});setTenant(null);setView("choice");
  setName("");setCode("");setNerr("");setCerr("");
  notify("Boutique supprimée définitivement.")};

 const mutate=async(body)=>{
  const r=await fetch("/api/store",{method:"POST",headers:{"Content-Type":"application/json"},
   body:JSON.stringify(body)});
  if(r.ok){setDb(await r.json());return true}
  const j=await r.json().catch(()=>({}));
  throw new Error(j.error||"Enregistrement impossible. Réessayez.")};
 const addProduct=p=>mutate({action:"addProduct",product:p});
 const recordSales=(lines,photo)=>mutate({action:"sale",lines,photo:photo||null});
 const genImage=name=>mutate({action:"genImage",name});

 const find=name=>{const k=norm(name);if(!k)return null;
  return db.products.find(p=>norm(p.n)===k)||db.products.find(p=>norm(p.n).includes(k)||k.includes(norm(p.n)))||null};

 const toastEl=toast&&<div id="msg" role="status" style={{display:"block"}}>{toast}</div>;

 if(!ready)return <main className="auth"><div className="box"><div className="sk" style={{margin:"6px 0"}}/><div className="sk" style={{margin:"6px 0"}}/></div></main>;

 if(tenant===null)return(
  <main className="auth">
   <h1>Stock IA</h1>
   <p className="mut">Assistant IA de stock et de ventes pour les petits commerçants.
    Photo du cahier ou dictée en français : l’IA lit, vous vérifiez.</p>

   {view==="code"&&created?(
    <div className="box"><h2>Votre code d’accès</h2>
     <p className="mut">Notez ce code : il rouvre la boutique de « {created.name} » sur n’importe quel appareil.</p>
     <div className="auth-code">{created.code}</div>
     <div className="acts"><button className="p" disabled={busy} onClick={start}>Commencer</button></div>
    </div>):(<>
    <div className="box"><h2>Créer ma boutique</h2>
     <label htmlFor="tn">Nom de la boutique</label>
     <input id="tn" className={nerr?"bad":""} value={name} onChange={e=>{setName(e.target.value);setNerr("")}}
      placeholder="Ex. : Boutique Awa" onKeyDown={e=>e.key==="Enter"&&create()}/>
     <div className="acts"><button className="p" disabled={busy} onClick={create}>
      {busy?"Création…":"Créer ma boutique"}</button></div>
    </div>
    <div className="box"><h2>J’ai déjà un code</h2>
     <label htmlFor="tc">Code à 6 caractères</label>
     <input id="tc" className={"tc"+(cerr?" bad":"")} value={code} maxLength={6}
      onChange={e=>{setCode(e.target.value.toUpperCase());setCerr("")}}
      placeholder="Ex. : K7M2QD" onKeyDown={e=>e.key==="Enter"&&join()}/>
     <div className="acts"><button disabled={busy} onClick={join}>
      {busy?"Ouverture…":"Ouvrir ma boutique"}</button></div>
    </div>
   </>)}
   {(nerr||cerr)&&<div className="al e">{nerr||cerr}</div>}
   <p className="mut" style={{textAlign:"center",fontSize:12,marginTop:4}}>
    <a className="lnk" href="/cgu">Conditions d’utilisation</a></p>
   {toastEl}
  </main>);

 return <Ctx.Provider value={{db,tenant,find,addProduct,recordSales,genImage,notify,leave,destroy}}>
  {children}{toastEl}</Ctx.Provider>;
}
