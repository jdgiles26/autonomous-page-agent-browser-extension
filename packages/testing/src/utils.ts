/**
 * Utility functions for the testing framework
 */

import type { ElementFingerprint, FlatDomTree, InteractiveElementDomNode } from './types'

const _global = globalThis as any

if (!_global.__PAGE_AGENT_TESTING_IDS__) {
	_global.__PAGE_AGENT_TESTING_IDS__ = []
}

const ids = _global.__PAGE_AGENT_TESTING_IDS__

/**
 * Generate a unique ID
 */
export function uid(): string {
	const id = Math.random().toString(36).substring(2, 11)
	if (ids.includes(id)) {
		return uid()
	}
	ids.push(id)
	return id
}

/**
 * Wait for a specified duration
 */
export async function waitFor(seconds: number): Promise<void> {
	await new Promise((resolve) => setTimeout(resolve, seconds * 1000))
}

/**
 * Truncate text to a maximum length
 */
export function truncate(text: string, maxLength: number): string {
	if (text.length > maxLength) {
		return text.substring(0, maxLength) + '...'
	}
	return text
}

/**
 * Calculate FNV-1a hash for string
 */
export function fnv1aHash(str: string): string {
	let hash = 0x811c9dc5
	for (let i = 0; i < str.length; i++) {
		hash ^= str.charCodeAt(i)
		hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24)
	}
	return (hash >>> 0).toString(16)
}

/**
 * Normalize text for comparison
 */
export function normalizeText(text: string): string {
	return text
		.toLowerCase()
		.replace(/\s+/g, ' ')
		.trim()
}

/**
 * Get element depth in DOM tree
 */
export function getElementDepth(element: HTMLElement): number {
	let depth = 0
	let current = element.parentElement
	while (current) {
		depth++
		current = current.parentElement
	}
	return depth
}

/**
 * Get sibling index of element
 */
export function getSiblingIndex(element: HTMLElement): number {
	if (!element.parentElement) return 0
	return Array.from(element.parentElement.children).indexOf(element)
}

/**
 * Generate class signature (sorted class names)
 */
export function generateClassSignature(className: string): string {
	return className
		.split(/\s+/)
		.filter(Boolean)
		.sort()
		.join(' ')
}

/**
 * Calculate position ratio relative to viewport
 */
export function calculatePositionRatio(element: HTMLElement): { x: number; y: number } {
	const rect = element.getBoundingClientRect()
	return {
		x: rect.left / window.innerWidth,
		y: rect.top / window.innerHeight,
	}
}

/**
 * Calculate size ratio relative to viewport
 */
export function calculateSizeRatio(element: HTMLElement): { width: number; height: number } {
	const rect = element.getBoundingClientRect()
	return {
		width: rect.width / window.innerWidth,
		height: rect.height / window.innerHeight,
	}
}

/**
 * Generate fingerprint for an interactive element
 */
export function generateElementFingerprint(
	element: HTMLElement,
	index: number,
	flatTree?: FlatDomTree
): ElementFingerprint {
	const rect = element.getBoundingClientRect()
	const style = window.getComputedStyle(element)
	const parent = element.parentElement

	return {
		// Structural
		tagName: element.tagName.toLowerCase(),
		depth: getElementDepth(element),
		siblingIndex: getSiblingIndex(element),
		parentTag: parent?.tagName.toLowerCase() || '',
		childCount: element.children.length,

		// Content
		textContent: normalizeText(element.textContent || ''),
		textHash: fnv1aHash(normalizeText(element.textContent || '')),
		textLength: (element.textContent || '').length,

		// Attributes
		attributes: getRelevantAttributes(element),
		classSignature: generateClassSignature(element.className),
		id: element.id || undefined,

		// Visual
		positionRatio: calculatePositionRatio(element),
		sizeRatio: calculateSizeRatio(element),

		// Semantic
		role: element.getAttribute('role'),
		ariaLabel: element.getAttribute('aria-label'),
		ariaDescription: element.getAttribute('aria-description'),
		testId: element.getAttribute('data-testid'),
		dataTestId: element.getAttribute('data-test-id'),
		dataCy: element.getAttribute('data-cy'),

		// Interactive properties
		isVisible: style.display !== 'none' && style.visibility !== 'hidden',
		isEnabled: !(element as any).disabled,
		isRequired: element.hasAttribute('required') || undefined,
		inputType: (element as HTMLInputElement).type,
	}
}

/**
 * Get relevant attributes for fingerprinting
 */
function getRelevantAttributes(element: HTMLElement): Record<string, string> {
	const relevantAttrs = [
		'type',
		'name',
		'placeholder',
		'title',
		'alt',
		'href',
		'src',
		'value',
		'checked',
		'selected',
		'disabled',
		'readonly',
		'required',
		'multiple',
		'pattern',
		'min',
		'max',
		'step',
	]

	const attrs: Record<string, string> = {}
	for (const attr of relevantAttrs) {
		const value = element.getAttribute(attr)
		if (value !== null) {
			attrs[attr] = value
		}
	}
	return attrs
}

/**
 * Calculate cosine similarity between two vectors
 */
export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
	let dotProduct = 0
	let normA = 0
	let normB = 0

	for (let i = 0; i < a.length; i++) {
		dotProduct += a[i] * b[i]
		normA += a[i] * a[i]
		normB += b[i] * b[i]
	}

	if (normA === 0 || normB === 0) return 0
	return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: any[]) => void>(
	fn: T,
	delay: number
): (...args: Parameters<T>) => void {
	let timeoutId: ReturnType<typeof setTimeout>
	return (...args: Parameters<T>) => {
		clearTimeout(timeoutId)
		timeoutId = setTimeout(() => fn(...args), delay)
	}
}

