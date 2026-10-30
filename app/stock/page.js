"use client";
import { useState } from "react";
import { useStore, fmt, norm } from "@/lib/store";
import { Box } from "@/components/icons";
const EMPTY = { n: "", s: "", m: "", c: "", p: "" };

export default function Stock() {
  const { db, addProduct, genImage, notify } = useStore();
  const [q, setQ] = useState(""), [f, setF] = useState(EMPTY), [err, setErr] = useState(false);
  const [gi, setGi] = useState(""); // produit en cours de génération d'image IA
  const L = db.products.filter(p => norm(p.n).includes(norm(q)));
  const set = k => e => setF({ ...f, [k]: e.target.value });
  const add = async () => {
    const n = f.n.trim(); setErr(!n); if (!n) return;
    try { await addProduct({ n, s: +f.s || 0, m: +f.m || 3, c: +f.c || 0, p: +f.p || 0 }); setF(EMPTY); notify("Produit ajouté"); }
    catch (e) { notify(e.message || "Enregistrement impossible. Réessayez."); }
  };
  const gen = async p => {
    setGi(p.n);
    try { await genImage(p.n); notify(p.i ? "Image régénérée" : "Image générée"); }
    catch (e) { notify(e.message || "Génération d’image impossible. Réessayez."); }
    finally { setGi(""); }
  };
  const F = (k, l, full) => <div className={full ? "full" : ""}><label htmlFor={"f" + k}>{l}</label>
    <input id={"f" + k} type={k === "n" ? "text" : "number"} inputMode={k === "n" ? undefined : "numeric"} min={k === "n" ? undefined : 0} className={k === "n" && err ? "bad" : ""} value={f[k]} onChange={set(k)} />
    {k === "n" && err && <div className="hint">Donnez un nom au produit.</div>}</div>;
  const row = p => {
    const out = p.s === 0, low = p.s <= p.m;
    const pct = Math.min(100, Math.round(p.s / Math.max(1, p.m * 3) * 100));
    const marge = p.c > 0 ? Math.round((p.p - p.c) / p.c * 100) : null;
    return <li key={p.n}>
      <div className="row-main">
        <div className="bar img">
          <span className="lft">
            {p.i
              ? <img className="th" src={"/api/img?pid=" + p.id} alt="" loading="lazy" />
              : <span className="th ph" aria-hidden="true">▢</span>}
            <b>{p.n}</b>
          </span>
          <span>{fmt(p.p)}</span>
        </div>
        <div className="bar"><span className="mut">{out ? "Rupture" : `Reste ${p.s}`}{marge != null ? ` · marge ${marge}%` : ""}</span></div>
        <div className={"gauge" + (out ? " out" : low ? " low" : "")}><i style={{ width: (out ? 100 : pct) + "%" }} /></div>
      </div>
      <div className="side">
        {low && <span className={"tag" + (out ? "" : " w")}>{out ? "En rupture" : "À acheter"}</span>}
        <button className="gi" disabled={!!gi} onClick={() => gen(p)}>
          {gi === p.n ? "Génération…" : p.i ? "Régénérer l’image" : "Générer l’image"}
        </button>
      </div>
    </li>;
  };
  return (<>
    <h1>Stock</h1>
    <p className="mut">{db.products.length} produits · {db.products.filter(p => p.s <= p.m).length} à réapprovisionner</p>

    <label htmlFor="q">Rechercher un produit</label>
    <input id="q" type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Riz, huile, sucre…" />

    <div className="box" style={{ marginTop: 12 }}>
      <ul className="list">{L.length ? L.map(row) : <li className="empty mut"><Box/><b>{db.products.length ? "Aucun produit ne correspond" : "Aucun produit pour le moment"}</b>{db.products.length ? "Ajoutez-le ci-dessous." : "Ajoutez votre premier produit ci-dessous."}</li>}</ul>
    </div>

    <div className="box"><h2>Ajouter un produit</h2>
      <div className="frm">{F("n", "Nom du produit", true)}{F("s", "En stock")}{F("m", "Seuil d’alerte")}{F("c", "Prix d’achat")}{F("p", "Prix de vente")}</div>
      <div className="acts"><button className="p" onClick={add}>Ajouter le produit</button></div>
      <p className="mut" style={{margin:"10px 0 0"}}>Les produits rencontrés en vente sont créés automatiquement et reçoivent une photo catalogue générée par l’IA (muse-image-1.0).</p>
    </div>
  </>);
}
