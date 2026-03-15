/**
 * LearningEngine - Continuous learning system that improves accuracy over time
 * Tracks successful/failed actions and optimizes prompts based on patterns
 */

import { LearningStorage } from './storage/LearningStorage.js'
import type {
	LearningExample,
	LearningStats,
	LearningPattern,
	LearningExampleMetadata,
} from './types.js'

export interface LearningEngineConfig {
	enabled?: boolean
	maxExamples?: number
	similarityThreshold?: number
	promptEnhancementEnabled?: boolean
}

export interface PromptEnhancement {
	originalPrompt: string
	enhancedPrompt: string
	examplesAdded: number
	patternsApplied: number
}

export class LearningEngine extends EventTarget {
	private storage: LearningStorage
	private config: Required<LearningEngineConfig>
	private isInitialized = false
	private recentExamples: LearningExample[] = []
	private readonly MAX_RECENT = 100

	constructor(config: LearningEngineConfig = {}) {
		super()
		this.config = {
			enabled: config.enabled ?? true,
			maxExamples: config.maxExamples ?? 10000,
			similarityThreshold: config.similarityThreshold ?? 0.6,
			promptEnhancementEnabled: config.promptEnhancementEnabled ?? true,
		}
		this.storage = new LearningStorage({ maxExamples: this.config.maxExamples })
	}

	/**
	 * Initialize the learning engine
	 */
	async initialize(): Promise<void> {
		if (this.isInitialized) return
		await this.storage.initialize()
		this.isInitialized = true
	}

	/**
	 * Record a successful interaction
	 */
	async recordSuccess(
		prompt: string,
		response: string,
		metadata: LearningExampleMetadata
	): Promise<string> {
		if (!this.config.enabled) return ''
		await this.initialize()

		const example: Omit<LearningExample, 'id'> = {
			prompt,
			context: this.extractContext(prompt),
			response,
			success: true,
			timestamp: Date.now(),
			metadata,
		}

		const id = await this.storage.saveExample(example)
		this.addToRecent({ ...example, id })

		// Update patterns asynchronously
		this.updatePatterns().catch(console.error)

		return id
	}

	/**
	 * Record a failed interaction
	 */
	async recordFailure(
		prompt: string,
		error: string,
		metadata: LearningExampleMetadata
	): Promise<string> {
		if (!this.config.enabled) return ''
		await this.initialize()

		const example: Omit<LearningExample, 'id'> = {
			prompt,
			context: this.extractContext(prompt),
			response: error,
			success: false,
			timestamp: Date.now(),
			metadata,
		}

		const id = await this.storage.saveExample(example)
		this.addToRecent({ ...example, id })

		return id
	}

	/**
	 * Add example to recent cache
	 */
	private addToRecent(example: LearningExample): void {
		this.recentExamples.unshift(example)
		if (this.recentExamples.length > this.MAX_RECENT) {
			this.recentExamples.pop()
		}
	}

	/**
	 * Extract context from prompt for similarity matching
	 */
	private extractContext(prompt: string): string {
		// Extract key elements: task description, DOM structure hints, etc.
		const lines = prompt.split('\n')
		const contextLines: string[] = []

		for (const line of lines) {
			// Look for task descriptions
			if (line.toLowerCase().includes('task:') || line.toLowerCase().includes('goal:')) {
				contextLines.push(line)
			}
			// Look for element descriptions
			if (line.includes('[') && line.includes(']')) {
				contextLines.push(line)
			}
		}

		return contextLines.join('\n').slice(0, 1000) // Limit context size
	}

	/**
	 * Enhance a prompt with learned examples
	 */
	async enhancePrompt(basePrompt: string, context?: string): Promise<PromptEnhancement> {
		if (!this.config.enabled || !this.config.promptEnhancementEnabled) {
			return {
				originalPrompt: basePrompt,
				enhancedPrompt: basePrompt,
				examplesAdded: 0,
				patternsApplied: 0,
			}
		}

		await this.initialize()

		const searchContext = context || this.extractContext(basePrompt)
		const similarExamples = await this.getSimilarSuccessfulExamples(searchContext, 3)
		const patterns = await this.getRelevantPatterns(searchContext)

		let enhancedPrompt = basePrompt
		let examplesAdded = 0
		let patternsApplied = 0

		// Add relevant examples
		if (similarExamples.length > 0) {
			const examplesSection = similarExamples
				.map(
					(ex, i) =>
						`Example ${i + 1}:\nTask: ${ex.prompt.slice(0, 200)}...\nAction: ${ex.response.slice(0, 200)}`
				)
				.join('\n\n')

			enhancedPrompt = `# Similar successful examples from past interactions:\n${examplesSection}\n\n# Current task:\n${basePrompt}`
			examplesAdded = similarExamples.length
		}

		// Add pattern guidance
		if (patterns.length > 0) {
			const patternsSection = patterns
				.map((p) => `- ${p.pattern} (success rate: ${(p.successRate * 100).toFixed(1)}%)`)
				.join('\n')

			enhancedPrompt = `# Learned patterns for this type of task:\n${patternsSection}\n\n${enhancedPrompt}`
			patternsApplied = patterns.length
		}

		return {
			originalPrompt: basePrompt,
			enhancedPrompt,
			examplesAdded,
			patternsApplied,
		}
	}

	/**
	 * Get similar successful examples
	 */
	async getSimilarSuccessfulExamples(
		context: string,
		limit: number = 5
	): Promise<LearningExample[]> {
		await this.initialize()

		// First check recent examples (faster)
		const recentSuccessful = this.recentExamples.filter((ex) => ex.success)
		const scoredRecent = this.scoreExamplesBySimilarity(recentSuccessful, context)

		// Get from storage if needed
		let examples = scoredRecent.slice(0, limit)
		if (examples.length < limit) {
			const storedExamples = await this.storage.getSimilarExamples(
				context,
				limit - examples.length
			)
			examples = examples.concat(storedExamples)
		}

		return examples.slice(0, limit)
	}

