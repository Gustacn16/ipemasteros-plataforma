// Config em .mjs (não .ts): o servidor da Hostinger não roda o SWC nativo
// (glibc antiga), e um config em TypeScript precisaria dele para ser lido.
// Ver docs/decisoes/0002-build-na-hostinger.md

/** @type {import('next').NextConfig} */
const nextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
};

export default nextConfig;
