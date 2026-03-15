/**
 * Element Embeddings - Natural language element search using semantic similarity
 * Feature 2: Semantic Element Search
 * 
 * Note: This is a lightweight implementation that doesn't require TensorFlow.js
 * by default. For production use with higher accuracy, install @tensorflow/tfjs
 * and use the generateEmbedding method.
 */

import type { FlatDomTree, InteractiveElementDomNode } from '@page-agent/page-controller'

import type { ElementFingerprint } from './types'
import { generateElementFingerprint, normalizeText, uid } from './utils'

export interface EmbeddingConfig {
	useTFJS: boolean
	modelUrl?: string
	vectorSize: number
	cacheSize: number
	threshold: number
}

export const defaultEmbeddingConfig: EmbeddingConfig = {
	useTFJS: false,
	vectorSize: 128,
	cacheSize: 500,
	threshold: 0.6,
}

/**
 * Simple word embedding using a basic bag-of-words approach
 * This works without TensorFlow for basic semantic search
 */
export class ElementEmbeddings extends EventTarget {
	private config: EmbeddingConfig
	private elementCache = new Map<number, Float32Array>()
	private descriptionCache = new Map<string, Float32Array>()
	private vocabulary = new Map<string, number>()
	private tfModule: typeof import('@tensorflow/tfjs') | null = null
	private model: any = null
	private isInitialized = false

	constructor(config: Partial<EmbeddingConfig> = {}) {
		super()
		this.config = { ...defaultEmbeddingConfig, ...config }
	}

	/**
	 * Initialize the embedding system
	 */
	async initialize(): Promise<void> {
		if (this.isInitialized) return

		if (this.config.useTFJS) {
			try {
				this.tfModule = await import('@tensorflow/tfjs')
				// Use universal sentence encoder or similar lightweight model
				console.log('[ElementEmbeddings] TensorFlow.js loaded')
			} catch (e) {
				console.warn('[ElementEmbeddings] TensorFlow.js not available, using fallback')
				this.config.useTFJS = false
			}
		}

		this.isInitialized = true
	}

	/**
	 * Generate embedding for a natural language description
	 */
	async embedDescription(description: string): Promise<Float32Array> {
		if (!this.isInitialized) {
			await this.initialize()
		}

		// Check cache
		const cached = this.descriptionCache.get(description)
		if (cached) return cached

		let embedding: Float32Array

		if (this.config.useTFJS && this.tfModule) {
			embedding = await this.generateTFJSEmbedding(description)
		} else {
			embedding = this.generateFallbackEmbedding(description)
		}

		// Cache result
		this.descriptionCache.set(description, embedding)
		this.trimCache(this.descriptionCache, this.config.cacheSize)

		return embedding
	}

	/**
	 * Generate embeddings for all interactive elements on page
	 */
	async embedPageElements(flatTree: FlatDomTree): Promise<Map<number, Float32Array>> {
		if (!this.isInitialized) {
			await this.initialize()
		}

		const embeddings = new Map<number, Float32Array>()

		for (const node of Object.values(flatTree.map)) {
			if (node.isInteractive && typeof node.highlightIndex === 'number') {
				const embedding = await this.embedElement(node as InteractiveElementDomNode)
				embeddings.set(node.highlightIndex, embedding)
			}
		}

		return embeddings
	}

	/**
	 * Generate embedding for a single element
	 */
	async embedElement(node: InteractiveElementDomNode): Promise<Float32Array> {
		if (!node.ref) {
			return new Float32Array(this.config.vectorSize)
		}

		// Check cache
		const cached = this.elementCache.get(node.highlightIndex)
		if (cached) return cached

		// Build description from element
		const description = this.buildElementDescription(node)
		const embedding = await this.embedDescription(description)

		// Cache result
		this.elementCache.set(node.highlightIndex, embedding)
		this.trimCache(this.elementCache, this.config.cacheSize)

		return embedding
	}

