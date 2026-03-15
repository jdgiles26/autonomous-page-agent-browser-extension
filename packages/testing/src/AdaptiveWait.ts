/**
 * Adaptive Wait - Intelligent waiting using MutationObserver and Network monitoring
 * Feature 3: Adaptive Wait Strategy
 */

import type { NetworkActivity, WaitCondition, WaitConditionType } from './types'

export interface AdaptiveWaitConfig {
	defaultTimeout: number
	pollInterval: number
	networkIdleTime: number
	domStabilityTime: number
}

export const defaultAdaptiveWaitConfig: AdaptiveWaitConfig = {
	defaultTimeout: 10000,
	pollInterval: 100,
	networkIdleTime: 500,
	domStabilityTime: 300,
}

/**
 * Network Monitor - Tracks pending network requests
 */
export class NetworkMonitor extends EventTarget {
	private pendingRequests = new Set<string>()
	private lastActivity = Date.now()
	private isMonitoring = false
	private originalFetch: typeof fetch | null = null
	private originalXHR: typeof XMLHttpRequest | null = null

	start(): void {
		if (this.isMonitoring) return
		this.isMonitoring = true

		// Intercept fetch
		this.originalFetch = window.fetch
		window.fetch = async (...args) => {
			const requestId = this.generateRequestId()
			this.pendingRequests.add(requestId)
			this.lastActivity = Date.now()

			try {
				const response = await this.originalFetch!(...args)
				return response
			} finally {
				this.pendingRequests.delete(requestId)
				this.lastActivity = Date.now()
			}
		}

		// Intercept XMLHttpRequest
		this.originalXHR = window.XMLHttpRequest
		const monitor = this

		window.XMLHttpRequest = class extends XMLHttpRequest {
			private requestId = ''

			constructor() {
				super()
				this.requestId = monitor.generateRequestId()

				this.addEventListener('loadstart', () => {
					monitor.pendingRequests.add(this.requestId)
					monitor.lastActivity = Date.now()
				})

				this.addEventListener('loadend', () => {
					monitor.pendingRequests.delete(this.requestId)
					monitor.lastActivity = Date.now()
				})
			}
		}
	}

	stop(): void {
		if (!this.isMonitoring) return
		this.isMonitoring = false

		if (this.originalFetch) {
			window.fetch = this.originalFetch
		}
		if (this.originalXHR) {
			window.XMLHttpRequest = this.originalXHR
		}
	}

	isIdle(idleTime: number): boolean {
		return (
			this.pendingRequests.size === 0 &&
			Date.now() - this.lastActivity >= idleTime
		)
	}

	getActivity(): NetworkActivity {
		return {
			pendingRequests: this.pendingRequests.size,
			lastActivity: this.lastActivity,
			isIdle: this.isIdle(0),
		}
	}

	private generateRequestId(): string {
		return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
	}
}

/**
 * DOM Stability Monitor - Watches for DOM changes
 */
export class DOMStabilityMonitor extends EventTarget {
	private observer: MutationObserver | null = null
	private lastMutation = Date.now()
	private stabilityTimeout: ReturnType<typeof setTimeout> | null = null
	private config = {
		childList: true,
		subtree: true,
		attributes: true,
		characterData: true,
	}

	start(): void {
		if (this.observer) return

		this.observer = new MutationObserver((mutations) => {
			if (mutations.length > 0) {
				this.lastMutation = Date.now()
				this.dispatchEvent(
					new CustomEvent('mutation', {
						detail: { mutations, timestamp: this.lastMutation },
					})
				)
			}
		})

		this.observer.observe(document.body, this.config)
	}

	stop(): void {
		if (this.observer) {
			this.observer.disconnect()
			this.observer = null
		}
		if (this.stabilityTimeout) {
			clearTimeout(this.stabilityTimeout)
			this.stabilityTimeout = null
		}
	}

	isStable(stabilityTime: number): boolean {
		return Date.now() - this.lastMutation >= stabilityTime
	}

	waitForStability(stabilityTime: number): Promise<void> {
		return new Promise((resolve) => {
			if (this.isStable(stabilityTime)) {
				resolve()
				return
			}

			const checkStability = () => {
				if (this.isStable(stabilityTime)) {
					resolve()
				} else {
					this.stabilityTimeout = setTimeout(checkStability, 50)
				}
			}

			checkStability()
		})
	}
}

/**
 * Adaptive Wait - Main class for intelligent waiting
 */
export class AdaptiveWait extends EventTarget {
	private config: AdaptiveWaitConfig
	private networkMonitor: NetworkMonitor
	private domMonitor: DOMStabilityMonitor

	constructor(config: Partial<AdaptiveWaitConfig> = {}) {
		super()
		this.config = { ...defaultAdaptiveWaitConfig, ...config }
		this.networkMonitor = new NetworkMonitor()
		this.domMonitor = new DOMStabilityMonitor()
	}

	/**
	 * Initialize monitors
	 */
	initialize(): void {
		this.networkMonitor.start()
		this.domMonitor.start()
	}

	/**
	 * Cleanup monitors
	 */
	dispose(): void {
		this.networkMonitor.stop()
		this.domMonitor.stop()
	}

	/**
	 * Wait for element to appear in DOM
	 */
	async waitForElement(
		selector: string,
		timeout = this.config.defaultTimeout
	): Promise<boolean> {
		const startTime = Date.now()

		return new Promise((resolve) => {
			const check = () => {
				if (document.querySelector(selector)) {
					resolve(true)
					return
				}

				if (Date.now() - startTime >= timeout) {
					resolve(false)
					return
				}

				setTimeout(check, this.config.pollInterval)
			}

			check()
		})
	}

