import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
    plugins: [react()],
    build: {
        // Output directory
        outDir: 'dist',
        // Clean the output directory before building
        emptyOutDir: true,
        rollupOptions: {
            // Point directly to the main TSX file, bypassing index.html
            input: 'src/main.tsx',
            output: {
                // Force the JS filename
                entryFileNames: 'assets/comfy-ui-gallery.js',
                // Force chunk filenames (if code splitting happens)
                chunkFileNames: 'assets/comfy-ui-gallery-[name].js',
                // Force CSS and image filenames
                assetFileNames: 'assets/comfy-ui-gallery.[ext]',
            },
        },
    },
})
