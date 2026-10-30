// Utilitaires partagés client et serveur (aucun accès réseau, aucune dépendance React).
export const fmt=n=>Math.round(n).toLocaleString("fr-FR")+" FCFA";
export const norm=s=>s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim();
