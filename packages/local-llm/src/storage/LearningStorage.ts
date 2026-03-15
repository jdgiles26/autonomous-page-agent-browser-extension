/**
 * IndexedDB storage for learning data
 * Stores examples, patterns, and feedback
 */

import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { LearningExample, LearningPattern, FeedbackEvent, LearningStats } from '../types.js'

interface LearningDBSchema extends DBSchema {
	examples: {
		key: string
		value: LearningExample
		indexes: {
			byUrl: string
			byTaskType: string
			byTimestamp: number
			bySuccess: string // compound index would be better but simple for now
		}
	}
	patterns: {
		key: string
		value: LearningPattern
		indexes: {
			byType: string
			bySuccessRate: number
		}
	}
	feedback: {
		key: string
		value: FeedbackEvent & { id: string }
		indexes: {
			byTimestamp: number
			byType: string
		}
	}
}

const DB_NAME = 'PageAgentLearning'
const DB_VERSION = 1
const MAX_EXAMPLES_DEFAULT = 10000
const MAX_FEEDBACK_DEFAULT = 5000

export class LearningStorage extends EventTarget {
	private db: IDBPDatabase<LearningDBSchema> | null = null
	private initPromise: Promise<void> | null = null
	private maxExamples: number
	private maxFeedback: number

	constructor(options?: { maxExamples?: number; maxFeedback?: number }) {
		super()
		this.maxExamples = options?.maxExamples ?? MAX_EXAMPLES_DEFAULT
		this.maxFeedback = options?.maxFeedback ?? MAX_FEEDBACK_DEFAULT
	}

	/**
	 * Initialize the IndexedDB database
	 */
	async initialize(): Promise<void> {
		if (this.initPromise) return this.initPromise
		this.initPromise = this.doInitialize()
		return this.initPromise
	}

	private async doInitialize(): Promise<void> {
		this.db = await openDB<LearningDBSchema>(DB_NAME, DB_VERSION, {
			upgrade(db) {
				// Examples store
				if (!db.objectStoreNames.contains('examples')) {
					const exampleStore = db.createObjectStore('examples', { keyPath: 'id' })
					exampleStore.createIndex('byUrl', 'metadata.url')
					exampleStore.createIndex('byTaskType', 'metadata.taskType')
					exampleStore.createIndex('byTimestamp', 'timestamp')
					exampleStore.createIndex('bySuccess', 'success')
				}

				// Patterns store
				if (!db.objectStoreNames.contains('patterns')) {
					const patternStore = db.createObjectStore('patterns', { keyPath: 'id' })
					patternStore.createIndex('byType', 'type')
					patternStore.createIndex('bySuccessRate', 'successRate')
				}

				// Feedback store
				if (!db.objectStoreNames.contains('feedback')) {
					const feedbackStore = db.createObjectStore('feedback', { keyPath: 'id' })
					feedbackStore.createIndex('byTimestamp', 'metadata.timestamp')
					feedbackStore.createIndex('byType', 'type')
				}
			},
		})
	}

	/**
	 * Ensure database is initialized
	 */
	private async ensureDb(): Promise<IDBPDatabase<LearningDBSchema>> {
		if (!this.db) {
			await this.initialize()
		}
		if (!this.db) {
			throw new Error('Failed to initialize LearningStorage database')
		}
		return this.db
	}

	/**
	 * Save a learning example
	 */
	async saveExample(example: Omit<LearningExample, 'id'>): Promise<string> {
		const db = await this.ensureDb()

		const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
		const fullExample: LearningExample = { ...example, id }

		await db.put('examples', fullExample)

		// Clean up old examples if over limit
		await this.cleanupOldExamples()

		return id
	}

