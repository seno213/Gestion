// Conditions d'utilisation — page légale statique, accessible sans compte (href /cgu).
// Même langage visuel que le reste de l'app : panneaux « box », textes français, style CAD.
export const metadata={title:"CGU — Stock IA",
 description:"Conditions générales d'utilisation de Stock IA : données enregistrées, traitement par intelligence artificielle, suppression, responsabilité."};

export default function CGU(){
 return(<>
  <h1>Conditions d’utilisation</h1>
  <p className="mut">En vigueur au 30 octobre 2026 · Service « Stock IA » — prototype</p>

  <div className="box" style={{marginTop:16}}><h2>1 — Objet</h2>
   <p>Stock IA est une application de gestion de stock destinée aux commerçants : photographiez votre cahier de ventes ou dictez vos ventes en français, l’intelligence artificielle en extrait les produits, quantités et prix, puis le stock et le bénéfice du jour sont calculés en FCFA.</p>
   <p>L’utilisation du service implique l’acceptation pleine et entière des présentes conditions.</p></div>

  <div className="box"><h2>2 — Éditeur</h2>
   <p>Prototype développé par <b>seno213</b> (Avian Soua) dans le cadre du Meta Global AI Developer Hackathon. Code source public : <a className="lnk" href="https://github.com/seno213/Gestion" target="_blank" rel="noreferrer">github.com/seno213/Gestion</a>. Contact : via les issues du dépôt GitHub.</p></div>

  <div className="box"><h2>3 — Boutique et code d’accès</h2>
   <p>Chaque boutique est strictement isolée : personne d’autre ne peut lire ni modifier ses données. L’accès se fait par un code secret de 6 caractères, affiché <b>une seule fois</b> à la création. Le garder confidentiel relève du commerçant : quiconque possède le code peut consulter et saisir les ventes de la boutique.</p></div>

  <div className="box"><h2>4 — Données enregistrées</h2>
   <p>Sont conservés : les produits (nom, stock, prix d’achat et de vente, seuil de réapprovisionnement), les ventes (article, quantité, prix, date), les photos des cahiers prises à la saisie et les vignettes de produits générées.</p>
   <p>Hébergement : Vercel (site et API) et TiDB Cloud (base de données, région de Tokyo, Japon). Aucune donnée n’est revendue ni transmise à des tiers à des fins publicitaires.</p></div>

  <div className="box"><h2>5 — Intelligence artificielle</h2>
   <p>La lecture des photos, la transcription des dictées et la génération d’images de produits passent par la Meta Model API. Les photos et textes envoyés ne servent qu’à l’extraction demandée.</p>
   <p><b>L’IA peut commettre des erreurs</b> (article mal lu, prix interprété à tort) : chaque saisie passe par un écran de vérification avant d’être enregistrée, et le commerçant reste seul responsable de la validation de ses données.</p></div>

  <div className="box"><h2>6 — Conservation et suppression</h2>
   <p>« Changer de boutique » est une simple déconnexion : les données restent enregistrées et retrouvables avec le code d’accès.</p>
   <p><b>« Supprimer la boutique » (page d’accueil) efface définitivement et immédiatement</b> la boutique, ses ventes, ses produits et ses photos, sur tous les appareils connectés. Cette action est irréversible.</p></div>

  <div className="box"><h2>7 — Limitation de responsabilité</h2>
   <p>Le service est fourni « en l’état », à titre de prototype de démonstration, sans garantie de disponibilité, d’exactitude ni d’adéquation à un usage commercial professionnel. La responsabilité du commerçant demeure engagée pour ses prix, ses stocks et ses déclarations commerciales. Aucune responsabilité ne saurait être imputée en cas d’erreur de lecture non vérifiée, de perte du code d’accès ou d’indisponibilité temporaire du service.</p></div>

  <div className="box"><h2>8 — Propriété intellectuelle</h2>
   <p>Le code source est publié sous licence MIT (fichier <b>LICENSE</b> du dépôt) : libre réutilisation, modification et redistribution, avec attribution. Les modèles d’intelligence artificielle et services utilisés restent la propriété de leurs éditeurs respectifs.</p></div>

  <div className="box"><h2>9 — Évolution des conditions</h2>
   <p>Les présentes conditions peuvent évoluer ; la version en vigueur est celle publiée sur cette page. La poursuite de l’utilisation après modification vaut acceptation de la nouvelle version.</p></div>

  <p style={{textAlign:"center",marginTop:16}}><a className="lnk" href="/">← Retour au tableau de bord</a></p>
 </>);
}
