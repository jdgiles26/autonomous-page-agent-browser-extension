/**
 * Smart Suggestions - Context-aware task suggestions based on page analysis
 * Feature 5: Context-Aware Smart Suggestions
 */

import type { FlatDomTree, InteractiveElementDomNode } from '@page-agent/page-controller'

import type { DetectedPattern, PatternType, SuggestedTask } from './types'
import { normalizeText } from './utils'

export interface SmartSuggestionsConfig {
	minConfidence: number
	maxSuggestions: number
	analyzeForms: boolean
	analyzeNavigation: boolean
	analyzeTables: boolean
}

export const defaultSmartSuggestionsConfig: SmartSuggestionsConfig = {
	minConfidence: 0.6,
	maxSuggestions: 5,
	analyzeForms: true,
	analyzeNavigation: true,
	analyzeTables: true,
}

/**
 * Smart Suggestions - Detect patterns and suggest tasks
 */
export class SmartSuggestions extends EventTarget {
	private config: SmartSuggestionsConfig

	constructor(config: Partial<SmartSuggestionsConfig> = {}) {
		super()
		this.config = { ...defaultSmartSuggestionsConfig, ...config }
	}

	/**
	 * Analyze current page and detect patterns
	 */
	async analyzePage(flatTree: FlatDomTree, url: string): Promise<DetectedPattern[]> {
		const patterns: DetectedPattern[] = []

		if (this.config.analyzeForms) {
			const loginPattern = this.detectLoginForm(flatTree)
			if (loginPattern) patterns.push(loginPattern)

			const searchPattern = this.detectSearchInterface(flatTree)
			if (searchPattern) patterns.push(searchPattern)

			const checkoutPattern = this.detectCheckoutFlow(flatTree)
			if (checkoutPattern) patterns.push(checkoutPattern)

			const formPattern = this.detectGenericForm(flatTree)
			if (formPattern) patterns.push(formPattern)

			const wizardPattern = this.detectWizard(flatTree)
			if (wizardPattern) patterns.push(wizardPattern)
		}

		if (this.config.analyzeNavigation) {
			const navPattern = this.detectNavigation(flatTree)
			if (navPattern) patterns.push(navPattern)

			const filterPattern = this.detectFilterInterface(flatTree)
			if (filterPattern) patterns.push(filterPattern)

			const paginationPattern = this.detectPagination(flatTree)
			if (paginationPattern) patterns.push(paginationPattern)
		}

		if (this.config.analyzeTables) {
			const tablePattern = this.detectDataTable(flatTree)
			if (tablePattern) patterns.push(tablePattern)
		}

		const modalPattern = this.detectModal(flatTree)
		if (modalPattern) patterns.push(modalPattern)

		// Sort by confidence
		return patterns.sort((a, b) => b.confidence - a.confidence)
	}

