// Photo du cahier conservée lors d'une saisie de vente — isolée par tenant.
import {NextResponse} from "next/server";
import {getTenant,getPhoto} from "@/lib/db";

export async function GET(req){
 try{
  const tid=req.cookies.get("tid")?.value;
  const t=tid&&await getTenant(tid);
  if(!t)return new Response(null,{status:401});
  const id=+new URL(req.url).searchParams.get("id");
  const img=id&&await getPhoto(t.id,id);
  if(!img)return new Response(null,{status:404});
  return new Response(new Uint8Array(img),{headers:{
   "Content-Type":"image/jpeg","Cache-Control":"private, max-age=86400"}});
 }catch(e){console.error("PHOTO:",e);return new Response(null,{status:503})}
}
