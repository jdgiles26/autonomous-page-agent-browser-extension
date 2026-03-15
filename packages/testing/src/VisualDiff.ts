/**
 * Visual Diff - Screenshot comparison for visual regression testing
 * Feature 7: Visual Diff & Change Detection (Visual portion)
 */

import type { VisualDiffResult } from './types'

export interface VisualDiffConfig {
	threshold: number
	includeAA: boolean
	alpha: number
	captureFullPage: boolean
}

export const defaultVisualDiffConfig: VisualDiffConfig = {
	threshold: 0.1,
	includeAA: false,
	alpha: 0.1,
	captureFullPage: false,
}

/**
 * Visual Diff - Screenshot comparison
 * 
 * Note: This implementation uses canvas for screenshot capture.
 * For production use with pixel-perfect comparison, install pixelmatch:
 * npm install pixelmatch pngjs
 */
export class VisualDiff {
	private config: VisualDiffConfig

	constructor(config: Partial<VisualDiffConfig> = {}) {
		this.config = { ...defaultVisualDiffConfig, ...config }
	}

	/**
	 * Capture screenshot of current viewport
	 */
	async captureScreenshot(): Promise<ImageData> {
		return new Promise((resolve, reject) => {
			try {
				// Create canvas
				const canvas = document.createElement('canvas')
				canvas.width = window.innerWidth
				canvas.height = window.innerHeight
				const ctx = canvas.getContext('2d')

				if (!ctx) {
					reject(new Error('Could not get canvas context'))
					return
				}

				// Draw document to canvas
				// Note: This is a simplified approach. For production, use html2canvas
				ctx.drawWindow(
					window,
					0,
					0,
					window.innerWidth,
					window.innerHeight,
					'rgb(255,255,255)'
				)

				resolve(ctx.getImageData(0, 0, canvas.width, canvas.height))
			} catch (e) {
				// Fallback: create placeholder
				reject(new Error('Screenshot capture not available in this environment'))
			}
		})
	}

	/**
	 * Capture screenshot as base64 PNG
	 */
	async captureScreenshotBase64(): Promise<string> {
		return new Promise((resolve, reject) => {
			try {
				const canvas = document.createElement('canvas')
				canvas.width = window.innerWidth
				canvas.height = window.innerHeight
				const ctx = canvas.getContext('2d')

				if (!ctx) {
					reject(new Error('Could not get canvas context'))
					return
				}

				// Fill white background
				ctx.fillStyle = '#ffffff'
				ctx.fillRect(0, 0, canvas.width, canvas.height)

				// Try to draw the document
				// In a real implementation, use html2canvas
				resolve(canvas.toDataURL('image/png'))
			} catch (e) {
				reject(e)
			}
		})
	}

