import { resolve } from 'path'

import { defineConfig } from 'vite'
import dts from 'unplugin-dts/vite'

export default defineConfig({
	build: {
		lib: {
			entry: resolve(__dirname, 'src/index.ts'),
			name: 'PageAgentTesting',
			fileName: (format) => `page-agent-testing.${format}.js`,
			formats: ['es'],
		},
		rollupOptions: {
			external: [
				'@page-agent/core',
				'@page-agent/page-controller',
				'@page-agent/ui',
				'fuse.js',
				'pixelmatch',
				'pngjs',
				'zod',
				'@tensorflow/tfjs',
			],
			output: {
				globals: {
					'@page-agent/core': 'PageAgentCore',
					'@page-agent/page-controller': 'PageController',
					'@page-agent/ui': 'PageAgentUI',
				},
			},
		},
		outDir: 'dist/esm',
		emptyOutDir: true,
	},
	plugins: [
		dts({
			outDir: 'dist/esm',
		}),
	],
})