	/**
	 * Find element by natural language description
	 */
	async findElement(
		query: string,
		flatTree: FlatDomTree,
		threshold = this.config.threshold
	): Promise<{ index: number; confidence: number; element: InteractiveElementDomNode } | null> {
		const queryEmbedding = await this.embedDescription(query)
		const elementEmbeddings = await this.embedPageElements(flatTree)

		let bestMatch: { index: number; confidence: number; element: InteractiveElementDomNode } | null =
			null

		for (const [index, embedding] of elementEmbeddings.entries()) {
			const similarity = this.cosineSimilarity(queryEmbedding, embedding)

			if (similarity > (bestMatch?.confidence || 0) && similarity >= threshold) {
				const node = this.findNodeByIndex(index, flatTree)
				if (node) {
					bestMatch = { index, confidence: similarity, element: node }
				}
			}
		}

		return bestMatch
	}

	/**
	 * Find multiple matching elements ranked by confidence
	 */
	async findElements(
		query: string,
		flatTree: FlatDomTree,
		threshold = this.config.threshold,
		maxResults = 5
	): Promise<Array<{ index: number; confidence: number; element: InteractiveElementDomNode }>> {
		const queryEmbedding = await this.embedDescription(query)
		const elementEmbeddings = await this.embedPageElements(flatTree)

		const matches: Array<{ index: number; confidence: number; element: InteractiveElementDomNode }> =
			[]

		for (const [index, embedding] of elementEmbeddings.entries()) {
			const similarity = this.cosineSimilarity(queryEmbedding, embedding)

			if (similarity >= threshold) {
				const node = this.findNodeByIndex(index, flatTree)
				if (node) {
					matches.push({ index, confidence: similarity, element: node })
				}
			}
		}

		// Sort by confidence and limit results
		return matches.sort((a, b) => b.confidence - a.confidence).slice(0, maxResults)
	}

	/**
	 * Build a natural language description from an element
	 */
	private buildElementDescription(node: InteractiveElementDomNode): string {
		const parts: string[] = []
		const element = node.ref

		if (!element) return ''

		// Tag name
		parts.push(element.tagName.toLowerCase())

		// Text content
		const text = normalizeText(element.textContent || '')
		if (text) {
			parts.push(`text: "${text}"`)
		}

		// Aria label
		const ariaLabel = element.getAttribute('aria-label')
		if (ariaLabel) {
			parts.push(`label: "${ariaLabel}"`)
		}

		// Placeholder
		if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
			if (element.placeholder) {
				parts.push(`placeholder: "${element.placeholder}"`)
			}
			if (element.type) {
				parts.push(`type: ${element.type}`)
			}
		}

		// Title
		const title = element.getAttribute('title')
		if (title) {
			parts.push(`title: "${title}"`)
		}

		// Alt text for images
		if (element instanceof HTMLImageElement) {
			if (element.alt) {
				parts.push(`alt: "${element.alt}"`)
			}
		}

		// Role
		const role = element.getAttribute('role')
		if (role) {
			parts.push(`role: ${role}`)
		}

		// Class names (semantic ones)
		const semanticClasses = Array.from(element.classList)
			.filter((c) =>
				['btn', 'button', 'input', 'field', 'menu', 'nav', 'header', 'footer', 'card'].some(
					(prefix) => c.toLowerCase().includes(prefix)
				)
			)
			.slice(0, 3)

		if (semanticClasses.length > 0) {
			parts.push(`classes: ${semanticClasses.join(' ')}`)
		}

