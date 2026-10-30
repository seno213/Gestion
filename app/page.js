"use client";
import {useEffect,useState} from "react";
import {useStore,fmt} from "@/lib/store";
import {Coin,Cart,Warn,Chat} from "@/components/icons";

const GOAL=25000; // objectif démo du jour (FCFA)

export default function Accueil(){
 const {db,notify,leave,tenant}=useStore();
 const [hi,setHi]=useState(false),[date,setDate]=useState("");
 const [q,setQ]=useState(""),[ans,setAns]=useState(""),[thinking,setThinking]=useState(false);
 const ask=async()=>{
  const t=q.trim();if(!t)return notify("Posez d’abord une question");
  setThinking(true);setAns("");
  try{
   const r=await fetch("/api/ask",{method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({question:t,products:db.products,sales:db.sales,day:new Date().toDateString()})});
   const j=await r.json();
   if(!r.ok)throw new Error(j.error);
   setAns(j.answer);
  }catch{notify("L’assistant n’a pas pu répondre. Réessayez.")}
  finally{setThinking(false)}
 };
 useEffect(()=>{try{setHi(localStorage.getItem("stockia-w")!=="1")}catch{}
  setDate(new Date().toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long"}))},[]);
 const day=new Date().toDateString(),ts=db.sales.filter(s=>new Date(s.t).toDateString()===day);
 const ca=ts.reduce((a,s)=>a+s.q*s.p,0),pf=ts.reduce((a,s)=>a+s.q*(s.p-s.c),0);
 const nT=ts.reduce((a,s)=>a+s.q,0);
 const pct=Math.min(100,Math.round(ca/GOAL*100));
 const low=db.products.filter(p=>p.s<=p.m);
 return(<>
  <h1>Aujourd’hui</h1><p className="mut">{date}</p>
  {hi&&<div className="al">Bienvenue. Photographiez votre cahier ou dictez vos ventes : l’IA les lit, vous vérifiez, le stock se met à jour.<br/>
   <button onClick={()=>{setHi(false);try{localStorage.setItem("stockia-w","1")}catch{}}}>Compris</button></div>}

  <div className="two">
   <div className="box stat"><span className="cap"><Coin/>Chiffre d’affaires</span>
    <b>{fmt(ca)}</b><span className="sub">{nT} article{nT>1?"s":""} vendu{nT>1?"s":""}</span></div>
   <div className="box stat sec"><span className="cap"><Cart/>Bénéfice</span>
    <b>{fmt(pf)}</b>
    <span className="sub">{ca?Math.round(pf/ca*100):0}% de marge</span></div>
  </div>

  <div className="box goal">
   <div className="bar"><b>Objectif du jour</b><span>{pct}%</span></div>
   <div className="gauge big"><i style={{width:pct+"%"}}/></div>
   <p className="mut">{pct>=100
    ?"Objectif atteint — beau travail !"
    :`${fmt(ca)} sur ${fmt(GOAL)} · il reste ${fmt(GOAL-ca)}`}</p>
  </div>

  <div className="box" style={{marginTop:16}}><h2><Chat/> Assistant stock</h2>
   <label htmlFor="qia">Posez votre question en français</label>
   <input id="qia" value={q} onChange={e=>setQ(e.target.value)}
    onKeyDown={e=>e.key==="Enter"&&ask()}
    placeholder="Ex. : Quels articles vont bientôt manquer ?"/>
   <div className="acts"><button disabled={thinking} onClick={ask}>
    {thinking?"Réflexion en cours…":"Demander"}</button></div>
   {thinking&&<div className="sk" style={{margin:"12px 0 0"}}/>}
   {ans&&<div className="al" style={{marginTop:12}}>{ans}</div>}
  </div>

  <div className="box" style={{marginTop:16}}><h2><Warn/> À réapprovisionner</h2>
   <ul className="list">
    {low.length?low.map(p=>{
      const out=p.s===0,pctL=Math.min(100,Math.round(p.s/Math.max(1,p.m*3)*100));
      return <li key={p.n}><div className="row-main">
        <div className="bar"><b>{p.n}</b><span>{out?"0":p.s} / {p.m}</span></div>
        <div className={"gauge"+(out?" out":p.s<=p.m?" low":"")}><i style={{width:(out?100:pctL)+"%"}}/></div>
       </div><span className={"tag"+(out?"":" w")}>{out?"En rupture":"À acheter"}</span></li>;
    }):<li className="mut">Rien à réapprovisionner pour le moment.</li>}
   </ul></div>

  {db.photos?.length>0&&<div className="box" style={{marginTop:16}}><h2>Photos des cahiers</h2>
   <div className="shots">{db.photos.slice(0,6).map(ph=>
     <a key={ph.id} href={"/api/photo?id="+ph.id} target="_blank" rel="noreferrer"
        title={"Saisie du "+new Date(ph.t).toLocaleString("fr-FR")}>
      <img className="th" src={"/api/photo?id="+ph.id} alt="" loading="lazy"/></a>)}</div>
   <p className="mut" style={{margin:"8px 0 0"}}>Chaque saisie garde la photo du cahier d’origine — cliquez pour l’agrandir.</p></div>}

  <div className="box"><h2>Dernières ventes</h2><ul className="list">
   {db.sales.length?db.sales.slice(-5).reverse().map((s,i)=><li key={i}>
     <span><b style={{fontWeight:500}}>{s.q} × {s.n}</b><br/><span className="mut">à {fmt(s.p)} / unité</span></span>
     <b>{fmt(s.q*s.p)}</b></li>)
    :<li className="empty"><Cart/><b>Aucune vente pour l’instant</b>Votre première vente apparaîtra ici.</li>}
   </ul></div>

  {tenant&&<p className="mut">Boutique {tenant.name}</p>}
  <div className="acts">
   <button className="g" onClick={leave}>Changer de boutique</button>
  </div>
 </>);
}
