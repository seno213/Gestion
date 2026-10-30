// Boutiques (tenants) : création, accès par code, session par cookie httpOnly.
// Le code d'accès de 6 caractères est la clé de partage entre appareils du commerçant.
import {NextResponse} from "next/server";
import {createTenant,joinTenant,getTenant} from "@/lib/db";

const OPT={httpOnly:true,sameSite:"lax",path:"/",maxAge:60*60*24*365};

// Anti force brute : 30 tentatives par minute et par adresse, puis 429.
// (Le code à 6 caractères sur 31 lettres ≈ 887 millions de combinaisons.)
const hits=new Map();
const allow=req=>{
 const ip=(req.headers.get("x-forwarded-for")||"local").split(",")[0].trim();
 const now=Date.now(),arr=(hits.get(ip)||[]).filter(t=>now-t<60000);
 if(hits.size>5000)hits.clear();
 if(arr.length>=30)return false;
 arr.push(now);hits.set(ip,arr);return true};

export async function GET(req){
 try{
  const tid=req.cookies.get("tid")?.value;
  const t=tid&&await getTenant(tid);
  if(!t)return NextResponse.json({error:"Aucune boutique ouverte."},{status:401});
  return NextResponse.json({tenant:t});
 }catch(e){
  console.error("DB:",e);
  return NextResponse.json({error:"Base de données indisponible. Réessayez."},{status:503});
 }
}

export async function POST(req){
 if(!allow(req))return NextResponse.json(
  {error:"Trop de tentatives. Réessayez dans une minute."},{status:429});
 const {mode,name,code}=await req.json().catch(()=>({}));
 try{
  if(mode==="create"){
   const n=String(name||"").trim().slice(0,40);
   if(n.length<2)return NextResponse.json({error:"Donnez un nom d’au moins 2 caractères."},{status:400});
   const t=await createTenant(n);
   const res=NextResponse.json({tenant:t});
   res.cookies.set("tid",t.id,OPT);
   return res;
  }
  if(mode==="join"){
   const t=await joinTenant(code);
   if(!t)return NextResponse.json({error:"Code inconnu. Vérifiez les 6 caractères."},{status:404});
   const res=NextResponse.json({tenant:t});
   res.cookies.set("tid",t.id,OPT);
   return res;
  }
  return NextResponse.json({error:"Mode inconnu."},{status:400});
 }catch(e){
  console.error("DB:",e);
  return NextResponse.json({error:"Base de données indisponible. Réessayez."},{status:503});
 }
}

export async function DELETE(){
 const res=NextResponse.json({ok:true});
 res.cookies.delete({name:"tid",path:"/"});
 return res;
}