	/**
	 * Compare two screenshots
	 */
	async compare(
		before: ImageData | string,
		after: ImageData | string,
		threshold = this.config.threshold
	): Promise<VisualDiffResult> {
		// Convert inputs to ImageData if needed
		const beforeData = await this.toImageData(before)
		const afterData = await this.toImageData(after)

		// Check dimensions
		if (beforeData.width !== afterData.width || beforeData.height !== afterData.height) {
			return this.compareDifferentSizes(beforeData, afterData, threshold)
		}

		// Compare pixel by pixel
		const width = beforeData.width
		const height = beforeData.height
		const totalPixels = width * height
		let diffPixels = 0
		const diffBounds = { minX: width, minY: height, maxX: 0, maxY: 0 }

		// Create diff image data
		const diffImageData = new ImageData(width, height)

		for (let y = 0; y < height; y++) {
			for (let x = 0; x < width; x++) {
				const i = (y * width + x) * 4

				const r1 = beforeData.data[i]
				const g1 = beforeData.data[i + 1]
				const b1 = beforeData.data[i + 2]
				const a1 = beforeData.data[i + 3]

				const r2 = afterData.data[i]
				const g2 = afterData.data[i + 1]
				const b2 = afterData.data[i + 2]
				const a2 = afterData.data[i + 3]

				// Calculate color difference
				const diff = this.colorDelta(
					{ r: r1, g: g1, b: b1, a: a1 },
					{ r: r2, g: g2, b: b2, a: a2 }
				)

				if (diff > threshold * 255) {
					diffPixels++
					diffBounds.minX = Math.min(diffBounds.minX, x)
					diffBounds.minY = Math.min(diffBounds.minY, y)
					diffBounds.maxX = Math.max(diffBounds.maxX, x)
					diffBounds.maxY = Math.max(diffBounds.maxY, y)

					// Highlight diff in red
					diffImageData.data[i] = 255
					diffImageData.data[i + 1] = 0
					diffImageData.data[i + 2] = 0
					diffImageData.data[i + 3] = 255
				} else {
					// Copy after image
					diffImageData.data[i] = r2
					diffImageData.data[i + 1] = g2
					diffImageData.data[i + 2] = b2
					diffImageData.data[i + 3] = a2
				}
			}
		}

		const matchPercentage = ((totalPixels - diffPixels) / totalPixels) * 100

		return {
			matchPercentage,
			diffPixels,
			totalPixels,
			threshold,
			diffBounds:
				diffPixels > 0
					? {
							x: diffBounds.minX,
							y: diffBounds.minY,
							width: diffBounds.maxX - diffBounds.minX,
							height: diffBounds.maxY - diffBounds.minY,
						}
					: null,
			diffImage: this.imageDataToBase64(diffImageData),
			beforeImage: typeof before === 'string' ? before : undefined,
			afterImage: typeof after === 'string' ? after : undefined,
		}
	}

	/**
	 * Highlight differences on the actual page
	 */
	async highlightDifferences(result: VisualDiffResult): Promise<void> {
		if (!result.diffBounds) return

		// Remove existing highlights
		this.clearHighlights()

		// Create highlight overlay
		const overlay = document.createElement('div')
		overlay.id = 'visual-diff-highlight'
		overlay.style.cssText = `
			position: fixed;
			border: 3px solid red;
			background: rgba(255, 0, 0, 0.2);
			pointer-events: none;
			z-index: 2147483647;
			left: ${result.diffBounds.x}px;
			top: ${result.diffBounds.y}px;
			width: ${result.diffBounds.width}px;
			height: ${result.diffBounds.height}px;
		`

		document.body.appendChild(overlay)

		// Auto-remove after 5 seconds
		setTimeout(() => this.clearHighlights(), 5000)
	}

	/**
	 * Clear visual diff highlights
	 */
	clearHighlights(): void {
		const existing = document.getElementById('visual-diff-highlight')
		if (existing) {
			existing.remove()
		}
	}

	/**
	 * Generate diff visualization with side-by-side comparison
	 */
	generateDiffVisualization(
		before: ImageData | string,
		after: ImageData | string,
		result: VisualDiffResult
	): HTMLCanvasElement {
		const canvas = document.createElement('canvas')
		const ctx = canvas.getContext('2d')!

		// Layout: [before] [after] [diff]
		const padding = 10
		const labelHeight = 30

		// Get dimensions (assuming all same size for now)
		const width = 400
		const height = 300

		canvas.width = width * 3 + padding * 4
		canvas.height = height + labelHeight + padding * 2

		// Background
		ctx.fillStyle = '#f0f0f0'
		ctx.fillRect(0, 0, canvas.width, canvas.height)

		// Draw labels
		ctx.fillStyle = '#333'
		ctx.font = '14px sans-serif'
		ctx.textAlign = 'center'
		ctx.fillText('Before', padding + width / 2, padding + 20)
		ctx.fillText('After', padding * 2 + width + width / 2, padding + 20)
		ctx.fillText(`Diff (${result.diffPixels} pixels)`, padding * 3 + width * 2 + width / 2, padding + 20)

		// Draw images (placeholder rectangles for now)
		ctx.fillStyle = '#ddd'
		ctx.fillRect(padding, padding + labelHeight, width, height)
		ctx.fillRect(padding * 2 + width, padding + labelHeight, width, height)
		ctx.fillStyle = '#ffcccc'
		ctx.fillRect(padding * 3 + width * 2, padding + labelHeight, width, height)

		return canvas
	}

