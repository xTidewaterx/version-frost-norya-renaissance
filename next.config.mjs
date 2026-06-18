/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ["firebasestorage.googleapis.com", 'cdn.booniez.com', 'cdn.shopify.com', 'www.produits-scandinaves.com',
     'th.bing.com', "en.visitbergen.com", 'skappeloslo.com','tellusdmsmedia.newmindmedia.com', 'no.daleofnorway.com','produits-scandinaves.com', 'pmstudio.com', 'www.piasweaters.com', "www.thenordicshop.net", "www.nya-evo.com", "eu.daleofnorway.com",'lh6.googleusercontent.com','produits-scandinaves.com', "opticsoutfitter.com", 'https://lh6.googleusercontent.com', 'files.stripe.com'
], // ✅ Ensure Firebase domain is listed
  },
};

export default nextConfig;
