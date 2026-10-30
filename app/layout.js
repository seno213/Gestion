import "./globals.css";
import {StoreProvider} from "@/lib/store";
import Nav from "@/components/Nav";
export const metadata={title:"Stock IA",description:"Photo du cahier ou dictée en français : l'IA Meta extrait produits, quantités et prix, met à jour le stock et calcule le bénéfice du jour en FCFA."};
export const viewport={width:"device-width",initialScale:1,viewportFit:"cover",themeColor:"#1C4E80"};
// Engrenage décoratif (trait fin, statique) — style CAD-Inspired Blueprint.
const DECO=<svg className="deco" viewBox="0 0 100 100" fill="none" stroke="currentColor"
 strokeWidth=".6" aria-hidden="true">
 <circle cx="50" cy="50" r="30"/><circle cx="50" cy="50" r="11"/>
 <path d="M80 50h10M71.2 71.2l7.1 7.1M50 80v10M28.8 71.2l-7.1 7.1M20 50H10M28.8 28.8l-7.1-7.1M50 20V10M71.2 28.8l7.1-7.1"/>
</svg>;
export default function RootLayout({children}){
 return(<html lang="fr"><body>
  <StoreProvider>{DECO}<Nav/><main>{children}</main></StoreProvider>
 </body></html>);
}
