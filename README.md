# Stock IA

Application web mobile de gestion de stock et de ventes pour petits commerçants.
Le commerçant photographie son cahier ou dicte ses ventes en français, l'IA les lit, il vérifie, et le stock et le bénéfice du jour (en FCFA) se mettent à jour.

Projet préparé pour le Meta Global AI Developer Hackathon (piste développeurs indépendants).

## Le concept
Un assistant IA de stock et de ventes pour les petits commerçants.

Le commerçant prend en photo son cahier de ventes, ou dicte ses ventes en français. L'IA de Meta en extrait les produits, les quantités et les prix, puis l'application met à jour le stock et calcule le bénéfice du jour en FCFA. Un tableau de bord affiche les ventes et les produits bientôt en rupture, et le commerçant peut corriger en un clic ce que l'IA a mal lu.

## Démarrer
1. `.env.local` : renseigner `META_API_KEY` (Meta Model API) et les identifiants de la base : `TIDB_HOST`, `TIDB_PORT`, `TIDB_USER`, `TIDB_PASSWORD`, `TIDB_DATABASE` — ou `DATABASE_URL=mysql://user:pass@host:4000/test`. Le schéma (tables `tenants`, `products`, `sales`, `pimages`, `sphotos`) est créé automatiquement au premier démarrage.
   - **TiDB Cloud** : identifiants du bouton **Connect** du cluster, port `4000`, TLS activé par défaut.
   - **MySQL / MariaDB local** (XAMPP, WAMP…) : `TIDB_HOST=127.0.0.1`, `TIDB_PORT=3306`, `TIDB_SSL=false` — repli hors-ligne possible (mêmes tables, même base dédiée `stock_ventes`). La démo utilise **TiDB Cloud** (Starter, région la plus proche du cluster, TLS automatique).
```bash
npm install
npm run dev
```
Puis ouvrir http://localhost:3000 (idéalement en affichage mobile, 375 px).
À la première visite, on crée une boutique **vide** (aucune donnée de démo) : l'application affiche un **code d'accès à 6 caractères** à noter — il rouvre la même boutique sur n'importe quel appareil, et n'apparaît plus ensuite (il reste stocké dans la base).

## Multi-boutique (multi-tenant)
Chaque boutique est un tenant isolé :

