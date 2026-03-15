/**
 * Self-Healing Selector - Element fingerprinting for resilient targeting
 * Feature 4: Self-Healing Selectors
 */

import type { FlatDomTree, InteractiveElementDomNode } from '@page-agent/page-controller'

import type { ElementFingerprint, HealResult } from './types'
import {
	fingerprintsMatch,
	generateElementFingerprint,
	normalizeText,
	uid,
} from './utils'

export interface SelfHealingConfig {
	enabled: boolean
	threshold: number
	maxAttempts: number
	cacheSize: number
	useFuzzyMatching: boolean
}

export const defaultSelfHealingConfig: SelfHealingConfig = {
	enabled: true,
	threshold: 0.7,
	maxAttempts: 3,
	cacheSize: 100,
	useFuzzyMatching: true,
}

/**
 * Self-Healing Selector - Recovers from DOM changes
 */
export class SelfHealingSelector {
	private config: SelfHealingConfig
	private fingerprintCache = new Map<number, ElementFingerprint>()
	private history: Array<{ index: number; fingerprint: ElementFingerprint; timestamp: number }> =
		[]
	private healingStats = {
		attempts: 0,
		successes: 0,
		failures: 0,
		byMethod: {} as Record<string, number>,
	}

	constructor(config: Partial<SelfHealingConfig> = {}) {
		this.config = { ...defaultSelfHealingConfig, ...config }
	}

	/**
	 * Generate and cache fingerprint for an element
	 */
	cacheFingerprint(index: number, flatTree: FlatDomTree): ElementFingerprint | null {
		const node = this.findNodeByIndex(index, flatTree)
		if (!node || !node.ref) return null

		const fingerprint = generateElementFingerprint(node.ref, index)
		this.fingerprintCache.set(index, fingerprint)

		// Add to history
		this.history.push({
			index,
			fingerprint,
			timestamp: Date.now(),
		})

		// Trim history if needed
		if (this.history.length > this.config.cacheSize) {
			this.history = this.history.slice(-this.config.cacheSize)
		}

		return fingerprint
	}

	/**
	 * Attempt to heal a selector that failed
	 */
	async healSelector(
		failedIndex: number,
		flatTree: FlatDomTree
	): Promise<HealResult | null> {
		if (!this.config.enabled) return null

		this.healingStats.attempts++

		const originalFingerprint = this.fingerprintCache.get(failedIndex)
		if (!originalFingerprint) {
			console.warn(`[SelfHealing] No cached fingerprint for index ${failedIndex}`)
			return null
		}

		// Get all current interactive elements
		const candidates = this.getAllInteractiveElements(flatTree)

		// Try different matching strategies in order of reliability
		const strategies: Array<{
			name: string
			match: () => { index: number; score: number } | null
		}> = [
			{ name: 'testId', match: () => this.matchByTestId(originalFingerprint, candidates) },
			{ name: 'semantic', match: () => this.matchBySemantic(originalFingerprint, candidates) },
			{ name: 'text', match: () => this.matchByText(originalFingerprint, candidates) },
			{ name: 'attributes', match: () => this.matchByAttributes(originalFingerprint, candidates) },
			{ name: 'structure', match: () => this.matchByStructure(originalFingerprint, candidates) },
			{ name: 'position', match: () => this.matchByPosition(originalFingerprint, candidates) },
		]

		for (const strategy of strategies) {
			const match = strategy.match()
			if (match && match.score >= this.config.threshold) {
				this.healingStats.successes++
				this.healingStats.byMethod[strategy.name] =
					(this.healingStats.byMethod[strategy.name] || 0) + 1

				console.log(
					`[SelfHealing] Healed ${failedIndex} -> ${match.index} using ${strategy.name} (${(match.score * 100).toFixed(1)}% confidence)`
				)

				return {
					index: match.index,
					confidence: match.score,
					method: strategy.name as HealResult['method'],
					fingerprint: originalFingerprint,
				}
			}
		}

		// Try fuzzy matching as last resort
		if (this.config.useFuzzyMatching) {
			const fuzzyMatch = this.fuzzyMatch(originalFingerprint, candidates)
			if (fuzzyMatch && fuzzyMatch.score >= this.config.threshold * 0.9) {
				this.healingStats.successes++
				this.healingStats.byMethod['fuzzy'] = (this.healingStats.byMethod['fuzzy'] || 0) + 1

				console.log(
					`[SelfHealing] Healed ${failedIndex} -> ${fuzzyMatch.index} using fuzzy matching (${(fuzzyMatch.score * 100).toFixed(1)}% confidence)`
				)

				return {
					index: fuzzyMatch.index,
					confidence: fuzzyMatch.score,
					method: 'fuzzy',
					fingerprint: originalFingerprint,
				}
			}
		}

		this.healingStats.failures++
		console.warn(`[SelfHealing] Failed to heal selector ${failedIndex}`)
		return null
	}