		return parts.join(' ')
	}

	/**
	 * Generate embedding using TensorFlow.js
	 */
	private async generateTFJSEmbedding(text: string): Promise<Float32Array> {
		// This would use a proper model like Universal Sentence Encoder
		// For now, fall back to simple embedding
		return this.generateFallbackEmbedding(text)
	}

	/**
	 * Generate fallback embedding using bag-of-words
	 */
	private generateFallbackEmbedding(text: string): Float32Array {
		const normalized = normalizeText(text)
		const words = normalized.split(/\s+/).filter(Boolean)

		// Build vocabulary dynamically
		for (const word of words) {
			if (!this.vocabulary.has(word)) {
				this.vocabulary.set(word, this.vocabulary.size)
			}
		}

		// Create bag-of-words vector with some semantic weighting
		const vector = new Float32Array(this.config.vectorSize)

		for (const word of words) {
			const index = this.vocabulary.get(word)
			if (index !== undefined && index < this.config.vectorSize) {
				// TF-IDF-like weighting
				vector[index] += 1
			}
		}

		// Add semantic features
		this.addSemanticFeatures(vector, text, words)

		// Normalize vector
		return this.normalizeVector(vector)
	}

	/**
	 * Add semantic features to vector
	 */
	private addSemanticFeatures(
		vector: Float32Array,
		text: string,
		words: string[]
	): void {
		const featureStart = Math.floor(this.config.vectorSize * 0.7)

		// Feature: contains action words
		const actionWords = ['click', 'submit', 'save', 'delete', 'edit', 'add', 'remove', 'search']
		vector[featureStart] = actionWords.some((w) => words.includes(w)) ? 1 : 0

		// Feature: contains input-related words
		const inputWords = ['input', 'field', 'text', 'email', 'password', 'search', 'form']
		vector[featureStart + 1] = inputWords.some((w) => words.includes(w)) ? 1 : 0

		// Feature: contains navigation words
		const navWords = ['menu', 'nav', 'link', 'home', 'back', 'next', 'previous']
		vector[featureStart + 2] = navWords.some((w) => words.includes(w)) ? 1 : 0

		// Feature: text length category
		vector[featureStart + 3] = text.length < 20 ? 1 : text.length < 50 ? 0.5 : 0

		// Feature: word count
		vector[featureStart + 4] = Math.min(words.length / 10, 1)

		// Feature: has numbers
		vector[featureStart + 5] = /\d/.test(text) ? 1 : 0

		// Feature: is button-like
		const buttonWords = ['button', 'btn', 'submit', 'click', 'save', 'cancel', 'ok']
		vector[featureStart + 6] = buttonWords.some((w) => words.includes(w)) ? 1 : 0

		// Feature: is form-like
		const formWords = ['form', 'input', 'field', 'select', 'checkbox', 'radio']
		vector[featureStart + 7] = formWords.some((w) => words.includes(w)) ? 1 : 0
	}

	/**
	 * Normalize vector to unit length
	 */
	private normalizeVector(vector: Float32Array): Float32Array {
		let sum = 0
		for (const v of vector) {
			sum += v * v
		}
		const magnitude = Math.sqrt(sum)

		if (magnitude === 0) return vector

		const normalized = new Float32Array(vector.length)
		for (let i = 0; i < vector.length; i++) {
			normalized[i] = vector[i] / magnitude
		}

		return normalized
	}

	/**
	 * Calculate cosine similarity between two vectors
	 */
	private cosineSimilarity(a: Float32Array, b: Float32Array): number {
		let dotProduct = 0
		for (let i = 0; i < Math.min(a.length, b.length); i++) {
			dotProduct += a[i] * b[i]
		}
		return dotProduct // Vectors are already normalized
	}

	/**
	 * Find node by index in flat tree
	 */
	private findNodeByIndex(index: number, flatTree: FlatDomTree): InteractiveElementDomNode | null {
		for (const node of Object.values(flatTree.map)) {
			if (node.isInteractive && node.highlightIndex === index) {
				return node as InteractiveElementDomNode
			}
		}
		return null
	}

	/**
	 * Trim cache to maximum size
	 */
	private trimCache(cache: Map<any, any>, maxSize: number): void {
		if (cache.size > maxSize) {
			const entriesToDelete = cache.size - maxSize
			const keys = Array.from(cache.keys()).slice(0, entriesToDelete)
			for (const key of keys) {
				cache.delete(key)
			}
		}
	}

	/**
	 * Clear all caches
	 */
	clearCache(): void {
		this.elementCache.clear()
		this.descriptionCache.clear()
		this.vocabulary.clear()
	}

	/**
	 * Get cache statistics
	 */
	getStats(): {
		elementCacheSize: number
		descriptionCacheSize: number
		vocabularySize: number
	} {
		return {
			elementCacheSize: this.elementCache.size,
			descriptionCacheSize: this.descriptionCache.size,
			vocabularySize: this.vocabulary.size,
		}
	}
}