	/**
	 * Wait for text to appear on page
	 */
	async waitForText(
		text: string,
		timeout = this.config.defaultTimeout
	): Promise<boolean> {
		const startTime = Date.now()
		const normalizedText = text.toLowerCase()

		return new Promise((resolve) => {
			const check = () => {
				const pageText = document.body?.innerText?.toLowerCase() || ''
				if (pageText.includes(normalizedText)) {
					resolve(true)
					return
				}

				if (Date.now() - startTime >= timeout) {
					resolve(false)
					return
				}

				setTimeout(check, this.config.pollInterval)
			}

			check()
		})
	}

	/**
	 * Wait for text to disappear from page
	 */
	async waitForTextMissing(
		text: string,
		timeout = this.config.defaultTimeout
	): Promise<boolean> {
		const startTime = Date.now()
		const normalizedText = text.toLowerCase()

		return new Promise((resolve) => {
			const check = () => {
				const pageText = document.body?.innerText?.toLowerCase() || ''
				if (!pageText.includes(normalizedText)) {
					resolve(true)
					return
				}

				if (Date.now() - startTime >= timeout) {
					resolve(false)
					return
				}

				setTimeout(check, this.config.pollInterval)
			}

			check()
		})
	}

	/**
	 * Wait for network to be idle
	 */
	async waitForNetworkIdle(
		idleTime = this.config.networkIdleTime,
		timeout = this.config.defaultTimeout
	): Promise<boolean> {
		const startTime = Date.now()

		return new Promise((resolve) => {
			const check = () => {
				if (this.networkMonitor.isIdle(idleTime)) {
					resolve(true)
					return
				}

				if (Date.now() - startTime >= timeout) {
					resolve(false)
					return
				}

				setTimeout(check, this.config.pollInterval)
			}

			check()
		})
	}

	/**
	 * Wait for DOM to be stable
	 */
	async waitForDOMStable(
		stabilityTime = this.config.domStabilityTime,
		timeout = this.config.defaultTimeout
	): Promise<boolean> {
		const startTime = Date.now()

		try {
			await Promise.race([
				this.domMonitor.waitForStability(stabilityTime),
				new Promise((_, reject) =>
					setTimeout(() => reject(new Error('Timeout')), timeout)
				),
			])
			return true
		} catch {
			return false
		}
	}

	/**
	 * Wait for a custom condition
	 */
	async waitForCondition(
		condition: () => boolean | Promise<boolean>,
		timeout = this.config.defaultTimeout
	): Promise<boolean> {
		const startTime = Date.now()

		return new Promise((resolve) => {
			const check = async () => {
				try {
					const result = await condition()
					if (result) {
						resolve(true)
						return
					}
				} catch (e) {
					// Continue waiting
				}

				if (Date.now() - startTime >= timeout) {
					resolve(false)
					return
				}

				setTimeout(check, this.config.pollInterval)
			}

			check()
		})
	}

	/**
	 * Smart wait after an action - automatically detects what to wait for
	 */
	async smartWait(actionType: string): Promise<void> {
		switch (actionType) {
			case 'click':
				// After click, wait for DOM stable and network idle
				await Promise.all([
					this.waitForDOMStable(),
					this.waitForNetworkIdle(),
				])
				break

			case 'input':
				// After input, just wait for DOM stable (debounced input)
				await this.waitForDOMStable(500)
				break

			case 'navigate':
				// After navigation, wait longer for everything to settle
				await Promise.all([
					this.waitForDOMStable(1000),
					this.waitForNetworkIdle(1000),
				])
				break

			case 'scroll':
				// After scroll, just wait a short time
				await new Promise((resolve) => setTimeout(resolve, 300))
				break

			default:
				// Default: wait for DOM stable
				await this.waitForDOMStable()
		}
	}

	/**
	 * Wait based on a condition object
	 */
	async wait(condition: WaitCondition): Promise<boolean> {
		const timeout = condition.timeout || this.config.defaultTimeout

		switch (condition.type) {
			case 'element_present':
				if (!condition.selector) throw new Error('selector required')
				return this.waitForElement(condition.selector, timeout)

			case 'element_visible':
				if (!condition.selector) throw new Error('selector required')
				return this.waitForCondition(() => {
					const el = document.querySelector(condition.selector!)
					if (!el) return false
					const style = window.getComputedStyle(el as HTMLElement)
					return style.display !== 'none' && style.visibility !== 'hidden'
				}, timeout)

			case 'text_present':
				if (!condition.text) throw new Error('text required')
				return this.waitForText(condition.text, timeout)

			case 'text_missing':
				if (!condition.text) throw new Error('text required')
				return this.waitForTextMissing(condition.text, timeout)

			case 'network_idle':
				return this.waitForNetworkIdle(
					condition.pollInterval || this.config.networkIdleTime,
					timeout
				)

			case 'dom_stable':
				return this.waitForDOMStable(
					condition.pollInterval || this.config.domStabilityTime,
					timeout
				)

			case 'custom':
				if (!condition.customCondition)
					throw new Error('customCondition required')
				return this.waitForCondition(condition.customCondition, timeout)

			default:
				throw new Error(`Unknown wait condition type: ${condition.type}`)
		}
	}

	/**
	 * Get current status of all monitors
	 */
	getStatus(): {
		network: NetworkActivity
		domStable: boolean
		lastMutation: number
	} {
		return {
			network: this.networkMonitor.getActivity(),
			domStable: this.domMonitor.isStable(this.config.domStabilityTime),
			lastMutation: this.domMonitor['lastMutation'],
		}
	}
}