- **Données côté serveur** : **TiDB Cloud** ou **MySQL/MariaDB local** (protocole MySQL, pool `mysql2`) — même code dans les deux cas, seul `.env.local` change. Tables `tenants`, `products`, `sales`, `pimages` (vignettes produits générées par l'IA) et `sphotos` (photos des cahiers prises aux saisies) créées automatiquement — chaque ligne porte son `tenant_id`, et **toutes les requêtes sont filtrées par tenant** : aucune lecture ni écriture croisée entre deux boutiques.
- **Accès par code** : création en un écran (nom de la boutique → code 6 caractères, alphabet sans ambiguïté ni 0/O/1/I/L), ou rejoignable par ce code. Le code n'est affiché **qu'une fois, à la création** (à noter) ; ensuite il n'apparaît plus dans l'interface — il reste stocké dans la table `tenants` de la base. L'API refuse au-delà de 30 tentatives par minute (anti force brute). Session dans un cookie `httpOnly` (`tid`) — la clé d'API Meta et les données ne transitent jamais par le navigateur.
- **API** : `GET/POST/DELETE /api/tenant` (créer, rejoindre, quitter), `GET/POST /api/store` (snapshot, ventes — avec photo du cahier jointe —, ajout produit, action `genImage`), `GET /api/img?pid=` (vignette produit générée par l'IA) et `GET /api/photo?id=` (photo du cahier d'une saisie) — 401 sans boutique valide, images incluses : tout est filtré par `tenant_id`.
- **Côté client** : `lib/store.js` expose l'interface `useStore()` (`db`, `find`, `addProduct`, `recordSales`, `genImage`, `notify`, `leave`) — les pages n'ont pas changé de logique, elles attendent seulement la réponse serveur. L'écran de code remplace les pages tant qu'aucune boutique n'est ouverte.
- Le nom de la boutique apparaît sur le tableau de bord ; « Changer de boutique » vide la session.

## Structure
- `app/` : pages (`/` tableau de bord, `/vente` nouvelle vente, `/stock` stock), `app/api/extract/route.js` (lecture de cahier), `app/api/transcribe/route.js` (dictée) et `app/api/ask/route.js` (assistant stock)
- `test-extract.js` / `test-ask.js` : tests de bout en bout de l’API Meta (`node test-extract.js`)
- `test-securite.js` : suite de tests de sécurité (`node test-securite.js` avec le serveur lancé — 51 vérifications, crée puis purge ses données de test)
- `components/Nav.js` : navigation — barre fixe en bas (mobile) ou latérale à gauche 220 px (bureau ≥ 768 px)
- `components/icons.js` : système d’icônes SVG en ligne (aucune dépendance)
- `lib/store.js` : store multi-boutique — snapshot depuis l'API, écran de création/rejoindre, toast
- `lib/db.js` : couche TiDB/MySQL serveur (pool TLS, transactions, schéma auto-créé) — isolée par `tenant_id`
- `lib/shared.js` : utilitaires partagés client/serveur (`fmt`, `norm`)
- `lib/extract.js` : lecture d’une photo (appel à l’API, retour `{lines, crop}`) ou d’un texte, réduction de la photo côté navigateur (aperçu + archivage)
- `lib/voice.js` : dictée — conversion micro → WAV 16 kHz et appel de la route de transcription
- `lib/server-ai.js` : aides partagées des routes IA (extraction JSON, repli simulation, segmentation `sam-3.1` + recadrage, génération d’images produits `muse-image-1.0`)
- `app/globals.css` : design system « CAD-Inspired Blueprint » — fond bleu `#1C4E80`, grille blanche, filets fins, Consolas, accent orange

## Design
Registre « CAD-Inspired Blueprint » (density 7/10, motion statique) : fond bleu blueprint `#1C4E80` avec maillage carré blanc (24/120 px), engrenage décoratif en trait fin, ticks de mesure sur les bords supérieurs des cartes et de la navigation. Filets blancs `rgba(255,255,255,.30)` pour toute la hiérarchie, panneaux `#174370`, texte blanc, secondaire blanc à 78 %. Accent unique orange `#E85D35` (CTA, focus 2 px, indicateur d'onglet actif) ; or `#FFD700` en ligne de guide (repères, toast). Police Consolas (système, avec Monaco pour les étiquettes), rayon 8 px partout, montants FCFA 24 px graisse 700. Un seul bouton primaire par écran. Transitions couleur 150 ms uniquement — aucune animation d'entrée, squelettes en shimmer.

## Meta Model API (branchée ✅)
La lecture des cahiers passe par la vraie API : `app/api/extract/route.js` envoie la photo à `muse-spark-1.3` (vision) et renvoie `{ lines: [{ n, q, p, conf }] }`. La dictée passe par `app/api/transcribe/route.js` : `muse-voice-transcribe-1.0` (`POST /v1/asr/transcribe`, WAV mono 16 kHz, `languageBias: ["French"]` + noms de produits en `keywords`) transcrit la voix, puis `muse-spark-1.3` transforme le texte en lignes de vente. La clé reste côté serveur (`.env.local`, ignoré par git) — jamais exposée au navigateur.

Trois modèles Meta supplémentaires sont branchés (pack « images et preuves ») :

- **`sam-3.1`** (via `/v1/responses`, format `<|box;x1=…|>`) : avant la lecture, détecte le cahier dans la photo et en recadre la boîte englobante (recadrage `jimp`, pur JS) — utile quand la photo est prise de loin. Repli silencieux sur la photo entière si rien n'est détecté ; l'écran de vérification affiche « 📐 Carnet isolé par sam-3.1 » quand le recadrage a servi.
- **`muse-image-1.0`** (`/v1/images/generations`, JPEG) : génère une photo catalogue pour chaque produit inconnu rencontré en vente — **en arrière-plan**, la vente n'attend jamais. Vignette 320 px servie par `/api/img` dans la page Stock, avec bouton « Régénérer l'image ».
- **Photos du cahier** : la photo prise à la saisie est réduite côté navigateur (≤ 1280 px), archivée avec la vente (table `sphotos`, servie par `/api/photo`) et affichée en vignette cliquable sur le tableau de bord — utile en cas de contestation sur une lecture de l'IA.

1. `.env.local` : `META_API_KEY`, et si besoin `META_BASE_URL` / `META_MODEL` — plus les variables TiDB (voir « Démarrer »).
2. Les lignes dont `conf` est inférieure à 0,75 s'affichent en ambre dans l'écran de vérification.
3. Si l'API est indisponible, la route bascule automatiquement en simulation (`simulated: true`) pour ne pas casser la démo.
4. Test de bout en bout : `node test-extract.js` (génère une image de cahier, vérifie l'extraction réelle).

Modèles disponibles : `muse-spark-1.3` (raisonnement, vision, contexte long), `muse-image-1.0` (génération/édition d'images), `sam-3.1` (segmentation), `muse-wonder-1.0` (tâches lourdes), `muse-voice-transcribe-1.0` (transcription). Attention : `muse-spark-1.3` consomme des tokens de raisonnement avant de répondre — prévoir `max_tokens` généreux (≥ 500 pour une réponse courte, 4000 pour une lecture de cahier).

## Sécurité (testée ✅ — `node test-securite.js`)
51 vérifications automatiques contre le serveur lancé, toutes au vert :

- **Isolation multi-boutiques (IDOR)** : chaque requête — données, vignettes produits, photos de saisie, actions — est filtrée par `tenant_id` : une boutique ne peut ni lire ni agir sur une autre, y compris par `?id=` / `?pid=` devinés (→ 404, jamais 500).
- **Session** : cookie `tid` `httpOnly` + `SameSite=Lax`. Sans cookie ou avec cookie forgé → 401 sur toutes les routes. En production HTTPS : activer l'attribut `Secure` (absent en démo HTTP localhost).
- **Code d'accès** : renvoyé **uniquement à la création** (affiché une fois, à noter) — `GET /api/tenant` et le rejoint ne le renvoient plus. 31^6 ≈ 887 millions de combinaisons, plafonnées à 30 tentatives/minute puis 429. Limite par adresse : derrière un vrai proxy, forcer l'IP réelle (le header `X-Forwarded-For` est forgeable en dev).
- **Secrets** : `META_API_KEY` et les identifiants TiDB sont absents de **tous les bundles/scripts servis au navigateur** (scan automatisé à chaque test).
- **Injections & entrées** : requêtes préparées `mysql2` partout (charges SQL stockées littéralement, tables intactes), React échappe à l'affichage (aucun `dangerouslySetInnerHTML`), photos > 2,2 Mo ou type non-image refusées, corps malformés → 400 sans pile d'appels.
- **En-têtes HTTP** : `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy` (caméra/micro sur le site uniquement) — et aucun CORS ouvert.

## Déploiement (Vercel ✅)

En ligne sur **https://stock-ia-gray.vercel.app** (projet `stock-ia`, région **hnd1 — Tokyo**, la plus proche du cluster TiDB).

- **Variables d'environnement** (jamais dans le dépôt) : `META_API_KEY`, `TIDB_HOST`, `TIDB_PORT`, `TIDB_USER`, `TIDB_PASSWORD`, `TIDB_DATABASE` — injectées via `vercel env add … production`.
- **Mode serverless** : `export const maxDuration = 60` sur les routes IA (sam-3.1, ASR, génération d'image) ; la génération d'images de fond passe par `after()` de `next/server` (sur Vercel, le travail post-réponse doit être déclaré, sinon la fonction gèle dès l'envoi de la réponse).
- **Latence** : les fonctions s'exécutent à Tokyo (`X-Vercel-Id: …::hnd1::…`) ; TiDB étant dans la même région, les requêtes SQL sont ~10 ms au lieu de ~250 ms depuis l'Europe ou l'Afrique.
- Redéploiement : `npx vercel --prod` (le `.vercelignore` exclut `.env.local`, les tests et `.next`).
- **Code source** : publié sur **https://github.com/seno213/Gestion** (dépôt public, aucun secret versionné — `.env.local`, `.vercel`, `.next` et les tests sont ignorés).

## Prochaines étapes
- Remplacer le code d’accès par un vrai compte (e-mail/mot de passe ou OTP SMS) et ajouter les rôles (propriétaire, employé).
- Ajouter les écrans de détail produit et le mode hors ligne (dictée en file d’attente).
