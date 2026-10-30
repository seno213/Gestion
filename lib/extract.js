// Lecture d'une photo : passe par la route /api/extract (voir app/api/extract/route.js).
// Retourne {lines, crop} — crop = le cahier a été isolé par sam-3.1 (recadrage IA).
export async function extractFromImage(file,products){
 const fd=new FormData();fd.append("photo",file);fd.append("products",JSON.stringify(products));
 const r=await fetch("/api/extract",{method:"POST",body:fd});
 if(!r.ok)throw new Error("extract");
 const j=await r.json();
 return {lines:j.lines,crop:!!j.crop};
}
// Réduit la photo côté navigateur (canvas) avant aperçu, extraction et archivage.
export function shrinkClient(file,max=1280){
 return new Promise((res,rej)=>{
  const u=URL.createObjectURL(file);
  const img=new Image();
  img.onload=()=>{
   URL.revokeObjectURL(u);
   const s=Math.min(1,max/Math.max(img.width,img.height));
   const c=document.createElement("canvas");
   c.width=Math.round(img.width*s);c.height=Math.round(img.height*s);
   c.getContext("2d").drawImage(img,0,0,c.width,c.height);
   res(c.toDataURL("image/jpeg",.78))};
  img.onerror=e=>{URL.revokeObjectURL(u);rej(e)};
  img.src=u});
}
// Lecture d'un texte du type « 2 riz 25 kg, 1 huile 5 L » (règle simple, sans IA).
export function extractFromText(t,find){
 return t.split(/,|;|\n| et /i).map(s=>s.trim()).filter(Boolean).map(s=>{
  const m=s.match(/^(\d+)\s*(?:x\s*)?(.+?)(?:\s+(?:à|a)\s+(\d[\d\s]*))?$/i);
  const q=m?+m[1]:1,name=m?m[2].trim():s,f=find(name);
  const pr=m&&m[3]?+m[3].replace(/\s/g,""):null;
  return {n:f?f.n:name,q,p:pr!=null?pr:(f?f.p:0),conf:f?0.95:0.4};
 });
}