	/**
	 * Match by test ID (highest confidence)
	 */
	private matchByTestId(
		fingerprint: ElementFingerprint,
		candidates: Array<{ index: number; node: InteractiveElementDomNode; fingerprint: ElementFingerprint }>
	): { index: number; score: number } | null {
		if (!fingerprint.testId && !fingerprint.dataTestId && !fingerprint.dataCy) return null

		for (const candidate of candidates) {
			const fp = candidate.fingerprint
			if (fingerprint.testId && fp.testId === fingerprint.testId) {
				return { index: candidate.index, score: 0.99 }
			}
			if (fingerprint.dataTestId && fp.dataTestId === fingerprint.dataTestId) {
				return { index: candidate.index, score: 0.99 }
			}
			if (fingerprint.dataCy && fp.dataCy === fingerprint.dataCy) {
				return { index: candidate.index, score: 0.99 }
			}
		}

		return null
	}

	/**
	 * Match by semantic markers (aria-label, role)
	 */
	private matchBySemantic(
		fingerprint: ElementFingerprint,
		candidates: Array<{ index: number; node: InteractiveElementDomNode; fingerprint: ElementFingerprint }>
	): { index: number; score: number } | null {
		if (!fingerprint.ariaLabel && !fingerprint.role) return null

		let bestMatch: { index: number; score: number } | null = null

		for (const candidate of candidates) {
			const fp = candidate.fingerprint
			let score = 0

			if (fingerprint.ariaLabel && fp.ariaLabel === fingerprint.ariaLabel) {
				score += 0.5
			}
			if (fingerprint.role && fp.role === fingerprint.role) {
				score += 0.3
			}
			if (fingerprint.ariaDescription && fp.ariaDescription === fingerprint.ariaDescription) {
				score += 0.2
			}

			if (score > (bestMatch?.score || 0)) {
				bestMatch = { index: candidate.index, score }
			}
		}

		return bestMatch
	}

	/**
	 * Match by text content
	 */
	private matchByText(
		fingerprint: ElementFingerprint,
		candidates: Array<{ index: number; node: InteractiveElementDomNode; fingerprint: ElementFingerprint }>
	): { index: number; score: number } | null {
		if (!fingerprint.textContent) return null

		let bestMatch: { index: number; score: number } | null = null

		for (const candidate of candidates) {
			const fp = candidate.fingerprint

			if (fingerprint.textHash && fp.textHash === fingerprint.textHash) {
				return { index: candidate.index, score: 0.95 }
			}

			if (fp.textContent) {
				const similarity = this.calculateTextSimilarity(fingerprint.textContent, fp.textContent)
				if (similarity > (bestMatch?.score || 0) && similarity > 0.7) {
					bestMatch = { index: candidate.index, score: similarity }
				}
			}
		}

		return bestMatch
	}

	/**
	 * Match by attributes
	 */
	private matchByAttributes(
		fingerprint: ElementFingerprint,
		candidates: Array<{ index: number; node: InteractiveElementDomNode; fingerprint: ElementFingerprint }>
	): { index: number; score: number } | null {
		const attrKeys = Object.keys(fingerprint.attributes)
		if (attrKeys.length === 0) return null

		let bestMatch: { index: number; score: number } | null = null

		for (const candidate of candidates) {
			const fp = candidate.fingerprint
			let matches = 0
			let totalWeight = 0

			for (const key of attrKeys) {
				const weight = this.getAttributeWeight(key)
				totalWeight += weight

				if (fp.attributes[key] === fingerprint.attributes[key]) {
					matches += weight
				}
			}

			const score = matches / totalWeight
			if (score > (bestMatch?.score || 0) && score > 0.6) {
				bestMatch = { index: candidate.index, score }
			}
		}

		return bestMatch
	}

	/**
	 * Match by DOM structure
	 */
	private matchByStructure(
		fingerprint: ElementFingerprint,
		candidates: Array<{ index: number; node: InteractiveElementDomNode; fingerprint: ElementFingerprint }>
	): { index: number; score: number } | null {
		let bestMatch: { index: number; score: number } | null = null

		for (const candidate of candidates) {
			const fp = candidate.fingerprint
			let score = 0

			// Same tag name
			if (fp.tagName === fingerprint.tagName) {
				score += 0.3
			}

			// Similar depth
			const depthDiff = Math.abs(fp.depth - fingerprint.depth)
			if (depthDiff === 0) score += 0.2
			else if (depthDiff <= 2) score += 0.1

			// Same parent tag
			if (fp.parentTag === fingerprint.parentTag) {
				score += 0.2
			}

			// Similar child count
			if (fp.childCount === fingerprint.childCount) {
				score += 0.1
			}

			if (score > (bestMatch?.score || 0) && score >= 0.4) {
				bestMatch = { index: candidate.index, score }
			}
		}

		return bestMatch
	}

