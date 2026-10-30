// Assistant stock — questions en langage naturel via muse-spark-1.3.
// Le navigateur envoie un instantané des données ; la clé reste côté serveur.

// Vercel serverless : réponse du modèle pouvant dépasser 10 s.
export const maxDuration=60;

const BASE=process.env.META_BASE_URL||"https://api.meta.ai/v1";
const MODEL=process.env.META_MODEL||"muse-spark-1.3";

export async function POST(req){
 const key=process.env.META_API_KEY;
 if(!key)return Response.json({error:"Clé API manquante."},{status:500});

 let q="",products=[],sales=[],day="";
 try{
  const b=await req.json();
  q=b.question;products=b.products||[];sales=b.sales||[];day=b.day||"";
 }catch{}
 q=String(q||"").trim();
 if(!q)return Response.json({error:"Question vide."},{status:400});

 // — Instantané pré-calculé (fiabilité maximale : le modèle n'a rien à additionner) —
 const jour=day||new Date().toDateString();
 const jourFr=new Date().toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long"});
 const ts=sales.filter(s=>new Date(s.t).toDateString()===jour);
 const ca=ts.reduce((a,s)=>a+s.q*s.p,0),pf=ts.reduce((a,s)=>a+s.q*(s.p-s.c),0);
 const stock=(products||[]).map(p=>{
  const st=p.s===0?"RUPTURE":p.s<=p.m?"ALERTE sous le seuil":"ok";
  return `- ${p.n} : stock ${p.s} (seuil ${p.m}) — ${st} — achat ${p.c} FCFA, vente ${p.p} FCFA`;
 }).join("\n");
 const dernieres=(sales||[]).slice(-30).map(s=>{
  const d=new Date(s.t);
  return `- ${d.toLocaleDateString("fr-FR")} : ${s.q} x ${s.n} à ${s.p} FCFA (marge ${s.p-s.c} FCFA/l)`;
 }).join("\n");

 const system=
  "Tu es l'assistant IA d'un petit commerçant en Afrique de l'Ouest (FCFA). "+
  "Tu réponds en français, en 3 phrases maximum, chaleureux et direct. "+
  "Tu utilises UNIQUEMENT les données fournies — jamais inventé de chiffres. "+
  "Pour les stocks, propose concrètement quoi racheter et dans quel ordre de priorité.";

 const user=[
  `Date du jour : ${jourFr}.`,
  `CHIFFRES DU JOUR : chiffre d'affaires ${ca} FCFA, bénéfice ${pf} FCFA, ${ts.length} lignes de vente.`,
  "ÉTAT DU STOCK :\n"+(stock||"(aucun produit)"),
  "VENTES RÉCENTES :\n"+(dernieres||"(aucune vente)"),
  "QUESTION DU COMMERÇANT : "+q
 ].join("\n\n");

 try{
  const r=await fetch(BASE+"/chat/completions",{
   method:"POST",
   headers:{"Authorization":"Bearer "+key,"Content-Type":"application/json"},
   body:JSON.stringify({model:MODEL,max_tokens:2000,messages:[
    {role:"system",content:system},{role:"user",content:user}
   ]}),
   signal:AbortSignal.timeout(60000)});
  if(!r.ok)throw new Error("api_"+r.status);
  const j=await r.json();
  const answer=(j?.choices?.[0]?.message?.content||"").trim();
  if(!answer)throw new Error("vide");
  return Response.json({answer});
 }catch{
  return Response.json({error:"L'assistant est momentanément indisponible."},{status:502});
 }
}
