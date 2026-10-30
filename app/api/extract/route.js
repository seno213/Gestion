// Route serveur de lecture des cahiers — appel réel à la Meta Model API.
// Sécurité : la clé (META_API_KEY) ne quitte jamais le serveur.
import {parseLines,simulate,segmentNotebook,cropImage} from "@/lib/server-ai";

// Vercel serverless : sam-3.1 + lecture par l'IA peuvent dépasser 10 s.
export const maxDuration=60;

const BASE=process.env.META_BASE_URL||"https://api.meta.ai/v1";
const MODEL=process.env.META_MODEL||"muse-spark-1.3";

export async function POST(req){
 // Corps non-FormData ou illisible → 400 propre (jamais de 500 ni de pile d'appels).
 let fd;
 try{fd=await req.formData()}
 catch{return Response.json({error:"Requête invalide."},{status:400})}
 const photo=fd.get("photo");
 let products=[];
 try{products=JSON.parse(fd.get("products")||"[]")}catch{products=[]}
 if(!photo||typeof photo.arrayBuffer!=="function")
  return Response.json({error:"Aucune photo reçue."},{status:400});

 const key=process.env.META_API_KEY;
 if(!key)return Response.json({lines:simulate(products),simulated:true});

 const buf=Buffer.from(await photo.arrayBuffer());
 // sam-3.1 : isole le cahier dans la photo (boîte → recadrage) avant la lecture.
 // Repli silencieux sur la photo entière si la segmentation échoue ou trouve rien.
 let used=buf,crop=false;
 try{
  const box=await segmentNotebook(buf);
  if(box){const c=await cropImage(buf,box);if(c!==buf){used=c;crop=true}}
 }catch(e){console.error("sam:",e?.message)}
 const url=`data:${crop?"image/jpeg":photo.type||"image/jpeg"};base64,${used.toString("base64")}`;
 const catalog=products.length
  ?products.map(p=>`${p.n} (vente ${p.p} FCFA)`).join(" · ")
  :"(magasin nouveau : aucun produit connu — lis la photo telle quelle)";

 const system=
  "Tu lis des cahiers de ventes de petits commerçants (Afrique de l'Ouest, francs CFA). "+
  "Tu es rigoureux : tu ne devines jamais une quantité ou un prix illisible, tu baisses plutôt la confiance. "+
  "Réponds UNIQUEMENT par du JSON valide, sans balises markdown et sans commentaire.";

 const user=[
  "Catalogue du magasin : "+catalog,
  "Photo du cahier de ventes ci-jointe. Extrais chaque ligne de vente : le produit, la quantité vendue et le prix unitaire en FCFA.",
  'Réponds avec ce JSON exact : {"lines":[{"n":"nom exact du produit","q":2,"p":16500,"conf":0.9}]}',
  "conf est ton taux de confiance de lecture entre 0 et 1 (0.95 = écriture nette, 0.5 = difficile, bas si illisible).",
  'Si la photo ne contient aucune vente lisible, réponds {"lines":[]}.'
 ].join("\n");

 try{
  const r=await fetch(BASE+"/chat/completions",{
   method:"POST",
   headers:{"Authorization":"Bearer "+key,"Content-Type":"application/json"},
   body:JSON.stringify({model:MODEL,max_tokens:4000,messages:[
    {role:"system",content:system},
    {role:"user",content:[
     {type:"text",text:user},
     {type:"image_url",image_url:{url}}
    ]}
   ]}),
   signal:AbortSignal.timeout(60000)});
  if(!r.ok)throw new Error("api_"+r.status);
  const j=await r.json();
  const text=j?.choices?.[0]?.message?.content;
  const lines=parseLines(text);
  if(!lines)throw new Error("json_invalide");
  return Response.json({lines,crop});
 }catch(e){
  // Repli simulation pour ne pas casser la démonstration.
  return Response.json({lines:simulate(products),simulated:true});
 }
}
