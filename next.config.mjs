// Config em .mjs (não .ts): o servidor da Hostinger não roda o SWC nativo
// (glibc antiga), e um config em TypeScript precisaria dele para ser lido.
// Ver docs/decisoes/0002-build-na-hostinger.md
// Cache Components desligado de propósito: ver docs/decisoes/0003-sem-cache-components.md

const cabecalhosSeguranca = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: cabecalhosSeguranca }];
  },
  // Turbopack (next dev) não precisa de ajuste para o worker; o objeto vazio só avisa ao
  // Next 16 que a config de webpack abaixo é intencional (sem ele, o Turbopack recusa).
  turbopack: {},
  webpack(config, { isServer }) {
    // Workers do servidor (worker_threads, ex.: leitura do iCal da Agenda): o chunk do
    // worker fica ao lado dos outros em .next/server/chunks. Sem isto o webpack usaria o
    // publicPath "/_next/" (o padrão "" cai nele) e procuraria o arquivo em file:///_next/...
    if (isServer) config.output.workerPublicPath = "./";
    return config;
  },
};

export default nextConfig;