/**
 * Throttle function
 */
export function throttle<T extends (...args: any[]) => void>(
	fn: T,
	delay: number
): (...args: Parameters<T>) => void {
	let lastCall = 0
	return (...args: Parameters<T>) => {
		const now = Date.now()
		if (now - lastCall >= delay) {
			lastCall = now
			fn(...args)
		}
	}
}

/**
 * Deep clone an object
 */
export function deepClone<T>(obj: T): T {
	return JSON.parse(JSON.stringify(obj))
}

/**
 * Format duration in milliseconds to human readable string
 */
export function formatDuration(ms: number): string {
	if (ms < 1000) return `${ms}ms`
	if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
	const minutes = Math.floor(ms / 60000)
	const seconds = ((ms % 60000) / 1000).toFixed(1)
	return `${minutes}m ${seconds}s`
}

/**
 * Get text description of an element
 */
export function getElementDescription(element: HTMLElement): string {
	const parts: string[] = []

	// Tag name
	parts.push(element.tagName.toLowerCase())

	// Text content (truncated)
	const text = normalizeText(element.textContent || '')
	if (text) {
		parts.push(`"${truncate(text, 30)}"`)
	}

	// Aria label
	const ariaLabel = element.getAttribute('aria-label')
	if (ariaLabel) {
		parts.push(`[aria-label="${ariaLabel}"]`)
	}

	// Placeholder for inputs
	if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
		if (element.placeholder) {
			parts.push(`[placeholder="${element.placeholder}"]`)
		}
	}

	return parts.join(' ')
}

/**
 * Check if two fingerprints match (for self-healing)
 */
export function fingerprintsMatch(
	a: ElementFingerprint,
	b: ElementFingerprint,
	threshold = 0.7
): { matches: boolean; score: number; reasons: string[] } {
	const reasons: string[] = []
	let score = 0
	let totalWeight = 0

	// Text content (high weight)
	if (a.textHash && b.textHash) {
		totalWeight += 3
		if (a.textHash === b.textHash) {
			score += 3
			reasons.push('exact text match')
		} else if (a.textContent && b.textContent) {
			const similarity = calculateTextSimilarity(a.textContent, b.textContent)
			score += 3 * similarity
			if (similarity > 0.8) reasons.push('high text similarity')
		}
	}

	// Tag name (medium weight)
	totalWeight += 2
	if (a.tagName === b.tagName) {
		score += 2
		reasons.push('same tag')
	}

	// Attributes (medium weight)
	totalWeight += 2
	const attrScore = compareAttributes(a.attributes, b.attributes)
	score += 2 * attrScore
	if (attrScore > 0.5) reasons.push('similar attributes')

	// Semantic markers (high weight)
	totalWeight += 3
	if (a.testId && b.testId && a.testId === b.testId) {
		score += 3
		reasons.push('same test ID')
	}
	if (a.dataCy && b.dataCy && a.dataCy === b.dataCy) {
		score += 3
		reasons.push('same data-cy')
	}
	if (a.ariaLabel && b.ariaLabel && a.ariaLabel === b.ariaLabel) {
		score += 2
		reasons.push('same aria-label')
	}

	// Position (low weight, only if similar)
	totalWeight += 1
	const positionDiff = Math.abs(a.positionRatio.x - b.positionRatio.x) + Math.abs(a.positionRatio.y - b.positionRatio.y)
	if (positionDiff < 0.1) {
		score += 1
		reasons.push('similar position')
	}

	const normalizedScore = score / totalWeight
	return {
		matches: normalizedScore >= threshold,
		score: normalizedScore,
		reasons,
	}
}

/**
 * Calculate text similarity (0-1)
 */
function calculateTextSimilarity(a: string, b: string): number {
	if (a === b) return 1
	if (!a || !b) return 0

	const longer = a.length > b.length ? a : b
	const shorter = a.length > b.length ? b : a

	if (longer.length === 0) return 1

	// Simple Levenshtein-based similarity
	const distance = levenshteinDistance(a, b)
	return (longer.length - distance) / longer.length
}

/**
 * Calculate Levenshtein distance
 */
function levenshteinDistance(a: string, b: string): number {
	const matrix: number[][] = []

	for (let i = 0; i <= b.length; i++) {
		matrix[i] = [i]
	}

	for (let j = 0; j <= a.length; j++) {
		matrix[0][j] = j
	}

	for (let i = 1; i <= b.length; i++) {
		for (let j = 1; j <= a.length; j++) {
			if (b.charAt(i - 1) === a.charAt(j - 1)) {
				matrix[i][j] = matrix[i - 1][j - 1]
			} else {
				matrix[i][j] = Math.min(
					matrix[i - 1][j - 1] + 1,
					matrix[i][j - 1] + 1,
					matrix[i - 1][j] + 1
				)
			}
		}
	}

	return matrix[b.length][a.length]
}

/**
 * Compare attributes similarity (0-1)
 */
function compareAttributes(a: Record<string, string>, b: Record<string, string>): number {
	const keysA = Object.keys(a)
	const keysB = Object.keys(b)

	if (keysA.length === 0 && keysB.length === 0) return 1
	if (keysA.length === 0 || keysB.length === 0) return 0

	let matches = 0
	for (const key of keysA) {
		if (key in b && a[key] === b[key]) {
			matches++
		}
	}

	return matches / Math.max(keysA.length, keysB.length)
}
