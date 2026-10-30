// Test de bout en bout : image de cahier -> /api/extract -> Meta Model API
const sharp=require("sharp");
const svg=`<svg width="640" height="420" xmlns="http://www.w3.org/2000/svg">
<rect width="640" height="420" fill="#f4efe2"/>
<rect x="60" y="0" width="2" height="420" fill="#d8b4b4"/>
<text x="80" y="60" font-family="Georgia" font-style="italic" font-size="26" fill="#1b2a4a">Ventes du 27 octobre</text>
<text x="80" y="130" font-family="Georgia" font-style="italic" font-size="30" fill="#1b2a4a">3 riz 25 kg ...... 16500</text>
<text x="80" y="200" font-family="Georgia" font-style="italic" font-size="30" fill="#1b2a4a">2 huile 5 L ...... 6000</text>
<text x="80" y="270" font-family="Georgia" font-style="italic" font-size="30" fill="#1b2a4a">5 sucre 1 kg ..... 750</text>
<text x="80" y="340" font-family="Georgia" font-style="italic" font-size="30" fill="#1b2a4a">1 savon de marseille 500</text>
</svg>`;
const products=[
 {n:"Riz 25 kg",s:12,c:14500,p:16500,m:4},{n:"Huile 5 L",s:3,c:5200,p:6000,m:4},
 {n:"Sucre 1 kg",s:25,c:600,p:750,m:8},{n:"Savon de Marseille",s:2,c:350,p:500,m:5},
 {n:"Tomate concentrée",s:40,c:300,p:400,m:10}];

(async()=>{
 const png=await sharp(Buffer.from(svg)).png().toBuffer();
 console.log("image generee:",png.length,"octets");
 const fd=new FormData();
 fd.append("photo",new Blob([png],{type:"image/png"}),"cahier.png");
 fd.append("products",JSON.stringify(products));
 const t=Date.now();
 const r=await fetch("http://localhost:3000/api/extract",{method:"POST",body:fd,
  signal:AbortSignal.timeout(90000)});
 console.log("http:",r.status,"en",((Date.now()-t)/1000).toFixed(1),"s");
 const j=await r.json();
 console.log(JSON.stringify(j,null,2));
})().catch(e=>{console.error("ECHEC:",e.message);process.exit(1)});
