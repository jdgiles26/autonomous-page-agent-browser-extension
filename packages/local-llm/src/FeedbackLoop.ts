/**
 * FeedbackLoop - Records and analyzes success/failure feedback
 * Provides real-time parameter adjustment and improvement suggestions
 */

import type { LearningEngine } from './LearningEngine.js'
import type { FeedbackEvent, LearningExampleMetadata } from './types.js'

export interface FeedbackLoopConfig {
	windowSize?: number
	adjustmentThreshold?: number
	minSamplesForAdjustment?: number
}

export interface AdjustmentSuggestion {
	parameter: 'temperature' | 'topP' | 'maxTokens' | 'promptStrategy'
	currentValue: number | string
	suggestedValue: number | string
	reason: string
	confidence: number
}

export class FeedbackLoop extends EventTarget {
	private learningEngine: LearningEngine
	private config: Required<FeedbackLoopConfig>
	private recentFeedback: FeedbackEvent[] = []
	private adjustmentHistory: Array<{
		timestamp: number
		parameter: string
		oldValue: number
		newValue: number
		result: 'improved' | 'worsened' | 'unchanged'
	}> = []

	constructor(learningEngine: LearningEngine, config: FeedbackLoopConfig = {}) {
		super()
		this.learningEngine = learningEngine
		this.config = {
			windowSize: config.windowSize ?? 20,
			adjustmentThreshold: config.adjustmentThreshold ?? 0.2,
			minSamplesForAdjustment: config.minSamplesForAdjustment ?? 10,
		}
	}

	/**
	 * Record a feedback event
	 */
	record(event: Omit<FeedbackEvent, 'metadata'> & { metadata: Omit<LearningExampleMetadata, 'timestamp'> }): void {
		const fullEvent: FeedbackEvent = {
			...event,
			metadata: {
				...event.metadata,
				timestamp: Date.now(),
			},
		}

		this.recentFeedback.unshift(fullEvent)

		// Keep only recent feedback
		if (this.recentFeedback.length > this.config.windowSize) {
			this.recentFeedback.pop()
		}

		// Dispatch event
		this.dispatchEvent(new CustomEvent('feedback', { detail: fullEvent }))

		// Check if we should suggest adjustments
		this.checkForAdjustments()
	}

	/**
	 * Record a successful action
	 */
	async recordSuccess(
		step: string,
		prompt: string,
		response: string,
		metadata: Omit<LearningExampleMetadata, 'timestamp'>
	): Promise<void> {
		this.record({
			type: 'success',
			step,
			prompt,
			response,
			metadata,
		})

		// Also record in learning engine
		await this.learningEngine.recordSuccess(prompt, response, {
			...metadata,
			timestamp: Date.now(),
		})
	}

	/**
	 * Record a failed action
	 */
	async recordFailure(
		step: string,
		prompt: string,
		error: string,
		metadata: Omit<LearningExampleMetadata, 'timestamp'>
	): Promise<void> {
		this.record({
			type: 'failure',
			step,
			prompt,
			response: '',
			error,
			metadata,
		})

		// Also record in learning engine
		await this.learningEngine.recordFailure(prompt, error, {
			...metadata,
			timestamp: Date.now(),
		})
	}

	/**
	 * Record a partial success
	 */
	async recordPartial(
		step: string,
		prompt: string,
		response: string,
		metadata: Omit<LearningExampleMetadata, 'timestamp'>
	): Promise<void> {
		this.record({
			type: 'partial',
			step,
			prompt,
			response,
			metadata,
		})
	}

	/**
	 * Get recent failures for analysis
	 */
	getRecentFailures(limit: number = 10): FeedbackEvent[] {
		return this.recentFeedback
			.filter((f) => f.type === 'failure')
			.slice(0, limit)
	}

	/**
	 * Get common errors
	 */
	getCommonErrors(): Array<{ error: string; count: number; percentage: number }> {
		const failures = this.recentFeedback.filter((f) => f.type === 'failure')
		if (failures.length === 0) return []

		const errorCounts = new Map<string, number>()

		for (const failure of failures) {
			if (failure.error) {
				// Normalize error message
				const normalized = this.normalizeError(failure.error)
				errorCounts.set(normalized, (errorCounts.get(normalized) || 0) + 1)
			}
		}

		const sorted = [...errorCounts.entries()]
			.sort((a, b) => b[1] - a[1])
			.slice(0, 5)

		return sorted.map(([error, count]) => ({
			error,
			count,
			percentage: count / failures.length,
		}))
	}

	/**
	 * Normalize error message for grouping
	 */
	private normalizeError(error: string): string {
		// Remove specific element indices, IDs, etc.
		return error
			.replace(/\d+/g, 'N')
			.replace(/element-\w+/g, 'element-X')
			.replace(/\[[\w-]+\]/g, '[X]')
			.toLowerCase()
			.trim()
	}

	/**
	 * Check if we should adjust parameters
	 */
	private checkForAdjustments(): void {
		if (this.recentFeedback.length < this.config.minSamplesForAdjustment) {
			return
		}

		const successRate = this.calculateSuccessRate()
		const previousRate = this.getPreviousSuccessRate()

		// Significant drop in success rate
		if (previousRate - successRate > this.config.adjustmentThreshold) {
			const suggestions = this.generateAdjustmentSuggestions()
			if (suggestions.length > 0) {
				this.dispatchEvent(
					new CustomEvent('adjustment-suggested', { detail: suggestions })
				)
			}
		}
	}

