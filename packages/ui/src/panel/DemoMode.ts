/**
 * Demo Mode - Record and replay agent steps for software demonstrations
 *
 * This allows users to:
 * 1. Record a sequence of steps (up to 10) during normal agent execution
 * 2. Save the recorded path to localStorage
 * 3. Replay the steps automatically without LLM calls
 */

export interface DemoStep {
	/** The action name (e.g., 'click_element_by_index', 'input_text') */
	action: string
	/** The action input parameters */
	input: Record<string, unknown>
	/** Optional delay before executing this step (in ms) */
	delay?: number
	/** Optional description for the step */
	description?: string
}

export interface DemoPath {
	/** Unique identifier for this demo path */
	id: string
	/** Human-readable name */
	name: string
	/** The recorded steps */
	steps: DemoStep[]
	/** When the path was created */
	createdAt: number
	/** Optional starting URL */
	startUrl?: string
}

export type DemoModeState = 'idle' | 'recording' | 'replaying'

const STORAGE_KEY = 'page-agent-demo-paths'
const MAX_STEPS = 10

export class DemoModeManager extends EventTarget {
	#state: DemoModeState = 'idle'
	#currentPath: DemoPath | null = null
	#currentStepIndex = 0
	#paths = new Map<string, DemoPath>()

	constructor() {
		super()
		this.#loadPaths()
	}

	/** Current demo mode state */
	get state(): DemoModeState {
		return this.#state
	}

	/** Whether currently recording */
	get isRecording(): boolean {
		return this.#state === 'recording'
	}

	/** Whether currently replaying */
	get isReplaying(): boolean {
		return this.#state === 'replaying'
	}

	/** Current recording step count */
	get currentStepCount(): number {
		return this.#currentPath?.steps.length ?? 0
	}

	/** Maximum allowed steps */
	get maxSteps(): number {
		return MAX_STEPS
	}

	/** All saved paths */
	get savedPaths(): DemoPath[] {
		return Array.from(this.#paths.values()).sort((a, b) => b.createdAt - a.createdAt)
	}

	/** Current path being recorded or replayed */
	get currentPath(): DemoPath | null {
		return this.#currentPath
	}

	/**
	 * Start recording a new demo path
	 */
	startRecording(name: string): DemoPath {
		const path: DemoPath = {
			id: `demo-${Date.now()}`,
			name: name || `Demo ${this.savedPaths.length + 1}`,
			steps: [],
			createdAt: Date.now(),
			startUrl: window.location.href,
		}

		this.#currentPath = path
		this.#currentStepIndex = 0
		this.#state = 'recording'
		this.#emitStateChange()

		return path
	}

	/**
	 * Record a step during agent execution
	 */
	recordStep(action: string, input: Record<string, unknown>, description?: string): boolean {
		if (!this.isRecording || !this.#currentPath) {
			return false
		}

		if (this.#currentPath.steps.length >= MAX_STEPS) {
			console.warn('[DemoMode] Maximum steps reached:', MAX_STEPS)
			return false
		}

		const step: DemoStep = {
			action,
			input,
			description,
			delay: 1500, // Default 1.5s delay between steps for demo pacing
		}

		this.#currentPath.steps.push(step)
		this.#emitStepRecorded(step, this.#currentPath.steps.length - 1)

		return true
	}

	/**
	 * Stop recording and save the path
	 */
	stopRecording(): DemoPath | null {
		if (!this.isRecording || !this.#currentPath) {
			return null
		}

		const path = this.#currentPath
		this.#paths.set(path.id, path)
		this.#savePaths()

		this.#state = 'idle'
		this.#currentStepIndex = 0
		this.#emitStateChange()

		return path
	}

	/**
	 * Cancel recording without saving
	 */
	cancelRecording(): void {
		this.#state = 'idle'
		this.#currentPath = null
		this.#currentStepIndex = 0
		this.#emitStateChange()
	}

	/**
	 * Start replaying a saved path
	 */
	startReplay(pathId: string): DemoPath | null {
		const path = this.#paths.get(pathId)
		if (!path) {
			console.error('[DemoMode] Path not found:', pathId)
			return null
		}

		this.#currentPath = path
		this.#currentStepIndex = 0
		this.#state = 'replaying'
		this.#emitStateChange()

		return path
	}

	/**
	 * Get the next step during replay
	 */
	getNextStep(): { step: DemoStep; index: number } | null {
		if (!this.isReplaying || !this.#currentPath) {
			return null
		}

		if (this.#currentStepIndex >= this.#currentPath.steps.length) {
			this.stopReplay()
			return null
		}

		const step = this.#currentPath.steps[this.#currentStepIndex]
		const index = this.#currentStepIndex
		this.#currentStepIndex++

		return { step, index }
	}

	/**
	 * Stop replaying
	 */
	stopReplay(): void {
		this.#state = 'idle'
		this.#currentStepIndex = 0
		this.#emitStateChange()
		this.#emitReplayComplete()
	}

	/**
	 * Delete a saved path
	 */
	deletePath(pathId: string): boolean {
		const deleted = this.#paths.delete(pathId)
		if (deleted) {
			this.#savePaths()
		}
		return deleted
	}

	/**
	 * Rename a saved path
	 */
	renamePath(pathId: string, newName: string): boolean {
		const path = this.#paths.get(pathId)
		if (path) {
			path.name = newName
			this.#savePaths()
			return true
		}
		return false
	}

	/**
	 * Load paths from localStorage
	 */
	#loadPaths(): void {
		try {
			const data = localStorage.getItem(STORAGE_KEY)
			if (data) {
				const paths: DemoPath[] = JSON.parse(data)
				for (const path of paths) {
					this.#paths.set(path.id, path)
				}
			}
		} catch (e) {
			console.error('[DemoMode] Failed to load paths:', e)
		}
	}

	/**
	 * Save paths to localStorage
	 */
	#savePaths(): void {
		try {
			const paths = Array.from(this.#paths.values())
			localStorage.setItem(STORAGE_KEY, JSON.stringify(paths))
		} catch (e) {
			console.error('[DemoMode] Failed to save paths:', e)
		}
	}

	#emitStateChange(): void {
		this.dispatchEvent(
			new CustomEvent('statechange', {
				detail: { state: this.#state, path: this.#currentPath },
			})
		)
	}

	#emitStepRecorded(step: DemoStep, index: number): void {
		this.dispatchEvent(
			new CustomEvent('steprecorded', {
				detail: { step, index, total: this.#currentPath?.steps.length ?? 0 },
			})
		)
	}

	#emitReplayComplete(): void {
		this.dispatchEvent(new CustomEvent('replaycomplete'))
	}
}
