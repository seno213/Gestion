// Couche données multi-boutique (multi-tenant) — TiDB Cloud (compatible MySQL),
// protocole MySQL + TLS (obligatoire sur endpoint public). Chaque ligne porte son
// tenant_id : aucune requête ne peut lire ou écrire les données d'une autre boutique.
// Le schéma (tables tenants/products/sales) est créé automatiquement au premier démarrage.
// Config : TIDB_HOST / TIDB_PORT / TIDB_USER / TIDB_PASSWORD / TIDB_DATABASE dans .env.local
// (bouton Connect du cluster TiDB Cloud), ou DATABASE_URL au format mysql://user:pass@host:4000/db.
import mysql from "mysql2/promise";
import {randomUUID} from "node:crypto";
import {norm} from "./shared";

const common={
 charset:"UTF8MB4_GENERAL_CI",
 ssl:process.env.TIDB_SSL==="false"?undefined:{minVersion:"TLSv1.2",rejectUnauthorized:true},
 connectionLimit:5,enableKeepAlive:true};

// Deux formats acceptés : variables nommées (recommandé) ou URL unique.
const url=process.env.DATABASE_URL?new URL(process.env.DATABASE_URL):null;
const cfg=url?{
 host:url.hostname,port:+url.port||4000,
 user:decodeURIComponent(url.username),password:decodeURIComponent(url.password),
 database:(url.pathname||"/test").slice(1)||"test",...common}:{
 host:process.env.TIDB_HOST,port:+(process.env.TIDB_PORT||4000),
 user:process.env.TIDB_USER,password:process.env.TIDB_PASSWORD||"",
 database:process.env.TIDB_DATABASE||"test",...common};

// Singleton partagé entre les rechargements du hot-reload en développement.
const pool=globalThis.__stockiaPool||(globalThis.__stockiaPool=mysql.createPool(cfg));

// Code d'accès : 6 caractères sans ambiguïté (pas de 0/O ni 1/I/L).
const ALPHABET="ABCDEFGHJKMNPQRSTUVWXYZ23456789";

let ready=globalThis.__stockiaReady;
const ensure=()=>{
 if(ready)return ready;
 if(!cfg.host||!cfg.user)ready=Promise.reject(new Error(
  "Base de données non configurée : renseignez TIDB_HOST, TIDB_USER, TIDB_PASSWORD et TIDB_DATABASE dans .env.local (bouton Connect du cluster TiDB Cloud)."));
 else ready=(async()=>{
  await pool.query(`CREATE TABLE IF NOT EXISTS tenants(
   id VARCHAR(36) PRIMARY KEY, name VARCHAR(80) NOT NULL,
   code VARCHAR(6) NOT NULL UNIQUE, created_at BIGINT NOT NULL) DEFAULT CHARSET=utf8mb4`);
  await pool.query(`CREATE TABLE IF NOT EXISTS products(
   id INT AUTO_INCREMENT PRIMARY KEY, tenant_id VARCHAR(36) NOT NULL,
   n VARCHAR(191) NOT NULL, s INT NOT NULL DEFAULT 0, c INT NOT NULL DEFAULT 0,
   p INT NOT NULL DEFAULT 0, m INT NOT NULL DEFAULT 3,
   UNIQUE KEY uq_products(tenant_id,n), KEY idx_products_tenant(tenant_id)) DEFAULT CHARSET=utf8mb4`);
  await pool.query(`CREATE TABLE IF NOT EXISTS sales(
   id INT AUTO_INCREMENT PRIMARY KEY, tenant_id VARCHAR(36) NOT NULL,
   n VARCHAR(191) NOT NULL, q INT NOT NULL, p INT NOT NULL,
   c INT NOT NULL DEFAULT 0, t BIGINT NOT NULL,
   KEY idx_sales_tenant(tenant_id)) DEFAULT CHARSET=utf8mb4`);
  await pool.query(`CREATE TABLE IF NOT EXISTS pimages(
   pid INT PRIMARY KEY, tenant_id VARCHAR(36) NOT NULL,
   img MEDIUMBLOB NOT NULL, t BIGINT NOT NULL,
   KEY idx_pimages_tenant(tenant_id)) DEFAULT CHARSET=utf8mb4`);
  await pool.query(`CREATE TABLE IF NOT EXISTS sphotos(
   id INT AUTO_INCREMENT PRIMARY KEY, tenant_id VARCHAR(36) NOT NULL,
   t BIGINT NOT NULL, img MEDIUMBLOB NOT NULL,
   KEY idx_sphotos_tenant(tenant_id,t)) DEFAULT CHARSET=utf8mb4`)})();
 globalThis.__stockiaReady=ready;
 return ready};

// Colonnes publiques d'une boutique : le code d'accès ne quitte JAMAIS le serveur
// après sa création (il n'est renvoyé que dans la réponse de création elle-même).
const PUBLIC="id,name";

export const createTenant=async name=>{
 await ensure();
 const id=randomUUID();
 let code;
 for(;;){code="";for(let i=0;i<6;i++)code+=ALPHABET[Math.floor(Math.random()*ALPHABET.length)];
  const [r]=await pool.execute("SELECT 1 AS x FROM tenants WHERE code=? LIMIT 1",[code]);
  if(!r.length)break}
 await pool.execute("INSERT INTO tenants(id,name,code,created_at) VALUES(?,?,?,?)",
  [id,name,code,Date.now()]);
 // Nouvelle boutique vide : aucune donnée de démo (le stock se remplit par l'IA ou la page Stock).
 return {id,name,code}};

