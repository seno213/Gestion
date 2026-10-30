#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════════════
   Stock IA — suite de tests de sécurité
   Prérequis : serveur lancé (npm run dev) sur http://localhost:3000
   Usage     : node test-securite.js

   Couvre : authentification (cookies), isolation multi-boutiques (IDOR),
   fuites d'informations (code d'accès, clés API), injections SQL/XSS,
   validation des entrées (taille/type des photos, corps malformés),
   en-têtes HTTP/CORS, force brute (30 tentatives/min → 429).
   Les données de test (boutiques « SEC-* ») sont créées puis purgées.
   Aucun secret n'est jamais affiché (le script lit .env.local pour
   vérifier leur absence du code livré au navigateur).
   ══════════════════════════════════════════════════════════════════════ */
"use strict";
const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");

const BASE = process.env.BASE || "http://localhost:3000";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ── compteur de résultats ── */
const R = [];
const T = (cat, ok, desc, detail = "") => {
  R.push({ cat, ok, desc, detail });
  console.log(`  ${ok ? "✓" : "✗"} ${desc}${detail ? ` — ${detail}` : ""}`);
};
const W = (cat, desc, detail = "") => {
  R.push({ cat, ok: "!", desc, detail });
  console.log(`  ⚠ ${desc}${detail ? ` — ${detail}` : ""}`);
};
const I = (cat, desc, detail = "") => {
  R.push({ cat, ok: "-", desc, detail });
  console.log(`  · ${desc}${detail ? ` — ${detail}` : ""}`);
};
const section = (t) => console.log(`\n■ ${t}`);

/* ── appel HTTP JSON ── */
const call = async (p, { method = "GET", cookie, body, headers = {} } = {}) => {
  const h = { ...headers };
  if (cookie) h.Cookie = "tid=" + cookie;
  if (body !== undefined) h["Content-Type"] = "application/json";
  const r = await fetch(BASE + p, {
    method,
    headers: h,
    body: body !== undefined ? (typeof body === "string" ? body : JSON.stringify(body)) : undefined,
    signal: AbortSignal.timeout(120000),
  });
  const txt = await r.text().catch(() => "");
  let j = null;
  try { j = JSON.parse(txt); } catch {}
  return { status: r.status, j, txt, headers: r.headers };
};

