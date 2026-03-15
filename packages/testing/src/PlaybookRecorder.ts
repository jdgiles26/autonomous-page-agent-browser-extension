/**
 * Playbook Recorder - Records user interactions as reusable playbooks
 * Feature 1: Visual Playbook Recorder & Replay
 */

import type { FlatDomTree, PageController } from '@page-agent/page-controller'

import type { Playbook, PlaybookStep, PlaybookStepType } from './types'
import { uid } from './utils'

export interface RecorderConfig {
	captureDomSnapshots: boolean
	captureScreenshots: boolean
	maxSteps: number
}

export const defaultRecorderConfig: RecorderConfig = {
	captureDomSnapshots: false,
	captureScreenshots: false,
	maxSteps: 100,
}

export class PlaybookRecorder extends EventTarget {
	private isRecording = false
	private currentPlaybook: Playbook | null = null
	private pageController: PageController
	private config: RecorderConfig
	private startTime = 0

	constructor(
		pageController: PageController,
		config: Partial<RecorderConfig> = {}
	) {
		super()
		this.pageController = pageController
		this.config = { ...defaultRecorderConfig, ...config }
	}

	/**
	 * Start recording a new playbook
	 */
	startRecording(name: string): Playbook {
		if (this.isRecording) {
			throw new Error('Already recording. Stop current recording first.')
		}

		this.isRecording = true
		this.startTime = Date.now()

		this.currentPlaybook = {
			id: uid(),
			name,
			url: window.location.href,
			steps: [],
			createdAt: this.startTime,
			metadata: {
				totalSteps: 0,
				estimatedDuration: 0,
			},
		}

		this.dispatchEvent(
			new CustomEvent('recording:start', {
				detail: { playbook: this.currentPlaybook },
			})
		)

		return this.currentPlaybook
	}

	/**
	 * Stop recording and return the completed playbook
	 */
	stopRecording(): Playbook {
		if (!this.isRecording || !this.currentPlaybook) {
			throw new Error('Not currently recording.')
		}

		const endTime = Date.now()
		this.currentPlaybook.metadata.estimatedDuration = endTime - this.startTime

		const playbook = this.currentPlaybook

		this.dispatchEvent(
			new CustomEvent('recording:stop', {
				detail: { playbook },
			})
		)

		this.isRecording = false
		this.currentPlaybook = null

		return playbook
	}

	/**
	 * Record a single step
	 */
	async recordStep(
		type: PlaybookStepType,
		data: {
			target?: { index?: number; description?: string }
			value?: string
			success?: boolean
			error?: string
		}
	): Promise<PlaybookStep> {
		if (!this.isRecording || !this.currentPlaybook) {
			throw new Error('Not currently recording.')
		}

		if (this.currentPlaybook.steps.length >= this.config.maxSteps) {
			throw new Error(`Maximum step limit (${this.config.maxSteps}) reached.`)
		}

		const step: PlaybookStep = {
			id: uid(),
			type,
			target: data.target,
			value: data.value,
			timestamp: Date.now(),
			success: data.success,
			error: data.error,
		}

		// Capture DOM snapshot if enabled
		if (this.config.captureDomSnapshots) {
			try {
				// Note: This would need actual implementation based on page-controller
				step.domSnapshot = undefined // Placeholder
			} catch (e) {
				console.warn('Failed to capture DOM snapshot:', e)
			}
		}

		this.currentPlaybook.steps.push(step)
		this.currentPlaybook.metadata.totalSteps = this.currentPlaybook.steps.length

		this.dispatchEvent(
			new CustomEvent('recording:step', {
				detail: { step, playbook: this.currentPlaybook },
			})
		)

		return step
	}

	/**
	 * Record a click action
	 */
	async recordClick(index: number, description?: string): Promise<PlaybookStep> {
		return this.recordStep('click', {
			target: { index, description },
			success: true,
		})
	}

	/**
	 * Record an input action
	 */
	async recordInput(
		index: number,
		value: string,
		description?: string
	): Promise<PlaybookStep> {
		return this.recordStep('input', {
			target: { index, description },
			value,
			success: true,
		})
	}