	/**
	 * Generate suggested tasks based on detected patterns
	 */
	generateSuggestions(patterns: DetectedPattern[]): SuggestedTask[] {
		const suggestions: SuggestedTask[] = []

		for (const pattern of patterns) {
			if (pattern.confidence < this.config.minConfidence) continue

			switch (pattern.type) {
				case 'login':
					suggestions.push({
						id: `suggest-${pattern.type}`,
						title: 'Test Login Flow',
						description: 'Fill in credentials and submit the login form',
						pattern: pattern.type,
						confidence: pattern.confidence,
						icon: '🔐',
						autoExecutable: true,
					})
					break

				case 'search':
					suggestions.push({
						id: `suggest-${pattern.type}`,
						title: 'Test Search',
						description: 'Enter search term and submit search query',
						pattern: pattern.type,
						confidence: pattern.confidence,
						icon: '🔍',
						autoExecutable: true,
					})
					break

				case 'checkout':
					suggestions.push({
						id: `suggest-${pattern.type}`,
						title: 'Test Checkout Flow',
						description: 'Complete the checkout process step by step',
						pattern: pattern.type,
						confidence: pattern.confidence,
						icon: '🛒',
						autoExecutable: false,
					})
					break

				case 'form':
					suggestions.push({
						id: `suggest-${pattern.type}`,
						title: 'Fill Form',
						description: 'Fill in all form fields with test data',
						pattern: pattern.type,
						confidence: pattern.confidence,
						icon: '📝',
						autoExecutable: true,
					})
					break

				case 'data_table':
					suggestions.push({
						id: `suggest-${pattern.type}`,
						title: 'Extract Table Data',
						description: 'Extract all data from the table',
						pattern: pattern.type,
						confidence: pattern.confidence,
						icon: '📊',
						autoExecutable: true,
					})
					suggestions.push({
						id: `suggest-${pattern.type}-sort`,
						title: 'Test Table Sorting',
						description: 'Click column headers to test sorting functionality',
						pattern: pattern.type,
						confidence: pattern.confidence * 0.8,
						icon: '🔃',
						autoExecutable: true,
					})
					break

				case 'navigation':
					suggestions.push({
						id: `suggest-${pattern.type}`,
						title: 'Explore Navigation',
						description: 'Click through main navigation links',
						pattern: pattern.type,
						confidence: pattern.confidence,
						icon: '🧭',
						autoExecutable: true,
					})
					break

				case 'modal':
					suggestions.push({
						id: `suggest-${pattern.type}`,
						title: 'Test Modal Dialog',
						description: 'Open modal and test close functionality',
						pattern: pattern.type,
						confidence: pattern.confidence,
						icon: '🪟',
						autoExecutable: true,
					})
					break

				case 'wizard':
					suggestions.push({
						id: `suggest-${pattern.type}`,
						title: 'Complete Wizard',
						description: 'Navigate through all wizard steps',
						pattern: pattern.type,
						confidence: pattern.confidence,
						icon: '🧙',
						autoExecutable: true,
					})
					break

				case 'filter':
					suggestions.push({
						id: `suggest-${pattern.type}`,
						title: 'Test Filters',
						description: 'Apply various filters and verify results',
						pattern: pattern.type,
						confidence: pattern.confidence,
						icon: '🔧',
						autoExecutable: true,
					})
					break

				case 'pagination':
					suggestions.push({
						id: `suggest-${pattern.type}`,
						title: 'Test Pagination',
						description: 'Navigate through paginated results',
						pattern: pattern.type,
						confidence: pattern.confidence,
						icon: '📄',
						autoExecutable: true,
					})
					break
			}
		}

		// Sort by confidence and limit
		return suggestions
			.sort((a, b) => b.confidence - a.confidence)
			.slice(0, this.config.maxSuggestions)
	}

	/**
	 * Detect login forms
	 */
	private detectLoginForm(flatTree: FlatDomTree): DetectedPattern | null {
		const passwordInputs: InteractiveElementDomNode[] = []
		const emailInputs: InteractiveElementDomNode[] = []
		const submitButtons: InteractiveElementDomNode[] = []

		for (const node of Object.values(flatTree.map)) {
			if (!node.ref) continue

			// Look for password inputs
			if (
				node.ref.tagName.toLowerCase() === 'input' &&
				(node.ref as HTMLInputElement).type === 'password'
			) {
				passwordInputs.push(node as InteractiveElementDomNode)
			}

			// Look for email/username inputs
			if (node.ref.tagName.toLowerCase() === 'input') {
				const input = node.ref as HTMLInputElement
				const type = input.type
				const placeholder = input.placeholder?.toLowerCase() || ''
				const ariaLabel = input.getAttribute('aria-label')?.toLowerCase() || ''

				if (
					type === 'email' ||
					placeholder.includes('email') ||
					placeholder.includes('username') ||
					ariaLabel.includes('email') ||
					ariaLabel.includes('username')
				) {
					emailInputs.push(node as InteractiveElementDomNode)
				}
			}

			// Look for submit buttons
			if (
				node.ref.tagName.toLowerCase() === 'button' ||
				(node.ref.tagName.toLowerCase() === 'input' &&
					(node.ref as HTMLInputElement).type === 'submit')
			) {
				const text = normalizeText(node.ref.textContent || '')
				if (
					text.includes('login') ||
					text.includes('sign in') ||
					text.includes('log in') ||
					node.ref.getAttribute('type') === 'submit'
				) {
					submitButtons.push(node as InteractiveElementDomNode)
				}
			}
		}

		if (passwordInputs.length > 0 && (emailInputs.length > 0 || submitButtons.length > 0)) {
			const elements = [...passwordInputs, ...emailInputs, ...submitButtons].slice(0, 5)

			return {
				type: 'login',
				confidence: Math.min(0.95, 0.6 + passwordInputs.length * 0.1 + emailInputs.length * 0.1),
				elements: elements.map((e) => ({
					index: e.highlightIndex,
					role: e.ref?.tagName.toLowerCase() || 'unknown',
					description: this.getElementDescription(e),
				})),
				suggestedActions: ['Fill credentials', 'Submit form', 'Test validation'],
			}
		}

		return null
	}

