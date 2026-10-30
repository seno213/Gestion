// Test de l'assistant stock : /api/ask -> muse-spark-1.3
const products=[
 {n:"Riz 25 kg",s:12,c:14500,p:16500,m:4},{n:"Huile 5 L",s:3,c:5200,p:6000,m:4},
 {n:"Sucre 1 kg",s:25,c:600,p:750,m:8},{n:"Tomate concentrée",s:40,c:300,p:400,m:10},
 {n:"Savon de Marseille",s:2,c:350,p:500,m:5}];
const now=Date.now();
 const sales=[
 {n:"Riz 25 kg",q:3,p:16500,c:14500,t:now-3600e3},
 {n:"Sucre 1 kg",q:5,p:750,c:600,t:now-1800e3}];
const ask=async question=>{
 const t=Date.now();
 const r=await fetch("http://localhost:3000/api/ask",{method:"POST",
  headers:{"Content-Type":"application/json"},
  body:JSON.stringify({question,products,sales,day:new Date().toDateString()}),
  signal:AbortSignal.timeout(90000)});
 const j=await r.json();
 console.log(`\n> ${question}\n[${r.status} — ${((Date.now()-t)/1000).toFixed(1)}s]`);
 console.log(j.answer||j.error);
};
(async()=>{
 await ask("Quels articles dois-je réapprovisionner en priorité ?");
 await ask("Quelle est la valeur de mon stock de riz 25 kg ?");
})().catch(e=>{console.error("ECHEC:",e.message);process.exit(1)});
