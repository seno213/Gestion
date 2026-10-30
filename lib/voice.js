// Dictée : micro → WAV mono 16 kHz (format exigé par l'ASR Meta) → route /api/transcribe.
// Le navigateur enregistre en webm/opus : on décode puis on rééchantillonne en PCM 16 bits.

function wav16(out){
 const d=out.getChannelData(0),n=d.length,r=out.sampleRate;
 const ab=new ArrayBuffer(44+n*2),v=new DataView(ab);
 const w=(o,s)=>{for(let i=0;i<s.length;i++)v.setUint8(o+i,s.charCodeAt(i))};
 w(0,"RIFF");v.setUint32(4,36+n*2,true);w(8,"WAVEfmt ");v.setUint32(16,16,true);
 v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,r,true);v.setUint32(28,r*2,true);
 v.setUint16(32,2,true);v.setUint16(34,16,true);w(36,"data");v.setUint32(40,n*2,true);
 let o=44;
 for(let i=0;i<n;i++){const s=Math.max(-1,Math.min(1,d[i]));v.setInt16(o,s<0?s*0x8000:s*0x7FFF,true);o+=2}
 return ab;
}

// Convertit l'enregistrement du micro (blob MediaRecorder) en WAV mono 16 kHz.
export async function toWav(blob){
 const AC=window.OfflineAudioContext||window.webkitOfflineAudioContext;
 const buf=await new AC(1,1,16000).decodeAudioData(await blob.arrayBuffer());
 const rate=16000,len=Math.max(1,Math.ceil(buf.duration*rate));
 const off=new AC(1,len,rate);
 const src=off.createBufferSource();src.buffer=buf;src.connect(off.destination);src.start();
 const out=await off.startRendering();
 return new Blob([wav16(out)],{type:"audio/wav"});
}

// Envoie le WAV à /api/transcribe : renvoie {lines, transcript, simulated?}.
export async function transcribeAudio(wav,products){
 const fd=new FormData();fd.append("audio",wav,"ventes.wav");fd.append("products",JSON.stringify(products));
 const r=await fetch("/api/transcribe",{method:"POST",body:fd});
 if(!r.ok)throw new Error("transcribe");
 return await r.json();
}