	/**
	 * Match by visual position
	 */
	private matchByPosition(
		fingerprint: ElementFingerprint,
		candidates: Array<{ index: number; node: InteractiveElementDomNode; fingerprint: ElementFingerprint }>
	): { index: number; score: number } | null {
		let bestMatch: { index: number; score: number } | null = null
		let bestDistance = Infinity

		for (const candidate of candidates) {
			const fp = candidate.fingerprint

			// Calculate Euclidean distance
			const dx = fp.positionRatio.x - fingerprint.positionRatio.x
			const dy = fp.positionRatio.y - fingerprint.positionRatio.y
			const distance = Math.sqrt(dx * dx + dy * dy)

			// Convert distance to score (closer = higher score)
			const score = Math.max(0, 1 - distance * 2)

			if (distance < bestDistance && score >= 0.5) {
				bestDistance = distance
				bestMatch = { index: candidate.index, score }
			}
		}

		return bestMatch
	}

	/**
	 * Fuzzy matching using overall fingerprint similarity
	 */
	private fuzzyMatch(
		fingerprint: ElementFingerprint,
		candidates: Array<{ index: number; node: InteractiveElementDomNode; fingerprint: ElementFingerprint }>
	): { index: number; score: number } | null {
		let bestMatch: { index: number; score: number } | null = null

		for (const candidate of candidates) {
			const result = fingerprintsMatch(fingerprint, candidate.fingerprint, 0)

			if (result.score > (bestMatch?.score || 0)) {
				bestMatch = { index: candidate.index, score: result.score }
			}
		}

		return bestMatch && bestMatch.score >= 0.5 ? bestMatch : null
	}

	/**
	 * Get all interactive elements from flat tree
	 */
	private getAllInteractiveElements(
		flatTree: FlatDomTree
	): Array<{ index: number; node: InteractiveElementDomNode; fingerprint: ElementFingerprint }> {
		const candidates: Array<{ index: number; node: InteractiveElementDomNode; fingerprint: ElementFingerprint }> =
			[]

		for (const [id, node] of Object.entries(flatTree.map)) {
			if (node.isInteractive && typeof node.highlightIndex === 'number' && node.ref) {
				const fingerprint = generateElementFingerprint(node.ref, node.highlightIndex)
				candidates.push({
					index: node.highlightIndex,
					node: node as InteractiveElementDomNode,
					fingerprint,
				})
			}
		}

		return candidates
	}

	/**
	 * Find node by index in flat tree
	 */
	private findNodeByIndex(
		index: number,
		flatTree: FlatDomTree
	): InteractiveElementDomNode | null {
		for (const node of Object.values(flatTree.map)) {
			if (node.isInteractive && node.highlightIndex === index) {
				return node as InteractiveElementDomNode
			}
		}
		return null
	}

	/**
	 * Get weight for attribute matching
	 */
	private getAttributeWeight(attr: string): number {
		const weights: Record<string, number> = {
			id: 5,
			name: 3,
			type: 2,
			placeholder: 2,
			title: 2,
			href: 2,
			value: 1,
			checked: 1,
			selected: 1,
		}
		return weights[attr] || 1
	}

	/**
	 * Calculate text similarity
	 */
	private calculateTextSimilarity(a: string, b: string): number {
		if (a === b) return 1
		if (!a || !b) return 0

		const aNorm = normalizeText(a)
		const bNorm = normalizeText(b)

		if (aNorm === bNorm) return 1

		// Simple substring matching
		if (aNorm.includes(bNorm) || bNorm.includes(aNorm)) {
			return 0.8
		}

		// Word overlap
		const aWords = new Set(aNorm.split(' '))
		const bWords = new Set(bNorm.split(' '))
		const intersection = new Set([...aWords].filter((x) => bWords.has(x)))
		return intersection.size / Math.max(aWords.size, bWords.size)
	}

	/**
	 * Get healing statistics
	 */
	getStats(): typeof this.healingStats {
		return { ...this.healingStats }
	}

	/**
	 * Clear cache
	 */
	clearCache(): void {
		this.fingerprintCache.clear()
		this.history = []
	}

	/**
	 * Get cached fingerprint
	 */
	getCachedFingerprint(index: number): ElementFingerprint | undefined {
		return this.fingerprintCache.get(index)
	}

	/**
	 * Get healing history
	 */
	getHistory(): typeof this.history {
		return [...this.history]
	}
}