	/**
	 * Score examples by similarity to context
	 */
	private scoreExamplesBySimilarity(
		examples: LearningExample[],
		context: string
	): LearningExample[] {
		const contextWords = new Set(context.toLowerCase().split(/\s+/))

		const scored = examples.map((ex) => {
			const exWords = new Set(ex.context.toLowerCase().split(/\s+/))
			const commonWords = [...contextWords].filter((w) => exWords.has(w) && w.length > 3)
			const score = commonWords.length / Math.max(contextWords.size, exWords.size)
			return { example: ex, score }
		})

		scored.sort((a, b) => b.score - a.score)
		return scored.filter((s) => s.score >= this.config.similarityThreshold).map((s) => s.example)
	}

	/**
	 * Get relevant patterns for a context
	 */
	async getRelevantPatterns(context: string): Promise<LearningPattern[]> {
		await this.initialize()

		const allPatterns = await this.storage.getPatterns({ minSuccessRate: 0.6 })

		// Score patterns by relevance to context
		const contextWords = new Set(context.toLowerCase().split(/\s+/))

		const scored = allPatterns.map((pattern) => {
			const patternWords = new Set(pattern.pattern.toLowerCase().split(/\s+/))
			const commonWords = [...contextWords].filter((w) => patternWords.has(w))
			const score = (commonWords.length / Math.max(contextWords.size, patternWords.size)) * pattern.successRate
			return { pattern, score }
		})

		scored.sort((a, b) => b.score - a.score)
		return scored.slice(0, 5).map((s) => s.pattern)
	}

	/**
	 * Update patterns based on examples
	 */
	private async updatePatterns(): Promise<void> {
		const examples = await this.storage.getExamples({ limit: 1000 })

		// Extract domain patterns
		const domainStats = new Map<string, { success: number; total: number }>()
		const taskStats = new Map<string, { success: number; total: number }>()

		for (const ex of examples) {
			// Domain patterns
			try {
				const domain = new URL(ex.metadata.url).hostname
				const stats = domainStats.get(domain) || { success: 0, total: 0 }
				stats.total++
				if (ex.success) stats.success++
				domainStats.set(domain, stats)
			} catch {
				// Invalid URL, skip
			}

			// Task patterns
			const taskStats_ = taskStats.get(ex.metadata.taskType) || { success: 0, total: 0 }
			taskStats_.total++
			if (ex.success) taskStats_.success++
			taskStats.set(ex.metadata.taskType, taskStats_)
		}

		// Save domain patterns
		for (const [domain, stats] of domainStats) {
			if (stats.total >= 5) {
				await this.storage.savePattern({
					type: 'domain',
					pattern: domain,
					successRate: stats.success / stats.total,
					count: stats.total,
				})
			}
		}

		// Save task patterns
		for (const [taskType, stats] of taskStats) {
			if (stats.total >= 5) {
				await this.storage.savePattern({
					type: 'task',
					pattern: taskType,
					successRate: stats.success / stats.total,
					count: stats.total,
				})
			}
		}
	}

	/**
	 * Get learning statistics
	 */
	async getStats(): Promise<LearningStats> {
		await this.initialize()
		return this.storage.getStats()
	}

	/**
	 * Get accuracy for a specific URL
	 */
	async getAccuracyForUrl(url: string): Promise<number> {
		await this.initialize()
		const examples = await this.storage.getExamples({ url })
		if (examples.length === 0) return 0
		const successful = examples.filter((ex) => ex.success).length
		return successful / examples.length
	}

	/**
	 * Get accuracy for a task type
	 */
	async getAccuracyForTaskType(taskType: string): Promise<number> {
		await this.initialize()
		const examples = await this.storage.getExamples({ taskType })
		if (examples.length === 0) return 0
		const successful = examples.filter((ex) => ex.success).length
		return successful / examples.length
	}

	/**
	 * Get overall accuracy
	 */
	async getAccuracy(): Promise<number> {
		const stats = await this.getStats()
		return stats.accuracy
	}

	/**
	 * Export learning data
	 */
	async exportLearningData(): Promise<string> {
		await this.initialize()
		return this.storage.exportAll()
	}

	/**
	 * Import learning data
	 */
	async importLearningData(data: string): Promise<void> {
		await this.initialize()
		await this.storage.importAll(data)
	}

	/**
	 * Clear all learning data
	 */
	async clearLearningData(): Promise<void> {
		await this.initialize()
		await this.storage.clearAll()
		this.recentExamples = []
	}

	/**
	 * Get recommended parameters based on learning
	 */
	async getRecommendedParameters(context: string): Promise<{
		temperature: number
		topP: number
		maxTokens: number
	}> {
		const accuracy = await this.getAccuracy()

		// Adjust based on accuracy
		if (accuracy > 0.8) {
			return {
				temperature: 0.3,
				topP: 0.9,
				maxTokens: 512,
			}
		} else if (accuracy > 0.5) {
			return {
				temperature: 0.7,
				topP: 0.95,
				maxTokens: 1024,
			}
		} else {
			return {
				temperature: 1.0,
				topP: 1.0,
				maxTokens: 2048,
			}
		}
	}

	/**
	 * Check if learning is enabled
	 */
	isEnabled(): boolean {
		return this.config.enabled
	}

	/**
	 * Enable/disable learning
	 */
	setEnabled(enabled: boolean): void {
		this.config.enabled = enabled
	}
}