	/**
	 * Record a scroll action
	 */
	async recordScroll(
		direction: 'up' | 'down' | 'left' | 'right',
		amount: number
	): Promise<PlaybookStep> {
		return this.recordStep('scroll', {
			value: `${direction}:${amount}`,
			success: true,
		})
	}

	/**
	 * Record a select action
	 */
	async recordSelect(
		index: number,
		option: string,
		description?: string
	): Promise<PlaybookStep> {
		return this.recordStep('select', {
			target: { index, description },
			value: option,
			success: true,
		})
	}

	/**
	 * Record a wait action
	 */
	async recordWait(seconds: number): Promise<PlaybookStep> {
		return this.recordStep('wait', {
			value: `${seconds}s`,
			success: true,
		})
	}

	/**
	 * Record an assertion
	 */
	async recordAssert(
		condition: string,
		passed: boolean,
		message?: string
	): Promise<PlaybookStep> {
		return this.recordStep('assert', {
			value: condition,
			success: passed,
			error: passed ? undefined : message,
		})
	}

	/**
	 * Generate natural language instructions from playbook
	 */
	generateNaturalLanguage(playbook: Playbook): string {
		const lines: string[] = [`# ${playbook.name}`, `URL: ${playbook.url}`, '']

		for (let i = 0; i < playbook.steps.length; i++) {
			const step = playbook.steps[i]
			const stepNum = i + 1

			switch (step.type) {
				case 'click':
					lines.push(
						`${stepNum}. Click on ${step.target?.description || `element [${step.target?.index}]`}`
					)
					break
				case 'input':
					lines.push(
						`${stepNum}. Enter "${step.value}" into ${step.target?.description || `element [${step.target?.index}]`}`
					)
					break
				case 'scroll':
					const [dir, amt] = (step.value || ':').split(':')
					lines.push(`${stepNum}. Scroll ${dir} by ${amt}px`)
					break
				case 'select':
					lines.push(
						`${stepNum}. Select "${step.value}" from ${step.target?.description || `element [${step.target?.index}]`}`
					)
					break
				case 'wait':
					lines.push(`${stepNum}. Wait for ${step.value}`)
					break
				case 'assert':
					lines.push(`${stepNum}. Assert: ${step.value} ${step.success ? '✓' : '✗'}`)
					break
				case 'navigate':
					lines.push(`${stepNum}. Navigate to ${step.value}`)
					break
			}
		}

		return lines.join('\n')
	}

	/**
	 * Calculate playbook statistics
	 */
	calculateStats(playbook: Playbook): {
		totalSteps: number
		successfulSteps: number
		failedSteps: number
		averageStepDuration: number
		stepTypeDistribution: Record<PlaybookStepType, number>
	} {
		const successfulSteps = playbook.steps.filter((s) => s.success).length
		const failedSteps = playbook.steps.filter((s) => s.success === false).length

		const durations: number[] = []
		for (let i = 1; i < playbook.steps.length; i++) {
			durations.push(playbook.steps[i].timestamp - playbook.steps[i - 1].timestamp)
		}
		const averageStepDuration =
			durations.length > 0
				? durations.reduce((a, b) => a + b, 0) / durations.length
				: 0

		const stepTypeDistribution = playbook.steps.reduce((acc, step) => {
			acc[step.type] = (acc[step.type] || 0) + 1
			return acc
		}, {} as Record<PlaybookStepType, number>)

		return {
			totalSteps: playbook.steps.length,
			successfulSteps,
			failedSteps,
			averageStepDuration,
			stepTypeDistribution,
		}
	}

	/**
	 * Get current recording state
	 */
	getRecordingState(): {
		isRecording: boolean
		currentPlaybook: Playbook | null
		stepCount: number
		duration: number
	} {
		return {
			isRecording: this.isRecording,
			currentPlaybook: this.currentPlaybook,
			stepCount: this.currentPlaybook?.steps.length || 0,
			duration: this.isRecording ? Date.now() - this.startTime : 0,
		}
	}

	/**
	 * Export playbook to JSON
	 */
	exportToJSON(playbook: Playbook): string {
		return JSON.stringify(playbook, null, 2)
	}

	/**
	 * Import playbook from JSON
	 */
	importFromJSON(json: string): Playbook {
		return JSON.parse(json) as Playbook
	}
}
