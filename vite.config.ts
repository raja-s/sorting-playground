import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
	plugins: [react()],
	base: '/sorting-playground/',
	worker: {
		format: 'es'
	},
	build: {
		target: 'esnext',
		rollupOptions: {
			external: [
				'/coi-serviceworker.min.js',
				/^node:.*/
			]
		}
	}
})