	/**
	 * Get examples with optional filtering
	 */
	async getExamples(filter?: {
		url?: string
		taskType?: string
		success?: boolean
		limit?: number
		since?: number
	}): Promise<LearningExample[]> {
		const db = await this.ensureDb()

		let examples: LearningExample[]

		if (filter?.url) {
			examples = await db.getAllFromIndex('examples', 'byUrl', filter.url)
		} else if (filter?.taskType) {
			examples = await db.getAllFromIndex('examples', 'byTaskType', filter.taskType)
		} else if (filter?.success !== undefined) {
			// Get all and filter by success since IndexedDB doesn't support boolean index queries directly
			const all = await db.getAll('examples')
			examples = all.filter((ex) => ex.success === filter.success)
		} else {
			examples = await db.getAll('examples')
		}

		// Apply additional filters
		if (filter?.since) {
			examples = examples.filter((ex) => ex.timestamp >= filter.since!)
		}

		// Sort by timestamp (newest first)
		examples.sort((a, b) => b.timestamp - a.timestamp)

		// Apply limit
		if (filter?.limit) {
			examples = examples.slice(0, filter.limit)
		}

		return examples
	}

	/**
	 * Get similar examples based on context similarity (simple text matching)
	 */
	async getSimilarExamples(context: string, limit: number = 5): Promise<LearningExample[]> {
		const db = await this.ensureDb()
		const allExamples = await db.getAll('examples')

		// Simple similarity scoring based on common words
		const contextWords = new Set(context.toLowerCase().split(/\s+/))

		const scored = allExamples
			.filter((ex) => ex.success) // Only successful examples
			.map((ex) => {
				const exWords = new Set(ex.context.toLowerCase().split(/\s+/))
				const commonWords = [...contextWords].filter((w) => exWords.has(w))
				const score = commonWords.length / Math.max(contextWords.size, exWords.size)
				return { example: ex, score }
			})

		scored.sort((a, b) => b.score - a.score)

		return scored.slice(0, limit).map((s) => s.example)
	}

	/**
	 * Delete old examples to stay within limit
	 */
	private async cleanupOldExamples(): Promise<void> {
		const db = await this.ensureDb()
		const count = await db.count('examples')

		if (count > this.maxExamples) {
			const toDelete = count - this.maxExamples
			const allExamples = await db.getAllFromIndex('examples', 'byTimestamp')

			// Delete oldest examples
			for (let i = 0; i < toDelete && i < allExamples.length; i++) {
				await db.delete('examples', allExamples[i].id)
			}
		}
	}

	/**
	 * Save a learned pattern
	 */
	async savePattern(pattern: Omit<LearningPattern, 'id' | 'createdAt' | 'lastUsedAt'>): Promise<string> {
		const db = await this.ensureDb()

		const id = `pattern-${pattern.type}-${Date.now()}`
		const fullPattern: LearningPattern = {
			...pattern,
			id,
			createdAt: Date.now(),
			lastUsedAt: Date.now(),
		}

		await db.put('patterns', fullPattern)
		return id
	}

	/**
	 * Get all patterns
	 */
	async getPatterns(filter?: { type?: string; minSuccessRate?: number }): Promise<LearningPattern[]> {
		const db = await this.ensureDb()

		let patterns: LearningPattern[]

		if (filter?.type) {
			patterns = await db.getAllFromIndex('patterns', 'byType', filter.type)
		} else {
			patterns = await db.getAll('patterns')
		}

		if (filter?.minSuccessRate !== undefined) {
			patterns = patterns.filter((p) => p.successRate >= filter.minSuccessRate!)
		}

		// Sort by success rate (highest first)
		patterns.sort((a, b) => b.successRate - a.successRate)

		return patterns
	}

	/**
	 * Update pattern last used time
	 */
	async touchPattern(patternId: string): Promise<void> {
		const db = await this.ensureDb()
		const pattern = await db.get('patterns', patternId)
		if (pattern) {
			pattern.lastUsedAt = Date.now()
			await db.put('patterns', pattern)
		}
	}

