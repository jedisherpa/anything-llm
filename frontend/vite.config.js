import { defineConfig } from "vite"
import { fileURLToPath, URL } from "url"
import postcss from "./postcss.config.js"
import react from "@vitejs/plugin-react"
import dns from "dns"
import { visualizer } from "rollup-plugin-visualizer"

dns.setDefaultResultOrder("verbatim")

// https://vitejs.dev/config/
export default defineConfig({
  assetsInclude: [
    './public/piper/ort-wasm-simd-threaded.wasm',
    './public/piper/piper_phonemize.wasm',
    './public/piper/piper_phonemize.data',
  ],
  worker: {
    format: 'es'
  },
  server: {
    port: 3000,
    host: "localhost"
  },
  define: {
    "process.env": process.env
  },
  css: {
    postcss
  },
  plugins: [
    react(),
    visualizer({
      template: "treemap", // or sunburst
      open: false,
      gzipSize: true,
      brotliSize: true,
      filename: "bundleinspector.html" // will be saved in project's root
    })
  ],
  resolve: {
    alias: [
      {
        find: "@",
        replacement: fileURLToPath(new URL("./src", import.meta.url))
      },
      {
        find: /^fs$/,
        replacement: fileURLToPath(new URL("./src/shims/emptyNodeBuiltin.js", import.meta.url))
      },
      {
        find: /^path$/,
        replacement: fileURLToPath(new URL("./src/shims/emptyNodeBuiltin.js", import.meta.url))
      },
      {
        find: /^crypto$/,
        replacement: fileURLToPath(new URL("./src/shims/browserCrypto.js", import.meta.url))
      },
      {
        process: "process/browser",
        stream: "stream-browserify",
        zlib: "browserify-zlib",
        util: "util",
        find: /^~.+/,
        replacement: (val) => {
          return val.replace(/^~/, "")
        }
      }
    ]
  },
  build: {
    modulePreload: {
      resolveDependencies(_url, deps, context) {
        if (context.hostType !== "html") return deps;

        return deps.filter((dep) => {
          if (
            dep.includes("locales-global-") ||
            dep.includes("locales-latin-")
          ) {
            return false;
          }

          return true;
        });
      }
    },
    rollupOptions: {
      onwarn(warning, warn) {
        if (
          warning.code === "EVAL" &&
          /onnxruntime-web/.test(warning.id || "")
        ) {
          return;
        }
        warn(warning);
      },
      output: {
        // These settings ensure the primary JS and CSS file references are always index.{js,css}
        // so we can SSR the index.html as text response from server/index.js without breaking references each build.
        entryFileNames: 'index.js',
        assetFileNames: (assetInfo) => {
          if (assetInfo.name === 'index.css') return `index.css`;
          return assetInfo.name;
        },
        manualChunks(id) {
          const localeMatch = id.match(/\/src\/locales\/([^/]+)\/common\.js$/);
          if (localeMatch) {
            if (localeMatch[1] === "en") {
              return "locales-core";
            }

            const latinLocaleGroup = new Set([
              "es",
              "fr",
              "de",
              "it",
              "pt_BR",
              "nl",
              "da",
              "pl",
              "ro",
              "cs",
              "lv",
            ]);

            return latinLocaleGroup.has(localeMatch[1])
              ? "locales-latin"
              : "locales-global";
          }

          if (id.includes("/src/locales/resources.js")) {
            return "locales-core";
          }

          if (!id.includes("node_modules")) return;

          if (
            id.includes("/@lobehub/icons/")
          ) {
            return "icons-vendor";
          }

          if (
            id.includes("/react-tooltip/") ||
            id.includes("/@floating-ui/")
          ) {
            return "overlay-vendor";
          }

          if (
            id.includes("/dompurify/") ||
            id.includes("/he/") ||
            id.includes("/entities/")
          ) {
            return "sanitize-vendor";
          }

          if (
            id.includes("/markdown-it/") ||
            id.includes("/linkify-it/") ||
            id.includes("/mdurl/") ||
            id.includes("/uc.micro/") ||
            id.includes("/punycode/")
          ) {
            return "markdown-parser-vendor";
          }

          if (id.includes("/katex/") || id.includes("/match-at/")) {
            return "katex-vendor";
          }

          if (id.includes("/highlight.js/")) {
            return "highlight-vendor";
          }

          if (
            id.includes("/@tremor/") ||
            id.includes("/@headlessui/react/") ||
            id.includes("/react-day-picker/") ||
            id.includes("/date-fns/") ||
            id.includes("/tailwind-merge/") ||
            id.includes("/aria-hidden/") ||
            id.includes("/tabbable/") ||
            id.includes("/@tanstack/") ||
            id.includes("/react-transition-state/") ||
            id.includes("/client-only/")
          ) {
            return "ui-vendor";
          }

          if (
            id.includes("/react-router/") ||
            id.includes("/@remix-run/router/")
          ) {
            return "router-vendor";
          }

          if (
            /\/node_modules\/react\//.test(id) ||
            /\/node_modules\/react-dom\//.test(id) ||
            /\/node_modules\/scheduler\//.test(id)
          ) {
            return "react-core-vendor";
          }

          if (
            id.includes("/i18next/") ||
            id.includes("/react-i18next/") ||
            id.includes("/i18next-browser-languagedetector/")
          ) {
            return "i18n-vendor";
          }

          if (
            id.includes("/lodash.debounce") ||
            id.includes("/lodash/")
          ) {
            return "lodash-vendor";
          }

          if (
            id.includes("/recharts/") ||
            id.includes("/recharts-scale/") ||
            id.includes("/victory-vendor/") ||
            id.includes("/react-smooth/") ||
            id.includes("/eventemitter3/")
          ) {
            return "charts-vendor";
          }

          if (
            id.includes("/react-transition-group/") ||
            id.includes("/dom-helpers/") ||
            id.includes("/prop-types/") ||
            id.includes("/tiny-invariant/") ||
            id.includes("/clsx/")
          ) {
            return "utility-vendor";
          }

          if (
            id.includes("/d3-") ||
            id.includes("/internmap/") ||
            id.includes("/decimal.js-light/")
          ) {
            return "d3-vendor";
          }

          if (
            id.includes("/html2canvas/") ||
            id.includes("/recharts-to-png/")
          ) {
            return "charts-export-vendor";
          }

          if (
            id.includes("/@mintplex-labs/piper-tts-web/") ||
            id.includes("/onnxruntime-web/")
          ) {
            return "speech-vendor";
          }
        },
      },
      external: [
        // Reduces transformation time by 50% and we don't even use this variant, so we can ignore.
        /@phosphor-icons\/react\/dist\/ssr/,
      ]
    },
    commonjsOptions: {
      transformMixedEsModules: true
    }
  },
  optimizeDeps: {
    include: ["@mintplex-labs/piper-tts-web"],
    esbuildOptions: {
      define: {
        global: "globalThis"
      },
      plugins: []
    }
  }
})
