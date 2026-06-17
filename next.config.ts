import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  basePath: process.env.NODE_ENV === 'production' ? '/zutomayo-card-game' : '',
  // trailingSlash makes the static export emit `/battle/index.html` so Pages
  // serves both `/battle` and `/battle/` (the latter previously 404'd). It
  // also fixes deep-link refreshes from any internal route.
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
