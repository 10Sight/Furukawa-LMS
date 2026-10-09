import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import path from "path";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'], 
        // Default 2 MiB limit is too tight for this app's largest shared vendor
        // chunk; raised with headroom so routine dependency growth doesn't
        // intermittently break the production build.
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024
      },
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'Furukawa Minda LMS',
        short_name: 'Furukawa Minda',
        description: 'Learning Management System',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        orientation: 'portrait',
        icons: [
          {
            src: '/icons/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      },
      devOptions: {
        enabled: true,
        suppressWarnings: true,
        type: 'module'
      }
    })
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@components": path.resolve(__dirname, "./src/components"),
      "@pages": path.resolve(__dirname, "./src/pages"),
      "@routes": path.resolve(__dirname, "./src/routes"),
      "@context": path.resolve(__dirname, "./src/context"),
      "@services": path.resolve(__dirname, "./src/services"),
      "@constants": path.resolve(__dirname, "./src/constants"),
      "@styles": path.resolve(__dirname, "./src/styles"),
      "@hooks": path.resolve(__dirname, "./src/hooks"),
      "@assets": path.resolve(__dirname, "./src/assets"),
      "@utils": path.resolve(__dirname, "./src/utils"),
      "@emotion/styled": path.resolve(__dirname, "node_modules/@emotion/styled"),
      "@emotion/react": path.resolve(__dirname, "node_modules/@emotion/react"),
    },
  },
  build: {
    // Optimize build performance
    target: 'esnext',
    minify: 'esbuild',
    sourcemap: true, // Disable sourcemaps for production builds to reduce size
    cssCodeSplit: true, // Split CSS into separate chunks
    rollupOptions: {
      output: {
        // Manual chunk splitting for better caching
        manualChunks: {
          // Vendor chunks
          vendor: ['react', 'react-dom', 'react-router-dom'],
          ui: ['@radix-ui/react-accordion', '@radix-ui/react-alert-dialog', '@radix-ui/react-avatar'],
          redux: ['@reduxjs/toolkit', 'react-redux'],
          utils: ['axios', 'date-fns', 'lucide-react'],
          // Route-based chunks
          admin: [
            './src/pages/courses/admin/Course.jsx',
            './src/pages/users/admin/Instructor.jsx',
            './src/pages/users/admin/Students.jsx',
            './src/pages/departments/admin/Departments.jsx',
            './src/pages/reports/admin/Analytics.jsx'
          ],
          instructor: [
            './src/pages/dashboard/instructor/Dashboard.jsx',
            './src/pages/courses/instructor/Courses.jsx',
            './src/pages/users/instructor/Students.jsx'
          ],
          student: [
            './src/pages/dashboard/student/Dashboard.jsx',
            './src/pages/departments/student/Department.jsx',
            './src/pages/courses/student/DepartmentCourse.jsx'
          ]
        },
        // Optimize chunk naming
        chunkFileNames: (chunkInfo) => {
          const facadeModuleId = chunkInfo.facadeModuleId
            ? chunkInfo.facadeModuleId.split('/').pop().replace('.jsx', '')
            : 'chunk';
          return `js/${facadeModuleId}-[hash].js`;
        },
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name.split('.');
          const ext = info[info.length - 1];
          if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(ext)) {
            return `img/[name]-[hash][extname]`;
          }
          if (/css/i.test(ext)) {
            return `css/[name]-[hash][extname]`;
          }
          return `assets/[name]-[hash][extname]`;
        }
      }
    },
    // Optimize chunk size warnings
    chunkSizeWarningLimit: 1000
  },
  server: {
    // Hot reload optimization
    hmr: {
      overlay: false // Disable error overlay for better performance
    },
    fs: {
      // Allow importing shared/daily5mRouting.js from the repo root — there's no npm
      // workspace linking admin/ and server/, so Vite's default root-only fs.allow
      // would otherwise 403 this cross-package import in dev.
      allow: [path.resolve(__dirname, ".."), path.resolve(__dirname, "./src")]
    }
  },
  optimizeDeps: {
    // Pre-bundle heavy dependencies
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      '@reduxjs/toolkit',
      'react-redux',
      'axios',
      'lucide-react',
      'date-fns',
      '@emotion/react',
      '@emotion/styled',
      '@mui/material',
      '@mui/styled-engine',
      '@mui/system'
    ]
  }
});