export const joinTenant=async code=>{
 await ensure();
 const [rows]=await pool.execute(`SELECT ${PUBLIC} FROM tenants WHERE code=?`,
  [String(code||"").trim().toUpperCase()]);
 return rows[0]};

export const getTenant=async id=>{
 await ensure();
 const [rows]=await pool.execute(`SELECT ${PUBLIC} FROM tenants WHERE id=?`,[id]);
 return rows[0]};

// Suppression définitive d'une boutique et de toutes ses données (RGPD).
// Ne peut porter que sur la boutique du cookie courant — jamais sur une autre.
export const deleteTenant=async id=>{
 await ensure();
 for(const t of ["sales","products","pimages","sphotos"])
  await pool.execute(`DELETE FROM ${t} WHERE tenant_id=?`,[id]);
 await pool.execute("DELETE FROM tenants WHERE id=?",[id])};

// Lecture du snapshot via n'importe quel exécuteur (pool ou connexion de transaction).
// products porte id + drapeau i (image IA présente) ; photos = saisies du cahier récentes.
const snap=async(ex,id)=>{
 const [products]=await ex.execute(
  "SELECT p.id,p.n,p.s,p.c,p.p,p.m,(j.pid IS NOT NULL) AS i FROM products p "+
  "LEFT JOIN pimages j ON j.pid=p.id AND j.tenant_id=p.tenant_id "+
  "WHERE p.tenant_id=? ORDER BY p.id",[id]);
 const [sales]=await ex.execute(
  "SELECT n,q,p,c,t FROM sales WHERE tenant_id=? ORDER BY id",[id]);
 const [photos]=await ex.execute(
  "SELECT id,t FROM sphotos WHERE tenant_id=? ORDER BY id DESC LIMIT 12",[id]);
 return {products,sales,photos}};

export const snapshot=async id=>{await ensure();return snap(pool,id)};

// Enregistre des ventes en transaction : décrémente le stock (jamais sous 0), crée le
// produit s'il est inconnu, journalise la vente avec le coût d'achat courant.
export const recordSales=async(id,lines)=>{
 await ensure();
 const conn=await pool.getConnection();
 const created=[]; // produits créés automatiquement (pour l'image IA en arrière-plan)
 try{
  await conn.beginTransaction();
  const [rows]=await conn.execute(
   "SELECT id,n,s,c,p FROM products WHERE tenant_id=? FOR UPDATE",[id]);
  const find=n=>{const k=norm(n);if(!k)return null;
   return rows.find(r=>norm(r.n)===k)||rows.find(r=>norm(r.n).includes(k)||k.includes(norm(r.n)))||null};
  for(const l of lines){
   const nom=String(l.n).trim();
   let p=find(l.n);
   if(!p){const [r]=await conn.execute(
     "INSERT INTO products(tenant_id,n,s,c,p,m) VALUES(?,?,0,0,?,3)",[id,nom,Math.max(0,+l.p||0)]);
    p={id:r.insertId,n:nom,s:0,c:0,p:+l.p||0};created.push(p)}
   const q=Math.max(1,+l.q||0),prix=Math.max(0,+l.p||0);
   await conn.execute("UPDATE products SET s=? WHERE id=?",[Math.max(0,p.s-q),p.id]);
   await conn.execute("INSERT INTO sales(tenant_id,n,q,p,c,t) VALUES(?,?,?,?,?,?)",
    [id,p.n,q,prix,p.c,Date.now()])}
  await conn.commit();
  return {snap:await snap(conn,id),created};
 }catch(e){await conn.rollback().catch(()=>{});throw e}
 finally{conn.release()}};

export const addProduct=async(id,p)=>{
 await ensure();
 await pool.execute(
  "INSERT INTO products(tenant_id,n,s,c,p,m) VALUES(?,?,?,?,?,?) "+
  "ON DUPLICATE KEY UPDATE s=VALUES(s),c=VALUES(c),p=VALUES(p),m=VALUES(m)",
  [id,String(p.n||"").trim(),Math.max(0,+p.s||0),Math.max(0,+p.c||0),
   Math.max(0,+p.p||0),Math.max(0,+p.m||3)]);
 return snapshot(id)};

// ——— Images produits (muse-image-1.0) et photos de saisie (cahier) ———
export const getImage=async(id,pid)=>{
 await ensure();
 const [r]=await pool.execute("SELECT img FROM pimages WHERE pid=? AND tenant_id=?",[pid,id]);
 return r[0]?.img};

export const setImage=async(id,pid,buf)=>{
 await ensure();
 await pool.execute("REPLACE INTO pimages(pid,tenant_id,img,t) VALUES(?,?,?,?)",
  [pid,id,buf,Date.now()])};

export const findProduct=async(id,n)=>{
 await ensure();
 const [r]=await pool.execute("SELECT id,n FROM products WHERE tenant_id=? AND n=?",
  [id,String(n||"").trim()]);
 return r[0]};

export const addPhoto=async(id,buf)=>{
 await ensure();
 const [r]=await pool.execute("INSERT INTO sphotos(tenant_id,t,img) VALUES(?,?,?)",
  [id,Date.now(),buf]);
 return r.insertId};

export const getPhoto=async(id,phid)=>{
 await ensure();
 const [r]=await pool.execute("SELECT img FROM sphotos WHERE id=? AND tenant_id=?",[phid,id]);
 return r[0]?.img};