/* ── secrets (jamais affichés) : lecture de .env.local ── */
const env = {};
try {
  for (const l of fs.readFileSync(path.join(__dirname, ".env.local"), "utf8").split(/\r?\n/)) {
    const i = l.indexOf("=");
    if (i > 0 && !/^\s*#/.test(l)) env[l.slice(0, i).trim()] = l.slice(i + 1).trim();
  }
} catch {}
const KEY = env.META_API_KEY || "";

/* ══════════ PHASE 0 — préparation : 2 boutiques concurrentes ══════════ */
const FAKE_JPG = "data:image/jpeg;base64," + Buffer.from("SECFAKEJPEG-PHOTO-DU-CAHIER").toString("base64");

async function mkTenant(name) {
  const r = await call("/api/tenant", { method: "POST", body: { mode: "create", name } });
  if (r.status !== 200) throw new Error("création " + name + " → HTTP " + r.status);
  const setCookie = r.headers.get("set-cookie") || "";
  const m = setCookie.match(/tid=([^;]+)/);
  return { name, id: r.j.tenant.id, code: r.j.tenant.code, cookie: m && m[1], setCookie, tenant: r.j.tenant };
}

(async () => {
  console.log("═════════════ TESTS DE SÉCURITÉ — Stock IA ═════════════");
  console.log("Cible :", BASE);

  section("0. Préparation (2 boutiques concurrentes A et B)");
  const A = await mkTenant("SEC Alpha");
  const B = await mkTenant("SEC Beta");
  I("prep", "Boutiques créées", `A=${A.name} · B=${B.name}`);
  T("prep", A.cookie && B.cookie && A.cookie !== B.cookie, "Cookies de session distincts à la création");

  // produits connus puis ventes (sans déclencher de génération d'image automatique)
  await call("/api/store", { method: "POST", cookie: A.cookie, body: { action: "addProduct", product: { n: "Riz SEC", s: 10, m: 2, c: 900, p: 1200 } } });
  await call("/api/store", { method: "POST", cookie: B.cookie, body: { action: "addProduct", product: { n: "Huile SEC", s: 5, m: 1, c: 700, p: 1000 } } });
  const saleA = await call("/api/store", { method: "POST", cookie: A.cookie, body: { action: "sale", lines: [{ n: "Riz SEC", q: 2, p: 1200 }], photo: FAKE_JPG } });
  const saleB = await call("/api/store", { method: "POST", cookie: B.cookie, body: { action: "sale", lines: [{ n: "Huile SEC", q: 1, p: 1000 }], photo: FAKE_JPG } });
  const pidB = (saleB.j.products.find((p) => p.n === "Huile SEC") || {}).id;
  const phoB = (saleB.j.photos[0] || {}).id;
  const phoA = (saleA.j.photos[0] || {}).id;
  T("prep", saleA.status === 200 && saleB.status === 200 && pidB && phoA && phoB, "Ventes + photos de saisie enregistrées de chaque côté");

  // une seule génération d'image payante : sur le produit de B (sert aux tests IDOR d'image)
  process.stdout.write("  · Génération de la vignette produit de B (muse-image-1.0, ~30 s)…\n");
  const gen = await call("/api/store", { method: "POST", cookie: B.cookie, body: { action: "genImage", name: "Huile SEC" } });
  T("prep", gen.status === 200, "Vignette produit générée et stockée");

  /* ══════════ 1. AUTHENTIFICATION ══════════ */
  section("1. Authentification — sans session valide");
  T("auth", (await call("/api/store")).status === 401, "GET /api/store sans cookie → 401");
  T("auth", (await call("/api/store", { method: "POST", body: { action: "sale", lines: [{ n: "x", q: 1, p: 1 }] } })).status === 401, "POST /api/store sans cookie → 401");
  T("auth", (await call("/api/tenant")).status === 401, "GET /api/tenant sans cookie → 401");
  T("auth", (await call("/api/img?pid=" + pidB)).status === 401, "GET /api/img sans cookie → 401");
  T("auth", (await call("/api/photo?id=" + phoB)).status === 401, "GET /api/photo sans cookie → 401");
  const forged = await call("/api/store", { cookie: "ffffffff-ffff-4fff-8fff-ffffffffffff" });
  T("auth", forged.status === 401, "Cookie forgé (UUID inventé) → 401");
  const forged2 = await call("/api/tenant", { cookie: "sess=hack; tid=abc" });
  T("auth", forged2.status === 401, "Cookie non-UUID → 401");

  /* ══════════ 2. ISOLATION MULTI-BOUTIQUES (IDOR) ══════════ */
  section("2. Isolation multi-boutiques (IDOR)");
  const snapA = (await call("/api/store", { cookie: A.cookie })).j || {};
  const snapB = (await call("/api/store", { cookie: B.cookie })).j || {};
  const inA = JSON.stringify(snapA), inB = JSON.stringify(snapB);
  T("idor", inA.includes("Riz SEC") && !inA.includes("Huile SEC"), "A voit ses données et seulement les siennes");
  T("idor", inB.includes("Huile SEC") && !inB.includes("Riz SEC"), "B voit ses données et seulement les siennes");
  T("idor", (await call("/api/img?pid=" + pidB, { cookie: A.cookie })).status === 404, "A ne peut pas lire l'image produit de B (IDOR img)");
  T("idor", (await call("/api/img?pid=" + pidB, { cookie: B.cookie })).status === 200, "B lit sa propre image produit");
  T("idor", (await call("/api/photo?id=" + phoB, { cookie: A.cookie })).status === 404, "A ne peut pas lire la photo du cahier de B (IDOR photo)");
  T("idor", (await call("/api/photo?id=" + phoB, { cookie: B.cookie })).status === 200, "B lit sa propre photo");
  const genSteal = await call("/api/store", { method: "POST", cookie: A.cookie, body: { action: "genImage", name: "Huile SEC" } });
  T("idor", genSteal.status === 404, "A ne peut pas déclencher une action sur un produit de B → 404");
  T("idor", (await call("/api/photo?id=99999999", { cookie: A.cookie })).status === 404, "ID de photo inexistant → 404");
  T("idor", (await call("/api/img?pid=99999999", { cookie: A.cookie })).status === 404, "ID de produit inexistant → 404");
  T("idor", (await call("/api/photo?id=abc", { cookie: A.cookie })).status === 404 && (await call("/api/img?pid=-5", { cookie: A.cookie })).status === 404, "Paramètres invalides (abc, -5) → 404, jamais d'erreur serveur");

  /* ══════════ 3. FUITES D'INFORMATIONS ══════════ */
  section("3. Fuites d'informations");
  const gt = await call("/api/tenant", { cookie: A.cookie });
  T("fuite", gt.status === 200 && !("code" in (gt.j.tenant || {})), "GET /api/tenant ne renvoie plus le code d'accès");
  const jb = await call("/api/tenant", { method: "POST", body: { mode: "join", code: B.code } });
  T("fuite", jb.status === 200 && !("code" in (jb.j.tenant || {})), "Le rejoint par code ne renvoie pas le code");
  T("fuite", typeof A.code === "string" && A.code.length === 6, "Le code n'est renvoyé qu'à la création (affiché une fois, à noter)");
  const storeTxt = (await call("/api/store", { cookie: A.cookie })).txt;
  T("fuite", !storeTxt.includes('"code"'), "GET /api/store ne contient aucun code d'accès");
  T("fuite", /HttpOnly/i.test(A.setCookie), "Cookie de session : HttpOnly (inaccessible au JavaScript)");
  if (/SameSite=Lax/i.test(A.setCookie)) T("fuite", true, "Cookie de session : SameSite=Lax (protection CSRF)");
  else W("fuite", "Cookie sans SameSite=Lax");
  if (/Secure/i.test(A.setCookie)) T("fuite", true, "Cookie de session : Secure");
  else W("fuite", "Cookie sans attribut Secure", "normal en démo HTTP localhost — obligatoire en production HTTPS");

  // absence des secrets dans le code livré au navigateur
  let leaked = [], chunks = [];
  try {
    const html = (await call("/", { cookie: A.cookie })).txt;
    const srcs = [...new Set([...html.matchAll(/src="(\/_next\/[^"]+\.js)"/g)].map((m) => m[1]))].slice(0, 60);
    chunks = await Promise.all(srcs.map(async (s) => (await fetch(BASE + s, { signal: AbortSignal.timeout(30000) })).text().catch(() => "")));
    chunks.push(html);
  } catch {}
  const all = chunks.join("\n");
  if (KEY) {
    const keyLeak = all.includes(KEY);
    if (keyLeak) leaked.push("META_API_KEY");
    T("fuite", !keyLeak, `Clé Meta absente des ${chunks.length} bundles/scripts servis`, keyLeak ? "FUITE DÉTECTÉE" : "");
  } else I("fuite", "META_API_KEY absente de .env.local — scan ignoré");
  if (env.TIDB_PASSWORD) {
    const dbLeak = all.includes(env.TIDB_PASSWORD);
    if (dbLeak) leaked.push("TIDB_PASSWORD");
    T("fuite", !dbLeak, "Mot de passe de base absent des bundles/scripts servis", dbLeak ? "FUITE DÉTECTÉE" : "");
  }
  T("fuite", !all.includes("tidbcloud.com") && !all.includes("gateway01."), "Aucune adresse de connexion à la base dans le code client");
  if (leaked.length) W("fuite", "SECRETS FUITEZ — à corriger immédiatement", leaked.join(","));

  /* ══════════ 4. INJECTIONS & VALIDATION DES ENTRÉES ══════════ */
  section("4. Injections (SQL/XSS) et validation des entrées");
  const SQLI = "x'; DROP TABLE tenants; --";
  const XSS = "<img src=x onerror=alert(1)>";
  const a1 = await call("/api/store", { method: "POST", cookie: A.cookie, body: { action: "addProduct", product: { n: SQLI, s: 1, m: 0, c: 1, p: 2 } } });
  const a2 = await call("/api/store", { method: "POST", cookie: A.cookie, body: { action: "addProduct", product: { n: XSS, s: 1, m: 0, c: 1, p: 2 } } });
  const snapAfter = (await call("/api/store", { cookie: A.cookie })).txt;
  T("injection", a1.status === 200 && a2.status === 200, "Requêtes SQL/XSS dans les noms acceptées sans erreur serveur");
  T("injection", snapAfter.includes(SQLI), "Injection SQL stockée LITTÉRALEMENT (requêtes préparées) — tables intactes");
  T("injection", snapAfter.includes(XSS), "Charge XSS stockée comme simple texte (React échappe à l'affichage)");
  const srcFiles = [];
  const walk = (d) => { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); if (f.isDirectory()) { if (!["node_modules", ".next", ".git"].includes(f.name)) walk(p); } else if (f.name.endsWith(".js")) srcFiles.push(p); } };
  walk(__dirname);
  const dh = srcFiles.filter((f) => f !== __filename).filter((f) => { try { return fs.readFileSync(f, "utf8").includes("dangerouslySetInnerHTML"); } catch { return false; } });
  T("injection", dh.length === 0, "Aucun dangerouslySetInnerHTML dans le code source", dh.join(", "));
  const sqliCode = await call("/api/tenant", { method: "POST", body: { mode: "join", code: "' OR '1'='1" } });
  T("injection", sqliCode.status === 404, "Injection SQL dans le code d'accès → 404 (jamais d'accès)");

  const nbPhotosBefore = ((await call("/api/store", { cookie: A.cookie })).j.photos || []).length;
  const big = await call("/api/store", { method: "POST", cookie: A.cookie, body: { action: "sale", lines: [{ n: "Riz SEC", q: 1, p: 1200 }], photo: "data:image/jpeg;base64," + "A".repeat(2300000) } });
  const txtPhoto = await call("/api/store", { method: "POST", cookie: A.cookie, body: { action: "sale", lines: [{ n: "Riz SEC", q: 1, p: 1200 }], photo: "data:text/plain;base64,AAAA" } });
  const nbPhotosAfter = ((await call("/api/store", { cookie: A.cookie })).j.photos || []).length;
  T("validation", big.status === 200 && txtPhoto.status === 200, "Ventes malformées traitées sans erreur 500");
  T("validation", nbPhotosAfter === nbPhotosBefore, "Photo > 2,2 Mo et type non-image REFUSÉES (non archivées)");

  T("validation", (await call("/api/store", { method: "POST", cookie: A.cookie, body: { action: "sale", lines: [] } })).status === 400, "Vente sans ligne → 400");
  T("validation", (await call("/api/store", { method: "POST", cookie: A.cookie, body: { action: "genImage", name: "" } })).status === 400, "genImage sans nom → 400");
  T("validation", (await call("/api/store", { method: "POST", cookie: A.cookie, body: { action: "genImage", name: "Produit Inexistant ZZZ" } })).status === 404, "genImage produit inexistant → 404");
  T("validation", (await call("/api/tenant", { method: "POST", body: { mode: "create", name: "A" } })).status === 400, "Nom de boutique trop court → 400");
  const longName = await call("/api/tenant", { method: "POST", body: { mode: "create", name: "N".repeat(80) } });
  T("validation", longName.status === 200 && longName.j.tenant.name.length <= 40, "Nom de boutique > 40 caractères tronqué");
  const badJson = await call("/api/store", { method: "POST", cookie: A.cookie, body: "{corrompu" });
  T("validation", badJson.status >= 400 && badJson.status < 500 && !/at\s+\w+\s+\(|stack/i.test(badJson.txt), "Corps JSON corrompu → erreur propre, sans pile d'appels", "HTTP " + badJson.status);
  const noPhoto = await call("/api/extract", { method: "POST", body: null }).catch(() => ({ status: 0 }));
  I("validation", "Route extraction : test sans pièce jointe → HTTP " + noPhoto.status + " (gérée)");

  /* ══════════ 5. SESSION & CORS ══════════ */
  section("5. Session, CORS et en-têtes");
  const C = await mkTenant("SEC Gamma");
  await call("/api/store", { method: "POST", cookie: C.cookie, body: { action: "addProduct", product: { n: "Sucre SEC", s: 3, m: 1, c: 500, p: 700 } } });
  const del = await call("/api/tenant", { method: "DELETE", cookie: C.cookie });
  T("session", del.status === 200 && del.j.ok === true, "Déconnexion (DELETE /api/tenant) fonctionne");
  const rejoined = await call("/api/tenant", { method: "POST", body: { mode: "join", code: C.code } });
  const rejoinedOk = rejoined.status === 200 && rejoined.j.tenant.id === C.id;
  const cStore = rejoinedOk ? (await call("/api/store", { cookie: rejoined.j.tenant.id })).j : null;
  T("session", rejoinedOk && cStore && JSON.stringify(cStore).includes("Sucre SEC"), "Rejoint par code après déconnexion : données toujours là (« quitter » = déconnexion, pas suppression)");
  I("session", "Le cookie vaut l'identifiant de boutique : sa fuite = accès (jeton)", "atténué par HttpOnly + HTTPS en production");

  const cors = await call("/api/store", { cookie: A.cookie });
  T("cors", !cors.headers.get("access-control-allow-origin"), "Réponse API sans Access-Control-Allow-Origin (pas de CORS ouvert)");
  const opt = await call("/api/store", { method: "OPTIONS", cookie: A.cookie });
  T("cors", !opt.headers.get("access-control-allow-origin"), "Requête OPTIONS sans CORS permissif");
  const hCheck = ["x-content-type-options", "x-frame-options"].filter((h) => !cors.headers.get(h));
  if (hCheck.length) W("en-têtes", "En-têtes de durcissement absents", hCheck.join(", ") + " — à ajouter dans next.config.js");
  else T("en-têtes", true, "En-têtes de sécurité présents (nosniff, X-Frame-Options)");

  /* ══════════ 6. FORCE BRUTE (dernier : déclenche le limiteur) ══════════ */
  section("6. Force brute sur le code d'accès");
  let r429 = 0, r404 = 0;
  for (let i = 0; i < 31; i++) {
    const r = await call("/api/tenant", { method: "POST", body: { mode: "join", code: "ZZZZZZ" } });
    if (r.status === 429) r429++;
    else if (r.status === 404) r404++;
  }
  T("force-brute", r429 >= 1, `Rafale de 31 tentatives : ${r404}×404 puis ${r429}×429 (limite 30/min active)`);
  const recovery = await call("/api/tenant", { method: "POST", body: { mode: "join", code: B.code }, headers: { "X-Forwarded-For": "198.51.100.7" } });
  T("force-brute", recovery.status === 200, "Un utilisateur sur une autre adresse n'est PAS bloqué (limite par adresse)");
  let spoof = 0;
  for (let i = 0; i < 6; i++) {
    const r = await call("/api/tenant", { method: "POST", body: { mode: "join", code: "ZZZZZZ" }, headers: { "X-Forwarded-For": `203.0.113.${i + 1}` } });
    if (r.status === 404) spoof++;
  }
  if (spoof === 6) W("force-brute", "Le limiteur se laisse contourner en forgeant X-Forwarded-For", "en dev sans proxy — derrière un vrai proxy, forcer/enregistrer la vraie IP");
  else T("force-brute", true, "Contournement par X-Forwarded-For non constaté");
  I("force-brute", "Espace des codes : 31^6 ≈ 887 millions de combinaisons → à 30/min, des milliers d'années");

  console.log("\n· Attente de 61 s (réinitialisation du limiteur)…");
  await sleep(61000);
  const after = await call("/api/tenant", { method: "POST", body: { mode: "join", code: B.code } });
  T("force-brute", after.status === 200, "Après 61 s : limite réinitialisée, rejointe légitime acceptée");

  /* ══════════ 7. NETTOYAGE + intégrité du schéma ══════════ */
  section("7. Nettoyage et intégrité du schéma");
  try {
    let cfg;
    if (env.DATABASE_URL) {
      const u = new URL(env.DATABASE_URL);
      cfg = { host: u.hostname, port: +u.port || 4000, user: decodeURIComponent(u.username), password: decodeURIComponent(u.password), database: u.pathname.slice(1) };
    } else cfg = { host: env.TIDB_HOST, port: +env.TIDB_PORT || 4000, user: env.TIDB_USER, password: env.TIDB_PASSWORD, database: env.TIDB_DATABASE };
    cfg.charset = "UTF8MB4_GENERAL_CI";
    if (env.TIDB_SSL !== "false") cfg.ssl = { minVersion: "TLSv1.2", rejectUnauthorized: true };
    const db = await mysql.createConnection({ ...cfg, connectTimeout: 20000 });
    const [tabs] = await db.query("SHOW TABLES");
    T("schéma", tabs.length === 5, `Schéma intact après injections — ${tabs.length}/5 tables`, tabs.map((t) => Object.values(t)[0]).join(", "));
    // Motif exact des boutiques créées par cette suite (« SEC Alpha/Beta/Gamma »
    // et le nom tronqué à 40 N) — ne touche JAMAIS aux boutiques réelles.
    const [rows] = await db.query(
      "SELECT id FROM tenants WHERE name IN ('SEC Alpha','SEC Beta','SEC Gamma') OR name = REPEAT('N',40)");
    for (const r of rows)
      for (const q of ["DELETE FROM sales WHERE tenant_id=?", "DELETE FROM products WHERE tenant_id=?", "DELETE FROM pimages WHERE tenant_id=?", "DELETE FROM sphotos WHERE tenant_id=?", "DELETE FROM tenants WHERE id=?"])
        await db.query(q, [r.id]);
    const [n] = await db.query("SELECT COUNT(*) n FROM tenants");
    T("nettoyage", true, `Données de test supprimées — ${rows.length} boutique(s) SEC purgée(s)`, `boutiques restantes : ${n[0].n}`);
    await db.end();
  } catch (e) {
    W("nettoyage", "Purge automatique impossible — à faire à la main", e.message);
  }

  /* ══════════ BILAN ══════════ */
  const pass = R.filter((r) => r.ok === true).length;
  const fail = R.filter((r) => r.ok === false).length;
  const warn = R.filter((r) => r.ok === "!").length;
  console.log("\n═════════════════ BILAN ═════════════════");
  console.log(`  ✓ ${pass} vérifications réussies`);
  if (warn) console.log(`  ⚠ ${warn} avertissement(s) (limites connues / production)`);
  if (fail) {
    console.log(`  ✗ ${fail} ÉCHEC(S) :`);
    for (const r of R.filter((r) => r.ok === false)) console.log(`     - [${r.cat}] ${r.desc}${r.detail ? " — " + r.detail : ""}`);
  } else console.log("  Aucun échec.");
  if (leaked.length) console.log("\n  ⛔ SECRÉT(S) EN FUITE DANS LE CODE CLIENT :", leaked.join(", "));
  console.log("════════════════════════════════════════");
  process.exit(fail ? 1 : 0);
})().catch((e) => {
  console.error("\nERREUR FATALE DE LA SUITE :", e.message);
  process.exit(2);
});