	/**
	 * Detect search interfaces
	 */
	private detectSearchInterface(flatTree: FlatDomTree): DetectedPattern | null {
		const searchInputs: InteractiveElementDomNode[] = []
		const searchButtons: InteractiveElementDomNode[] = []

		for (const node of Object.values(flatTree.map)) {
			if (!node.ref) continue

			// Look for search inputs
			if (node.ref.tagName.toLowerCase() === 'input') {
				const input = node.ref as HTMLInputElement
				const type = input.type
				const placeholder = input.placeholder?.toLowerCase() || ''
				const ariaLabel = input.getAttribute('aria-label')?.toLowerCase() || ''
				const name = input.name?.toLowerCase() || ''

				if (
					type === 'search' ||
					placeholder.includes('search') ||
					ariaLabel.includes('search') ||
					name.includes('search')
				) {
					searchInputs.push(node as InteractiveElementDomNode)
				}
			}

			// Look for search buttons
			const text = normalizeText(node.ref.textContent || '')
			if (
				text.includes('search') ||
				node.ref.getAttribute('aria-label')?.toLowerCase().includes('search')
			) {
				searchButtons.push(node as InteractiveElementDomNode)
			}
		}

		if (searchInputs.length > 0) {
			const elements = [...searchInputs, ...searchButtons].slice(0, 3)

			return {
				type: 'search',
				confidence: Math.min(0.95, 0.7 + searchInputs.length * 0.1),
				elements: elements.map((e) => ({
					index: e.highlightIndex,
					role: e.ref?.tagName.toLowerCase() || 'unknown',
					description: this.getElementDescription(e),
				})),
				suggestedActions: ['Enter search term', 'Submit search', 'Clear search'],
			}
		}

		return null
	}

	/**
	 * Detect checkout flows
	 */
	private detectCheckoutFlow(flatTree: FlatDomTree): DetectedPattern | null {
		let hasCartElements = false
		let hasPaymentElements = false
		let hasAddressElements = false

		for (const node of Object.values(flatTree.map)) {
			if (!node.ref) continue

			const text = normalizeText(node.ref.textContent || '')
			const className = node.ref.className.toLowerCase()

			if (
				text.includes('checkout') ||
				text.includes('cart') ||
				className.includes('checkout') ||
				className.includes('cart')
			) {
				hasCartElements = true
			}

			if (
				text.includes('payment') ||
				text.includes('credit card') ||
				className.includes('payment')
			) {
				hasPaymentElements = true
			}

			if (
				text.includes('shipping') ||
				text.includes('address') ||
				className.includes('shipping')
			) {
				hasAddressElements = true
			}
		}

		if (hasCartElements && (hasPaymentElements || hasAddressElements)) {
			return {
				type: 'checkout',
				confidence: 0.85,
				elements: [],
				suggestedActions: ['Fill shipping info', 'Enter payment details', 'Complete order'],
			}
		}

		return null
	}