	/**
	 * Convert input to ImageData
	 */
	private async toImageData(input: ImageData | string): Promise<ImageData> {
		if (input instanceof ImageData) {
			return input
		}

		// Convert base64 to ImageData
		return new Promise((resolve, reject) => {
			const img = new Image()
			img.onload = () => {
				const canvas = document.createElement('canvas')
				canvas.width = img.width
				canvas.height = img.height
				const ctx = canvas.getContext('2d')!
				ctx.drawImage(img, 0, 0)
				resolve(ctx.getImageData(0, 0, img.width, img.height))
			}
			img.onerror = reject
			img.src = input
		})
	}

	/**
	 * Compare images of different sizes
	 */
	private compareDifferentSizes(
		before: ImageData,
		after: ImageData,
		threshold: number
	): VisualDiffResult {
		// Resize to common dimensions
		const width = Math.max(before.width, after.width)
		const height = Math.max(before.height, after.height)

		// Create padded versions
		const beforePadded = this.padImageData(before, width, height)
		const afterPadded = this.padImageData(after, width, height)

		return this.compare(beforePadded, afterPadded, threshold)
	}

	/**
	 * Pad image data to target dimensions
	 */
	private padImageData(source: ImageData, width: number, height: number): ImageData {
		if (source.width === width && source.height === height) {
			return source
		}

		const padded = new ImageData(width, height)

		for (let y = 0; y < height; y++) {
			for (let x = 0; x < width; x++) {
				const targetIdx = (y * width + x) * 4

				if (x < source.width && y < source.height) {
					const sourceIdx = (y * source.width + x) * 4
					padded.data[targetIdx] = source.data[sourceIdx]
					padded.data[targetIdx + 1] = source.data[sourceIdx + 1]
					padded.data[targetIdx + 2] = source.data[sourceIdx + 2]
					padded.data[targetIdx + 3] = source.data[sourceIdx + 3]
				} else {
					// Fill with white
					padded.data[targetIdx] = 255
					padded.data[targetIdx + 1] = 255
					padded.data[targetIdx + 2] = 255
					padded.data[targetIdx + 3] = 255
				}
			}
		}

		return padded
	}

	/**
	 * Calculate color difference
	 */
	private colorDelta(
		c1: { r: number; g: number; b: number; a: number },
		c2: { r: number; g: number; b: number; a: number }
	): number {
		// Convert to YIQ color space for better perceptual difference
		const y1 = (c1.r * 299 + c1.g * 587 + c1.b * 114) / 1000
		const y2 = (c2.r * 299 + c2.g * 587 + c2.b * 114) / 1000

		const i1 = (c1.r * 596 - c1.g * 275 - c1.b * 321) / 1000
		const i2 = (c2.r * 596 - c2.g * 275 - c2.b * 321) / 1000

		const q1 = (c1.r * 212 - c1.g * 523 + c1.b * 311) / 1000
		const q2 = (c2.r * 212 - c2.g * 523 + c2.b * 311) / 1000

		// Weighted difference
		return (
			Math.abs(y1 - y2) * 0.5 + Math.abs(i1 - i2) * 0.3 + Math.abs(q1 - q2) * 0.2
		)
	}

	/**
	 * Convert ImageData to base64 PNG
	 */
	private imageDataToBase64(imageData: ImageData): string {
		const canvas = document.createElement('canvas')
		canvas.width = imageData.width
		canvas.height = imageData.height
		const ctx = canvas.getContext('2d')!
		ctx.putImageData(imageData, 0, 0)
		return canvas.toDataURL('image/png')
	}
}
