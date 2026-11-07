import type { NextConfig } from "next";

// Sayfalar client component; veri TanStack Query ile FastAPI'den gelir.
// Bu yüzden Next'in sunucu tarafı önbellek özellikleri (cacheComponents vb.) kapalı bırakıldı.
const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
