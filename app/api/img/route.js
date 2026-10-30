// Vignette d'un produit générée par l'IA (muse-image-1.0) — isolée par tenant.
import {NextResponse} from "next/server";
import {getTenant,getImage} from "@/lib/db";

export async function GET(req){
 try{
  const tid=req.cookies.get("tid")?.value;
  const t=tid&&await getTenant(tid);
  if(!t)return new Response(null,{status:401});
  const pid=+new URL(req.url).searchParams.get("pid");
  const img=pid&&await getImage(t.id,pid);
  if(!img)return new Response(null,{status:404});
  return new Response(new Uint8Array(img),{headers:{
   "Content-Type":"image/jpeg","Cache-Control":"private, max-age=86400"}});
 }catch(e){console.error("IMG:",e);return new Response(null,{status:503})}
}