	/**
	 * Calculate current success rate
	 */
	calculateSuccessRate(): number {
		if (this.recentFeedback.length === 0) return 0
		const successes = this.recentFeedback.filter((f) => f.type === 'success').length
		return successes / this.recentFeedback.length
	}

	/**
	 * Get previous success rate from history
	 */
	private getPreviousSuccessRate(): number {
		// Look at older feedback not in current window
		// For simplicity, return 1.0 (assume good start)
		return 1.0
	}

	/**
	 * Generate adjustment suggestions based on feedback analysis
	 */
	generateAdjustmentSuggestions(): AdjustmentSuggestion[] {
		const suggestions: AdjustmentSuggestion[] = []
		const successRate = this.calculateSuccessRate()
		const commonErrors = this.getCommonErrors()

		// Temperature adjustment
		if (successRate < 0.3) {
			suggestions.push({
				parameter: 'temperature',
				currentValue: 0.7,
				suggestedValue: 1.0,
				reason: 'Low success rate, increasing exploration',
				confidence: 0.7,
			})
		} else if (successRate > 0.8) {
			suggestions.push({
				parameter: 'temperature',
				currentValue: 0.7,
				suggestedValue: 0.3,
				reason: 'High success rate, reducing randomness for consistency',
				confidence: 0.8,
			})
		}

		// Max tokens adjustment based on error types
		const truncationErrors = commonErrors.some(
			(e) => e.error.includes('truncated') || e.error.includes('incomplete')
		)
		if (truncationErrors) {
			suggestions.push({
				parameter: 'maxTokens',
				currentValue: 1024,
				suggestedValue: 2048,
				reason: 'Responses may be truncated, increasing token limit',
				confidence: 0.9,
			})
		}

		// Prompt strategy adjustment
		const parsingErrors = commonErrors.some(
			(e) => e.error.includes('parse') || e.error.includes('json') || e.error.includes('format')
		)
		if (parsingErrors) {
			suggestions.push({
				parameter: 'promptStrategy',
				currentValue: 'standard',
				suggestedValue: 'structured-output',
				reason: 'JSON parsing errors detected, using structured output format',
				confidence: 0.75,
			})
		}

		return suggestions
	}

	/**
	 * Get adjusted parameters based on feedback
	 */
	getAdjustedParameters(): {
		temperature: number
		topP: number
		maxTokens: number
	} {
		const successRate = this.calculateSuccessRate()

		if (successRate < 0.3) {
			return {
				temperature: 1.0,
				topP: 1.0,
				maxTokens: 2048,
			}
		} else if (successRate < 0.6) {
			return {
				temperature: 0.7,
				topP: 0.95,
				maxTokens: 1024,
			}
		} else {
			return {
				temperature: 0.3,
				topP: 0.9,
				maxTokens: 512,
			}
		}
	}

	/**
	 * Get improvement suggestions
	 */
	getImprovementSuggestions(): string[] {
		const suggestions: string[] = []
		const successRate = this.calculateSuccessRate()
		const commonErrors = this.getCommonErrors()

		if (successRate < 0.5) {
			suggestions.push('Consider using a larger or more capable model')
			suggestions.push('Review and improve the prompt templates')
		}

		for (const error of commonErrors.slice(0, 3)) {
			if (error.error.includes('element not found')) {
				suggestions.push('Element selectors may need refinement - consider using more stable attributes')
			}
			if (error.error.includes('timeout')) {
				suggestions.push('Actions are timing out - consider increasing wait times or checking page load')
			}
			if (error.error.includes('click intercepted')) {
				suggestions.push('Elements may be covered by overlays - consider scrolling or dismissing popups first')
			}
		}

		return suggestions
	}

	/**
	 * Get feedback summary
	 */
	getFeedbackSummary(): {
		total: number
		successes: number
		failures: number
		partials: number
		successRate: number
		averageDuration: number
	} {
		const total = this.recentFeedback.length
		const successes = this.recentFeedback.filter((f) => f.type === 'success').length
		const failures = this.recentFeedback.filter((f) => f.type === 'failure').length
		const partials = this.recentFeedback.filter((f) => f.type === 'partial').length

		const avgDuration =
			total > 0
				? this.recentFeedback.reduce((sum, f) => sum + (f.metadata.executionTime || 0), 0) / total
				: 0

		return {
			total,
			successes,
			failures,
			partials,
			successRate: total > 0 ? successes / total : 0,
			averageDuration: avgDuration,
		}
	}

	/**
	 * Record parameter adjustment result
	 */
	recordAdjustmentResult(
		parameter: string,
		oldValue: number,
		newValue: number,
		result: 'improved' | 'worsened' | 'unchanged'
	): void {
		this.adjustmentHistory.push({
			timestamp: Date.now(),
			parameter,
			oldValue,
			newValue,
			result,
		})
	}

	/**
	 * Clear feedback history
	 */
	clearHistory(): void {
		this.recentFeedback = []
	}
}
