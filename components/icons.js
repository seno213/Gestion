// Pictos SVG en ligne (trait 2 px, style cohérent), aucune dépendance externe.
const S = {fill:"none",stroke:"currentColor",strokeWidth:2,strokeLinecap:"round",strokeLinejoin:"round"};
const I = d => <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" {...S}>{d}</svg>;

export const Home = () => I(<><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M9.5 21v-6h5v6"/></>);
export const Plus = () => I(<><path d="M12 5v14M5 12h14"/></>);
export const Box  = () => I(<><path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5z"/><path d="M3 7.5 12 12l9-4.5M12 12v9"/></>);
export const Cam  = () => I(<><path d="M3 8.5h3.5L8 6h8l1.5 2.5H21v11H3z"/><circle cx="12" cy="13.5" r="3.5"/></>);
export const Mic  = () => I(<><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11.5a7 7 0 0 0 14 0M12 18.5V21"/></>);
export const Warn = () => I(<><path d="M12 3 2.5 20h19z"/><path d="M12 10v4M12 17.5v.01"/></>);
export const Check= () => I(<><path d="m4 12.5 5 5 11-11"/></>);
export const Coin = () => I(<><circle cx="12" cy="12" r="9"/><path d="M12 7v10M9.5 9.5h5M9.5 14.5h5"/></>);
export const Cart = () => I(<><circle cx="9.5" cy="19.5" r="1.5"/><circle cx="17.5" cy="19.5" r="1.5"/><path d="M2.5 3.5h3l2.5 12h11l2-8.5H6.5"/></>);
export const Chat = () => I(<><path d="M4 4h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9l-5 4V5a1 1 0 0 1 1-1z"/><path d="M8 9h8M8 12.5h5"/></>);
export const Gear = () => I(<><circle cx="12" cy="12" r="3.2"/><path d="M12 2.8v3M12 18.2v3M2.8 12h3M18.2 12h3M5.5 5.5l2.1 2.1M16.4 16.4l2.1 2.1M18.5 5.5l-2.1 2.1M7.6 16.4l-2.1 2.1"/></>);
