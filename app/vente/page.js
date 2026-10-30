"use client";
import {useEffect,useRef,useState} from "react";
import {useRouter} from "next/navigation";
import {useStore} from "@/lib/store";
import {extractFromImage,extractFromText,shrinkClient} from "@/lib/extract";
import {toWav,transcribeAudio} from "@/lib/voice";
import {Cam,Mic,Check,Warn} from "@/components/icons";

const Line=({l,i,edit,del})=>(
 <div className={"line"+(l.conf<0.75?" check":"")}>
  <input list="pl" value={l.n} onChange={e=>edit(i,"n",e.target.value)} aria-label="Produit"/>
  <input className="q" type="number" inputMode="numeric" min="1" value={l.q} onChange={e=>edit(i,"q",e.target.value)} aria-label="Quantité"/>
  <input className="p" type="number" inputMode="numeric" min="0" value={l.p} onChange={e=>edit(i,"p",e.target.value)} aria-label="Prix unitaire"/>
  <button onClick={()=>del(i)} aria-label="Supprimer la ligne">✕</button>
 </div>);

export default function Vente(){
 const {db,find,recordSales,notify}=useStore(),router=useRouter();
 const [file,setFile]=useState(null),[shot,setShot]=useState(""),[txt,setTxt]=useState("");
 const [draft,setDraft]=useState(null),[crop,setCrop]=useState(false);
 const [busy,setBusy]=useState(false),[ferr,setFerr]=useState(false),[terr,setTerr]=useState(false);
 const [rec,setRec]=useState(false);
 const recRef=useRef(null),streamRef=useRef(null),chunks=useRef([]),timer=useRef(null);
 useEffect(()=>()=>{try{if(recRef.current?.state==="recording")recRef.current.stop()}catch{}clearTimeout(timer.current);streamRef.current?.getTracks().forEach(t=>t.stop())},[]);
 const pick=async e=>{
  const f=e.target.files[0];setFerr(false);setFile(f||null);setCrop(false);
  // Photo réduite côté navigateur : aperçu, extraction et archivage partagent la même version.
  setShot(f?await shrinkClient(f).catch(()=>""):"")};
 const read=async()=>{
  if(!file){setFerr(true);return}
  setBusy("photo");setDraft([]);
  try{const r=await extractFromImage(file,db.products);setDraft(r.lines);setCrop(!!r.crop)}
  catch{setDraft(null);notify("La lecture a échoué. Réessayez.")}
  finally{setBusy(false)}};
 const parse=()=>{const t=txt.trim();setTerr(!t);if(t)setDraft(extractFromText(t,find))};
 // Dictée : micro → WAV 16 kHz → /api/transcribe (ASR Meta + extraction par Spark).
 const dictate=async()=>{
  if(rec){try{recRef.current?.stop()}catch{}return}
  if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder){
   notify("Ce navigateur ne permet pas la dictée. Écrivez vos ventes à la place.");return}
  try{
   const stream=await navigator.mediaDevices.getUserMedia({audio:true});
   streamRef.current=stream;
   const mr=new MediaRecorder(stream);
   chunks.current=[];
   mr.ondataavailable=e=>{if(e.data.size)chunks.current.push(e.data)};
   mr.onstop=async()=>{
    stream.getTracks().forEach(t=>t.stop());
    clearTimeout(timer.current);
    const raw=new Blob(chunks.current,{type:mr.mimeType||"audio/webm"});
    setRec(false);setBusy("dict");setDraft([]);
    try{
     const wav=await toWav(raw);
     const {lines,transcript}=await transcribeAudio(wav,db.products);
     if(transcript)setTxt(transcript);
     setDraft(lines);
    }catch{setDraft(null);notify("La dictée a échoué. Réessayez ou écrivez vos ventes.")}
    finally{setBusy(false)}};
   mr.start();recRef.current=mr;setRec(true);
   timer.current=setTimeout(()=>{if(mr.state==="recording")mr.stop()},60000);
  }catch{notify("Micro refusé. Autorisez le micro dans le navigateur, ou écrivez vos ventes.")}};
 const edit=(i,k,v)=>setDraft(d=>d.map((l,j)=>{if(j!==i)return l;const n={...l,conf:1};
  if(k==="n"){n.n=v;const f=find(v);if(f)n.p=f.p}else n[k]=Math.max(0,+v||0);return n}));
 const del=i=>setDraft(d=>d.filter((_,j)=>j!==i));
 const ok=async()=>{const L=draft.filter(l=>l.n.trim()&&l.q>0);
  if(!L.length){notify("Aucune ligne à enregistrer");return}
  try{await recordSales(L,shot||null)}
  catch(e){notify(e.message||"Enregistrement impossible. Réessayez.");return}
  setDraft(null);setTxt("");notify("Ventes enregistrées");router.push("/")};
 const nb=draft?draft.filter(l=>l.conf<0.75).length:0,total=draft?draft.reduce((a,l)=>a+l.q*l.p,0):0;

 return(<>
  <h1>Nouvelle vente</h1>
  <p className="mut">Photographiez le cahier ou dictez vos ventes. L’IA lit, vous vérifiez.</p>

  <div className="box"><h2><Cam/> Photographier le cahier</h2>
   <input id="photo" type="file" accept="image/*" capture="environment" aria-label="Photo du cahier" onChange={pick}/>
   <label className="shot" htmlFor="photo">
    {shot?<img id="prev" src={shot} alt="Aperçu de la photo du cahier" style={{display:"block"}}/>
     :<><svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 8.5h3.5L8 6h8l1.5 2.5H21v11H3z"/><circle cx="12" cy="13.5" r="3.5"/></svg>
       <b>Prendre une photo</b><span>Cadrez le cahier à plat, près d’une fenêtre</span></>}
   </label>
   {ferr&&<div className="al e">Aucune photo choisie. Prenez le cahier en photo près d’une fenêtre, bien à plat.</div>}
   <div className="acts"><button disabled={busy} onClick={read}>{busy==="photo"?"Lecture en cours…":"Lire le cahier"}</button></div>
  </div>

  <div className="box"><h2><Mic/> Dicter ou écrire</h2>
   <div className="acts" style={{marginTop:0}}>
    <button className={rec&&!draft?"p":""} disabled={busy} onClick={dictate}>
     {busy==="dict"?"Transcription en cours…":rec?"Arrêter la dictée":"Dicter mes ventes"}
    </button>
   </div>
   {rec&&<div className="al w" style={{margin:"10px 0 0"}}>Enregistrement en cours — dictez vos ventes en français (« 2 riz, 1 huile… »), puis appuyez sur « Arrêter la dictée ». 60 s maximum.</div>}
   <label htmlFor="txt" style={{marginTop:12}}>ou écrivez vos ventes</label>
   <input id="txt" className={terr?"bad":""} value={txt} onChange={e=>setTxt(e.target.value)} placeholder="Exemple : 2 riz 25 kg, 1 huile 5 L"/>
   {terr&&<div className="hint">Écrivez au moins une vente, par exemple « 2 riz 25 kg ».</div>}
   <div className="acts"><button disabled={busy} onClick={parse}>Analyser</button></div>
  </div>

  {draft&&<div>
   <div className="two" style={{marginBottom:8}}>
    <div className="box stat"><span className="cap">Lignes lues</span><b>{draft.filter(l=>l.n.trim()&&l.q>0).length}</b></div>
    <div className="box stat sec"><span className="cap">Total</span><b>{total.toLocaleString("fr-FR")} F</b></div>
   </div>

   <div className="box">
    <h2 style={{marginBottom:2}}>Vérifier avant d’enregistrer</h2>
    {shot&&<div className="shotrow">
     <img className="mini" src={shot} alt="Photo du cahier saisie"/>
     <span className="mut">{crop
      ?"📐 Carnet isolé dans la photo par sam-3.1, puis lu par l’IA. La photo reste jointe à cette vente."
      :"Photo lue par l’IA — elle reste jointe à cette vente."}</span></div>}
    {nb>0
     ? <div className="chk"><Warn/> {nb} ligne{nb>1?"s":""} à vérifier : l’IA n’est pas sûre de sa lecture.</div>
     : draft.length? <div className="ok-mark"><Check/> Tout semble correct. Vérifiez puis enregistrez.</div>:null}
    <div className="hd"><span>Produit</span><span>Qté</span><span>Prix</span><span></span></div>
    <div className="sale">
     {busy?[0,1,2].map(i=><div key={i} className="sk"/>)
      :draft.length?draft.map((l,i)=><Line key={i} l={l} i={i} edit={edit} del={del}/>)
      :<p className="mut" style={{padding:12}}>Plus aucune ligne. Annulez ou relancez une lecture.</p>}
    </div>
   </div>
   <datalist id="pl">{db.products.map(p=><option key={p.n} value={p.n}/>)}</datalist>
   <div className="acts"><button className="p" disabled={busy} onClick={ok}>Enregistrer les ventes</button><button onClick={()=>{setDraft(null);setCrop(false)}}>Annuler</button></div>
  </div>}
 </>);
}
