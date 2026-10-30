// Aides partagées par les routes IA (serveur uniquement) : /api/extract et /api/transcribe.

// Repli de démo si l'API est indisponible (le prototype reste utilisable hors ligne).
export const simulate=products=>{
 const pick=[...products].sort(()=>Math.random()-0.5).slice(0,3);
 return pick.map((p,i)=>({n:p.n,q:1+Math.floor(Math.random()*3),p:p.p,conf:i===2?0.58:0.93}));
};

// Extrait le JSON des lignes de la réponse du modèle (tolère le texte autour).
export const parseLines=content=>{
 if(!content)return null;
 if(Array.isArray(content))content=content.map(c=>c?.text||"").join("");
 let s=String(content).trim().replace(/^```(?:json)?\s*/i,"").replace(/\s*```$/,"").trim();
 const a=s.indexOf("{"),b=s.lastIndexOf("}");
 if(a<0||b<a)return null;
 try{
  const o=JSON.parse(s.slice(a,b+1));
  const lines=Array.isArray(o)?o:o.lines;
  if(!Array.isArray(lines))return null;
  return lines
   .filter(l=>l&&l.n&&isFinite(+l.q))
   .map(l=>({n:String(l.n).trim(),q:Math.max(1,+l.q||1),p:Math.max(0,+l.p||0),
     conf:Math.min(1,Math.max(0,Number(l.conf)||0.5))}));
 }catch{return null}
};

// ——— Meta AI : segmentation (sam-3.1) et images produits (muse-image-1.0) ———
import {Jimp} from "jimp";

const BASE=process.env.META_BASE_URL||"https://api.meta.ai/v1";
const call=async(path,body,ms)=>{
 const r=await fetch(BASE+path,{method:"POST",
  headers:{Authorization:"Bearer "+process.env.META_API_KEY,"Content-Type":"application/json"},
  body:JSON.stringify(body),signal:AbortSignal.timeout(ms||60000)});
 if(!r.ok)throw new Error("api_"+r.status);
 return r.json()};

// sam-3.1 (via /v1/responses) : détecte le cahier dans la photo et renvoie sa
// boîte englobante {x,y,w,h} — le prompt doit être un NOM court (« cahier »),
// pas une instruction. Renvoie null si rien n'est trouvé (repli photo entière).
export const segmentNotebook=async buf=>{
 const mime=buf[0]===0xff&&buf[1]===0xd8?"image/jpeg":"image/png";
 const j=await call("/responses",{model:"sam-3.1",input:[{role:"user",content:[
  {type:"input_text",text:"cahier"},
  {type:"input_image",image_url:`data:${mime};base64,${buf.toString("base64")}`}]}]},35000);
 const text=(j.output||[]).filter(o=>o.type==="message")
  .map(o=>(o.content||[]).map(c=>c.text||"").join("")).join("");
 // Format sam-3.1 : <|box;x1=…;y1=…;x2=…;y2=…;w=…;h=…|> puis un masque compressé.
 const boxes=[...text.matchAll(/<\|box;x1=(\d+);y1=(\d+);x2=(\d+);y2=(\d+)[^|]*\|>/g)]
  .map(m=>({x:+m[1],y:+m[2],w:+m[3]-+m[1],h:+m[4]-+m[2]}))
  .filter(b=>b.w>16&&b.h>16);
 if(!boxes.length)return null;
 return boxes.sort((a,b)=>b.w*b.h-a.w*a.h)[0]}; // le plus grand objet = le cahier

// Recadre un buffer selon une boîte (avec 4 % de marge) — jimp, pur JS.
export const cropImage=async(buf,b)=>{
 const img=await Jimp.read(buf);
 const mx=Math.round(b.w*.04),my=Math.round(b.h*.04);
 const x=Math.max(0,b.x-mx),y=Math.max(0,b.y-my);
 const w=Math.min(img.width-x,b.w+mx*2),h=Math.min(img.height-y,b.h+my*2);
 if(w<32||h<32)return buf;
 img.crop({x,y,w,h});
 return await img.getBuffer("image/jpeg",{quality:82})};

// Réduction pour stockage léger (vignette produit ~20 Ko).
const shrink=async(buf,max)=>{
 const img=await Jimp.read(buf);
 if(img.width>max||img.height>max)img.resize(img.width>img.height?{w:max}:{h:max});
 return await img.getBuffer("image/jpeg",{quality:72})};

// muse-image-1.0 : photo catalogue d'un produit du magasin, réduite pour TiDB.
export const generateProductImage=async name=>{
 const j=await call("/images/generations",{model:"muse-image-1.0",
  prompt:"Photo catalogue nette : "+name+", produit posé au centre sur un fond blanc uni, éclairage doux, sans texte ni marque.",
  size:"512x512",output_format:"jpeg"},90000);
 const b64=j?.data?.[0]?.b64_json;
 if(!b64)throw new Error("pas d'image");
 return shrink(Buffer.from(b64,"base64"),320)};
