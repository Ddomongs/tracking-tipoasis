/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  // Playwright drives `next dev` through 127.0.0.1; Next 16 blocks non-localhost dev origins by default.
  allowedDevOrigins: ["127.0.0.1"]
};

module.exports = nextConfig;