	/**
	 * Detect generic forms
	 */
	private detectGenericForm(flatTree: FlatDomTree): DetectedPattern | null {
		const inputs: InteractiveElementDomNode[] = []
		let hasSubmit = false

		for (const node of Object.values(flatTree.map)) {
			if (!node.ref) continue

			if (
				node.ref.tagName.toLowerCase() === 'input' ||
				node.ref.tagName.toLowerCase() === 'textarea' ||
				node.ref.tagName.toLowerCase() === 'select'
			) {
				inputs.push(node as InteractiveElementDomNode)
			}

			if (
				node.ref.tagName.toLowerCase() === 'button' &&
				(node.ref as HTMLButtonElement).type === 'submit'
			) {
				hasSubmit = true
			}
		}

		if (inputs.length >= 2) {
			return {
				type: 'form',
				confidence: Math.min(0.9, 0.5 + inputs.length * 0.05),
				elements: inputs.slice(0, 5).map((e) => ({
					index: e.highlightIndex,
					role: e.ref?.tagName.toLowerCase() || 'unknown',
					description: this.getElementDescription(e),
				})),
				suggestedActions: ['Fill all fields', 'Submit form', 'Test validation'],
			}
		}

		return null
	}

	/**
	 * Detect data tables
	 */
	private detectDataTable(flatTree: FlatDomTree): DetectedPattern | null {
		const tables: InteractiveElementDomNode[] = []

		for (const node of Object.values(flatTree.map)) {
			if (!node.ref) continue

			if (node.ref.tagName.toLowerCase() === 'table') {
				tables.push(node as InteractiveElementDomNode)
			}
		}

		if (tables.length > 0) {
			return {
				type: 'data_table',
				confidence: Math.min(0.95, 0.7 + tables.length * 0.1),
				elements: tables.slice(0, 2).map((e) => ({
					index: e.highlightIndex,
					role: 'table',
					description: this.getElementDescription(e),
				})),
				suggestedActions: ['Extract data', 'Test sorting', 'Test pagination'],
			}
		}

		return null
	}

	/**
	 * Detect navigation
	 */
	private detectNavigation(flatTree: FlatDomTree): DetectedPattern | null {
		const navElements: InteractiveElementDomNode[] = []

		for (const node of Object.values(flatTree.map)) {
			if (!node.ref) continue

			const tagName = node.ref.tagName.toLowerCase()
			const role = node.ref.getAttribute('role')

			if (
				tagName === 'nav' ||
				role === 'navigation' ||
				node.ref.className.toLowerCase().includes('nav') ||
				node.ref.className.toLowerCase().includes('menu')
			) {
				navElements.push(node as InteractiveElementDomNode)
			}
		}

		if (navElements.length > 0) {
			return {
				type: 'navigation',
				confidence: Math.min(0.9, 0.6 + navElements.length * 0.05),
				elements: navElements.slice(0, 3).map((e) => ({
					index: e.highlightIndex,
					role: 'navigation',
					description: this.getElementDescription(e),
				})),
				suggestedActions: ['Click navigation links', 'Test dropdown menus'],
			}
		}

		return null
	}

	/**
	 * Detect modals
	 */
	private detectModal(flatTree: FlatDomTree): DetectedPattern | null {
		const modalTriggers: InteractiveElementDomNode[] = []

		for (const node of Object.values(flatTree.map)) {
			if (!node.ref) continue

			const text = normalizeText(node.ref.textContent || '')
			const ariaHasPopup = node.ref.getAttribute('aria-haspopup')
			const dataToggle = node.ref.getAttribute('data-toggle')

			if (
				text.includes('open') ||
				text.includes('show') ||
				ariaHasPopup === 'dialog' ||
				dataToggle === 'modal'
			) {
				modalTriggers.push(node as InteractiveElementDomNode)
			}
		}

		if (modalTriggers.length > 0) {
			return {
				type: 'modal',
				confidence: Math.min(0.8, 0.5 + modalTriggers.length * 0.1),
				elements: modalTriggers.slice(0, 2).map((e) => ({
					index: e.highlightIndex,
					role: 'button',
					description: this.getElementDescription(e),
				})),
				suggestedActions: ['Open modal', 'Close modal', 'Test modal interactions'],
			}
		}

		return null
	}

