"use client";
import Link from "next/link";
import {usePathname} from "next/navigation";
import {useStore} from "@/lib/store";
import {Home,Plus,Box,Gear} from "@/components/icons";
// Mobile (< 768 px) : barre fixe en bas. Bureau (≥ 768 px) : barre latérale 220 px.
const T=[["/","Tableau de bord",Home],["/vente","Nouvelle vente",Plus],["/stock","Stock",Box]];
export default function Nav(){
 const p=usePathname();
 const {tenant}=useStore()||{};
 return <nav className="nav" aria-label="Navigation principale">
  <span className="brand"><Gear/> Stock IA</span>
  {tenant?.name&&<span className="brand-sub">{tenant.name}</span>}
  {T.map(([h,l,Ico])=>
   <Link key={h} href={h} aria-current={p===h?"true":undefined}>
    <Ico/><span>{l}</span></Link>)}
 </nav>;
}
