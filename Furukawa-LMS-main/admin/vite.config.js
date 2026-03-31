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
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: '10Sight LMS',
        short_name: '10Sight',
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
        suppressWarnings: true
      },
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
      }
    })
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
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
            './src/pages/Admin/Course.jsx',
            './src/pages/Admin/Instructor.jsx',
            './src/pages/Admin/Students.jsx',
            './src/pages/Admin/Departments.jsx',
            './src/pages/Admin/Analytics.jsx'
          ],
          instructor: [
            './src/pages/Instructor/Dashboard.jsx',
            './src/pages/Instructor/Courses.jsx',
            './src/pages/Instructor/Students.jsx'
          ],
          student: [
            './src/pages/Student/Dashboard.jsx',
            './src/pages/Student/Department.jsx',
            './src/pages/Student/DepartmentCourse.jsx'
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