	/**
	 * Detect wizard/stepper
	 */
	private detectWizard(flatTree: FlatDomTree): DetectedPattern | null {
		let stepIndicators = 0
		let hasNextButton = false
		let hasPrevButton = false

		for (const node of Object.values(flatTree.map)) {
			if (!node.ref) continue

			const text = normalizeText(node.ref.textContent || '')
			const className = node.ref.className.toLowerCase()

			if (
				className.includes('step') ||
				className.includes('wizard') ||
				node.ref.getAttribute('role') === 'tab'
			) {
				stepIndicators++
			}

			if (text.includes('next') || text.includes('continue')) {
				hasNextButton = true
			}

			if (text.includes('previous') || text.includes('back')) {
				hasPrevButton = true
			}
		}

		if (stepIndicators >= 2 && hasNextButton) {
			return {
				type: 'wizard',
				confidence: 0.8,
				elements: [],
				suggestedActions: ['Go to next step', 'Go to previous step', 'Complete wizard'],
			}
		}

		return null
	}

	/**
	 * Detect filter interfaces
	 */
	private detectFilterInterface(flatTree: FlatDomTree): DetectedPattern | null {
		const filters: InteractiveElementDomNode[] = []

		for (const node of Object.values(flatTree.map)) {
			if (!node.ref) continue

			const text = normalizeText(node.ref.textContent || '')
			const className = node.ref.className.toLowerCase()
			const ariaLabel = node.ref.getAttribute('aria-label')?.toLowerCase() || ''

			if (
				className.includes('filter') ||
				ariaLabel.includes('filter') ||
				text.includes('filter by') ||
				text.includes('sort by')
			) {
				filters.push(node as InteractiveElementDomNode)
			}
		}

		if (filters.length >= 2) {
			return {
				type: 'filter',
				confidence: Math.min(0.85, 0.5 + filters.length * 0.05),
				elements: filters.slice(0, 4).map((e) => ({
					index: e.highlightIndex,
					role: e.ref?.tagName.toLowerCase() || 'unknown',
					description: this.getElementDescription(e),
				})),
				suggestedActions: ['Apply filters', 'Clear filters', 'Sort results'],
			}
		}

		return null
	}

	/**
	 * Detect pagination
	 */
	private detectPagination(flatTree: FlatDomTree): DetectedPattern | null {
		const pageLinks: InteractiveElementDomNode[] = []

		for (const node of Object.values(flatTree.map)) {
			if (!node.ref) continue

			const className = node.ref.className.toLowerCase()
			const ariaLabel = node.ref.getAttribute('aria-label')?.toLowerCase() || ''

			if (
				className.includes('pagination') ||
				className.includes('page') ||
				ariaLabel.includes('page')
			) {
				pageLinks.push(node as InteractiveElementDomNode)
			}
		}

		if (pageLinks.length >= 3) {
			return {
				type: 'pagination',
				confidence: Math.min(0.9, 0.5 + pageLinks.length * 0.05),
				elements: pageLinks.slice(0, 5).map((e) => ({
					index: e.highlightIndex,
					role: 'link',
					description: this.getElementDescription(e),
				})),
				suggestedActions: ['Go to next page', 'Go to previous page', 'Go to last page'],
			}
		}

		return null
	}

	/**
	 * Get element description
	 */
	private getElementDescription(element: InteractiveElementDomNode): string {
		if (!element.ref) return 'unknown'

		const parts: string[] = []

		// Text content
		const text = normalizeText(element.ref.textContent || '')
		if (text) {
			parts.push(text.substring(0, 30))
		}

		// Aria label
		const ariaLabel = element.ref.getAttribute('aria-label')
		if (ariaLabel) {
			parts.push(`[${ariaLabel}]`)
		}

		return parts.join(' ') || 'unnamed element'
	}
}
