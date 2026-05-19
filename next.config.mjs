/** @type {import('next').NextConfig} */
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Static export is only used for production Electron builds.
// In dev mode we run the normal Next.js server so HMR works.
const isStaticExport = process.env.NEXT_STATIC_EXPORT === '1';

const nextConfig = {
  // Pin the workspace root to THIS project directory.
  // Next.js 16 walks up the filesystem to find the outermost package.json/lockfile
  // and uses that as the root for CSS @import resolution, breaking packages
  // installed in fikr-studio/node_modules when running inside a monorepo.
  outputFileTracingRoot: __dirname,
  ...(isStaticExport && {
    output: "export",
    distDir: "out",
    assetPrefix: "./",
  }),
  typescript: {
    // Build errors are intentionally ignored — see CLAUDE.md
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "sharp$": false,
      "onnxruntime-node$": false,
    }
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      crypto: false,
    }
    // Resolve modules starting from this project's own node_modules
    config.resolve.modules = [
      `${__dirname}/node_modules`,
      'node_modules',
    ]
    return config
  },
  turbopack: {
    root: __dirname,
    resolveAlias: {
      fs: "./empty.js",
      path: "./empty.js",
      crypto: "./empty.js",
      sharp: "./empty.js",
      "onnxruntime-node": "./empty.js",
    },
  },
  allowedDevOrigins: ['100.98.133.119'],
  async headers() {
    return [
      {
        // Apply security headers to every route
        source: "/(.*)",
        headers: [
          {
            // Prevent framing (clickjacking)
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            // Stop MIME-type sniffing
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            // Limit referrer info sent to third-party origins
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            // Permissions policy — disable features the app doesn't use
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            // Content Security Policy
            // - default-src self: everything defaults to same-origin
            // - script-src: Next.js needs 'unsafe-inline' + 'unsafe-eval' in dev;
            //   nonces are the proper fix but require custom server — this is the
            //   pragmatic baseline for a static/Vercel deployment.
            // - connect-src: https: allows any user-configured custom endpoint
            // - img-src: data URIs for inline images, blob for canvas exports
            // - style-src unsafe-inline: Tailwind injects inline styles at runtime
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cloud.umami.is",
              "style-src 'self' 'unsafe-inline'",
              // Allow all HTTPS so user-configured custom base URLs (arbitrary
              // OpenAI-compatible endpoints) are not blocked by CSP. Enumerating
              // specific provider domains is incompatible with a custom-URL feature.
              // http://localhost:* covers local providers (Ollama, LM Studio, vLLM).
              "connect-src 'self' https: http://localhost:*",
              "img-src 'self' data: blob: https://i.ytimg.com",
              "font-src 'self' data:",
              "frame-src https://www.youtube-nocookie.com https://www.youtube.com",
              "frame-ancestors 'none'",
            ].join("; "),
          },
        ],
      },
    ]
  },
}

export default nextConfig
