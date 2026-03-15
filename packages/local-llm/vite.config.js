// @ts-check
import { dirname, resolve } from 'path'
import dts from 'unplugin-dts/vite'
import { fileURLToPath } from 'url'
import { defineConfig } from 'vite'

const __dirname = dirname(fileURLToPath(import.meta.url))

console.log('📦 Building @page-agent/local-llm')

export default defineConfig({
	clearScreen: false,
	plugins: [dts({ tsconfigPath: './tsconfig.dts.json', bundleTypes: true })],
	publicDir: false,
	esbuild: {
		keepNames: true,
	},
	build: {
		lib: {
			entry: resolve(__dirname, 'src/index.ts'),
			name: 'PageAgentLocalLLM',
			fileName: 'page-agent-local-llm',
			formats: ['es'],
		},
		outDir: resolve(__dirname, 'dist', 'lib'),
		rollupOptions: {
			external: ['@page-agent/llms', 'idb', 'comlink', 'zod', 'zod/v4'],
		},
		minify: false,
		sourcemap: true,
	},
	define: {
		'process.env.NODE_ENV': '"production"',
	},
})