	/**
	 * Save feedback event
	 */
	async saveFeedback(event: Omit<FeedbackEvent, 'id'>): Promise<string> {
		const db = await this.ensureDb()

		const id = `feedback-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
		const fullEvent = { ...event, id }

		await db.put('feedback', fullEvent)

		// Clean up old feedback
		await this.cleanupOldFeedback()

		return id
	}

	/**
	 * Get feedback events
	 */
	async getFeedback(filter?: {
		type?: 'success' | 'failure' | 'partial'
		since?: number
		limit?: number
	}): Promise<(FeedbackEvent & { id: string })[]> {
		const db = await this.ensureDb()

		let feedback: (FeedbackEvent & { id: string })[]

		if (filter?.type) {
			feedback = await db.getAllFromIndex('feedback', 'byType', filter.type)
		} else {
			feedback = await db.getAll('feedback')
		}

		if (filter?.since) {
			feedback = feedback.filter((f) => f.metadata.timestamp >= filter.since!)
		}

		// Sort by timestamp (newest first)
		feedback.sort((a, b) => b.metadata.timestamp - a.metadata.timestamp)

		if (filter?.limit) {
			feedback = feedback.slice(0, filter.limit)
		}

		return feedback
	}

	/**
	 * Delete old feedback to stay within limit
	 */
	private async cleanupOldFeedback(): Promise<void> {
		const db = await this.ensureDb()
		const count = await db.count('feedback')

		if (count > this.maxFeedback) {
			const toDelete = count - this.maxFeedback
			const allFeedback = await db.getAllFromIndex('feedback', 'byTimestamp')

			for (let i = 0; i < toDelete && i < allFeedback.length; i++) {
				await db.delete('feedback', allFeedback[i].id)
			}
		}
	}

	/**
	 * Get learning statistics
	 */
	async getStats(): Promise<LearningStats> {
		const db = await this.ensureDb()

		const allExamples = await db.getAll('examples')
		const successful = allExamples.filter((ex) => ex.success)
		const failed = allExamples.filter((ex) => !ex.success)

		const avgExecutionTime =
			allExamples.length > 0
				? allExamples.reduce((sum, ex) => sum + ex.metadata.executionTime, 0) / allExamples.length
				: 0

		// Get top patterns
		const patterns = await this.getPatterns({ minSuccessRate: 0.5 })
		const topPatterns = patterns.slice(0, 10).map((p) => ({
			pattern: p.pattern,
			type: p.type,
			successRate: p.successRate,
			count: p.count,
		}))

		return {
			totalExamples: allExamples.length,
			successfulExamples: successful.length,
			failedExamples: failed.length,
			accuracy: allExamples.length > 0 ? successful.length / allExamples.length : 0,
			averageExecutionTime: avgExecutionTime,
			topPatterns,
		}
	}

	/**
	 * Export all learning data as JSON string
	 */
	async exportAll(): Promise<string> {
		const db = await this.ensureDb()

		const data = {
			examples: await db.getAll('examples'),
			patterns: await db.getAll('patterns'),
			feedback: await db.getAll('feedback'),
			exportedAt: Date.now(),
		}

		return JSON.stringify(data)
	}

	/**
	 * Import learning data from JSON string
	 */
	async importAll(jsonData: string): Promise<void> {
		const db = await this.ensureDb()
		const data = JSON.parse(jsonData)

		// Import examples
		if (data.examples) {
			for (const example of data.examples) {
				await db.put('examples', example)
			}
		}

		// Import patterns
		if (data.patterns) {
			for (const pattern of data.patterns) {
				await db.put('patterns', pattern)
			}
		}

		// Import feedback
		if (data.feedback) {
			for (const event of data.feedback) {
				await db.put('feedback', event)
			}
		}
	}

	/**
	 * Clear all learning data
	 */
	async clearAll(): Promise<void> {
		const db = await this.ensureDb()
		await db.clear('examples')
		await db.clear('patterns')
		await db.clear('feedback')
	}
}
