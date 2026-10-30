// Données de la boutique ouverte (cookie tid) : lecture du snapshot et actions.
// Toutes les requêtes sont filtrées par tenant_id — aucune fuite entre boutiques.
import {NextResponse} from "next/server";
import {after} from "next/server";
import {getTenant,snapshot,recordSales,addProduct,findProduct,setImage,addPhoto} from "@/lib/db";
import {generateProductImage} from "@/lib/server-ai";

// Vercel serverless : les appels IA (génération d'image) peuvent dépasser 10 s.
export const maxDuration=60;

const tenant=async req=>{
 const tid=req.cookies.get("tid")?.value;
 return tid&&getTenant(tid)};

const fail=e=>{
 console.error("DB:",e);
 return NextResponse.json({error:"Base de données indisponible. Réessayez."},{status:503})};

export async function GET(req){
 try{
  const t=await tenant(req);
  if(!t)return NextResponse.json({error:"Aucune boutique ouverte."},{status:401});
  return NextResponse.json(await snapshot(t.id));
 }catch(e){return fail(e)}
}

export async function POST(req){
 try{
  const t=await tenant(req);
  if(!t)return NextResponse.json({error:"Aucune boutique ouverte."},{status:401});
  const {action,lines,product,photo,name}=await req.json().catch(()=>({}));

  if(action==="sale"){
   const L=(Array.isArray(lines)?lines:[])
    .filter(l=>l&&String(l.n||"").trim()&&+l.q>0)
    .map(l=>({n:String(l.n).trim(),q:+l.q,p:Math.max(0,+l.p||0)}));
   if(!L.length)return NextResponse.json({error:"Aucune ligne à enregistrer."},{status:400});
   const {snap,created}=await recordSales(t.id,L);
   // Photo du cahier jointe à la saisie (dataURL réduite côté navigateur) — preuve.
   // Awaited : la photo apparaît tout de suite dans le dashboard ; une panne ne bloque jamais la vente.
   if(typeof photo==="string"&&photo.startsWith("data:image")){
    const b64=photo.slice(photo.indexOf(",")+1);
    if(b64.length>0&&b64.length<2200000)
     try{
      const phid=await addPhoto(t.id,Buffer.from(b64,"base64"));
      if(Array.isArray(snap.photos))snap.photos.unshift({id:phid,t:Date.now()});
     }catch(e){console.error("photo de saisie:",e)}
   }
   // Image catalogue générée en arrière-plan pour chaque produit inconnu rencontré.
   // after() : sur Vercel (serverless), le travail post-réponse doit être déclaré
   // explicitement — sinon la fonction gèlerait dès l'envoi de la réponse.
   if(created.length)after(async()=>{
    for(const c of created)
     try{await setImage(t.id,c.id,await generateProductImage(c.n))}
     catch(e){console.error("image produit",c.n+":",e)}
   });
   return NextResponse.json(snap);
  }

  if(action==="genImage"){
   const nom=String(name||"").trim();
   if(!nom)return NextResponse.json({error:"Nom du produit manquant."},{status:400});
   const p=await findProduct(t.id,nom);
   if(!p)return NextResponse.json({error:"Produit introuvable."},{status:404});
   const buf=await generateProductImage(p.n); // bloquant : le bouton affiche « Génération… »
   await setImage(t.id,p.id,buf);
   return NextResponse.json(await snapshot(t.id));
  }

  if(action==="addProduct"){
   if(!product||!String(product.n||"").trim())
    return NextResponse.json({error:"Nom du produit manquant."},{status:400});
   return NextResponse.json(await addProduct(t.id,product));
  }
  return NextResponse.json({error:"Action inconnue."},{status:400});
 }catch(e){return fail(e)}
}
