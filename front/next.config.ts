import type { NextConfig } from "next";

// L'adresse du serveur d'images se déduit de celle de l'API : un seul réglage
// à poser chez l'hébergeur, et `next/image` accepte les visuels envoyés depuis
// le back-office aussi bien en local qu'en ligne.
const api = new URL(process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000");

// Le domaine public du bucket Cloudflare R2, où partent les visuels envoyés
// depuis le back-office une fois la boutique en ligne (`pub-….r2.dev`, ou le
// domaine personnalisé qui le remplacera). Vide en développement : les fichiers
// restent alors sur le disque et sont servis par l'API, motif juste en dessous.
const hoteMedias = process.env.NEXT_PUBLIC_MEDIA_HOST?.trim();

const nextConfig: NextConfig = {
  // La boutique vit sur l'accueil : l'ancienne adresse y renvoie, et Next
  // reporte les paramètres (`?cat=…`) tout seul, donc une sélection partagée
  // avant le changement arrive encore au bon endroit.
  async redirects() {
    return [{ source: "/boutique", destination: "/", permanent: true }];
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "mcommaman.com", pathname: "/cdn/**" },
      // Les visuels envoyés depuis le back-office sont servis par l'API.
      {
        protocol: api.protocol.replace(":", "") as "http" | "https",
        hostname: api.hostname,
        port: api.port,
        pathname: "/media/**",
      },
      // Et par le bucket, dès qu'il est configuré.
      ...(hoteMedias
        ? [{ protocol: "https" as const, hostname: hoteMedias, pathname: "/**" }]
        : []),
    ],
  },
};

export default nextConfig;
