/** @type {import('next').NextConfig} */
const nextConfig={
 devIndicators:false,
 poweredByHeader:false,
 // Durcissement (testé par test-securite.js) : pas de MIME sniffable,
 // pas d'encadrement par un tiers (clickjacking), referrer minimal,
// caméra/micro réservés au site lui-même (visio de la saisie).
 async headers(){
  return [{
   source:"/:path*",
   headers:[
    {key:"X-Content-Type-Options",value:"nosniff"},
    {key:"X-Frame-Options",value:"DENY"},
    {key:"Referrer-Policy",value:"strict-origin-when-cross-origin"},
    {key:"Permissions-Policy",value:"camera=(self), microphone=(self)"}
   ]}];
 }
};
module.exports=nextConfig;
