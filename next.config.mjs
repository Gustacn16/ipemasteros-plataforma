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
};

export default nextConfig;
