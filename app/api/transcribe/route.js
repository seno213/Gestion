// Route serveur de dictée — appel réel à la Meta Model API :
// 1) muse-voice-transcribe-1.0 (POST /asr/transcribe) transcrit la dictée en français,
// 2) muse-spark-1.3 transforme le texte en lignes de vente (même schéma que la photo).
// Sécurité : la clé (META_API_KEY) ne quitte jamais le serveur.
import {parseLines,simulate} from "@/lib/server-ai";

// Vercel serverless : transcription + extraction par l'IA peuvent dépasser 10 s.
export const maxDuration=60;

const BASE=process.env.META_BASE_URL||"https://api.meta.ai/v1";
const MODEL=process.env.META_MODEL||"muse-spark-1.3";
const ASR="muse-voice-transcribe-1.0";

export async function POST(req){
 const fd=await req.formData();
 const audio=fd.get("audio");
 const products=JSON.parse(fd.get("products")||"[]");
 if(!audio||typeof audio.arrayBuffer!=="function")
  return Response.json({error:"Aucun enregistrement reçu."},{status:400});

 const key=process.env.META_API_KEY;
 if(!key)return Response.json({lines:simulate(products),transcript:"",simulated:true});

 try{
  // 1. Transcription : WAV mono PCM 16 bits à 16 kHz (converti côté client).
  const buf=Buffer.from(await audio.arrayBuffer());
  const asr={model:ASR,audioEncoding:"WAV",mode:"PUSH_TO_TALK",languageBias:["French"]};
  const kw=products.map(p=>p.n).slice(0,30);
  if(kw.length)asr.keywords=kw; // biais lexical : noms des produits déjà au stock
  const form=new FormData();
  form.append("request",new Blob([JSON.stringify(asr)],{type:"application/json"}),"request.json");
  form.append("audio",new Blob([buf],{type:"audio/wav"}),"ventes.wav");
  const r=await fetch(BASE+"/asr/transcribe",{
   method:"POST",
   headers:{Authorization:"Bearer "+key,Accept:"application/json"},
   body:form,
   signal:AbortSignal.timeout(90000)});
  if(!r.ok)throw new Error("asr_"+r.status);
  const transcript=String((await r.json())?.transcript||"").trim();
  if(!transcript)throw new Error("dictée_vide");

  // 2. Extraction des lignes par le modèle de raisonnement.
  const catalog=products.length
   ?products.map(p=>`${p.n} (vente ${p.p} FCFA)`).join(" · ")
   :"(magasin nouveau : aucun produit connu — fie-toi à la dictée)";
  const system=
   "Tu extrais des ventes de petits commerçants (Afrique de l'Ouest, francs CFA) à partir de dictées vocales en français. "+
   "Tu es rigoureux : tu ne devines jamais une quantité ou un prix absent de la dictée, tu baisses plutôt la confiance. "+
   "Réponds UNIQUEMENT par du JSON valide, sans balises markdown et sans commentaire.";
  const user=[
   "Catalogue du magasin : "+catalog,
   "Dictée du commerçant : « "+transcript+" »",
   'Réponds avec ce JSON exact : {"lines":[{"n":"nom exact du produit","q":2,"p":16500,"conf":0.9}]}',
   "conf est ton taux de confiance entre 0 et 1 (0.95 = dictée claire et complète, plus bas si la phrase est ambiguë, coupée ou incomplète).",
   "Si la dictée ne contient aucune vente, réponds {\"lines\":[]}."
  ].join("\n");
  const r2=await fetch(BASE+"/chat/completions",{
   method:"POST",
   headers:{"Authorization":"Bearer "+key,"Content-Type":"application/json"},
   body:JSON.stringify({model:MODEL,max_tokens:4000,messages:[
    {role:"system",content:system},
    {role:"user",content:user}
   ]}),
   signal:AbortSignal.timeout(60000)});
  if(!r2.ok)throw new Error("spark_"+r2.status);
  const j=await r2.json();
  const lines=parseLines(j?.choices?.[0]?.message?.content);
  if(!lines)throw new Error("json_invalide");
  return Response.json({lines,transcript});
 }catch(e){
  // Repli simulation pour ne pas casser la démonstration.
  return Response.json({lines:simulate(products),transcript:"",simulated:true});
 }
}
