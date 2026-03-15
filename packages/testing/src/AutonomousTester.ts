/**
 * Autonomous Tester - End-to-end autonomous web testing engine
 */

import type { PageAgent } from '@page-agent/core'
import type { FlatDomTree } from '@page-agent/page-controller'

import type {
	AIFinding,
	AIReport,
	DetectedPattern,
	ExtractionSchema,
	Playbook,
	TestConfig,
	TestExecutionResult,
	TestFinding,
	TestPlan,
	TestResult,
} from './types'
import { AdaptiveWait } from './AdaptiveWait'
import { DataExtractor } from './DataExtractor'
import { DOMDiff } from './DOMDiff'
import { ElementEmbeddings } from './ElementEmbeddings'
import { PlaybookRecorder } from './PlaybookRecorder'
import { SelfHealingSelector } from './SelfHealingSelector'
import { SmartSuggestions } from './SmartSuggestions'
import { VisualDiff } from './VisualDiff'
import { formatDuration, uid } from './utils'
import { AIReportGenerator } from './reporters/AIReportGenerator'
import { PlaywrightGenerator } from './reporters/PlaywrightGenerator'

export interface AutonomousTesterConfig {
	pageAgent: PageAgent
	testConfig: TestConfig
}

/**
 * Autonomous Tester - Main testing orchestrator
 */
export class AutonomousTester extends EventTarget {
	private pageAgent: PageAgent
	private config: TestConfig
	private playbookRecorder: PlaybookRecorder
	private selfHealing: SelfHealingSelector
	private adaptiveWait: AdaptiveWait
	private visualDiff: VisualDiff
	private domDiff: DOMDiff
	private dataExtractor: DataExtractor
	private smartSuggestions: SmartSuggestions
	private elementEmbeddings: ElementEmbeddings
	private aiReportGenerator: AIReportGenerator
	private playwrightGenerator: PlaywrightGenerator

	private findings: TestFinding[] = []
	private playbooks: Playbook[] = []
	private isRunning = false
	private abortController = new AbortController()

	constructor(config: AutonomousTesterConfig) {
		super()
		this.pageAgent = config.pageAgent
		this.config = config.testConfig

		// Initialize components
		this.playbookRecorder = new PlaybookRecorder(this.pageAgent['pageController'])
		this.selfHealing = new SelfHealingSelector()
		this.adaptiveWait = new AdaptiveWait()
		this.visualDiff = new VisualDiff()
		this.domDiff = new DOMDiff()
		this.dataExtractor = new DataExtractor()
		this.smartSuggestions = new SmartSuggestions()
		this.elementEmbeddings = new ElementEmbeddings()
		this.aiReportGenerator = new AIReportGenerator()
		this.playwrightGenerator = new PlaywrightGenerator()
	}

	/**
	 * Run the autonomous test
	 */
	async run(): Promise<TestResult> {
		if (this.isRunning) {
			throw new Error('Test is already running')
		}

		this.isRunning = true
		this.findings = []
		this.playbooks = []
		this.abortController = new AbortController()

		const startTime = Date.now()
		const testId = uid()

		this.dispatchEvent(
			new CustomEvent('test:start', {
				detail: { testId, config: this.config },
			})
		)

		try {
			// Initialize
			await this.initialize()

			// Phase 1: Explore
			const exploration = await this.explore()

			// Phase 2: Plan tests
			const testPlans = await this.planTests(exploration)

			// Phase 3: Execute tests
			const executionResults = await this.executeTests(testPlans)

			// Phase 4: Generate report
			const result = await this.generateReport(
				testId,
				startTime,
				exploration,
				executionResults
			)

			this.dispatchEvent(
				new CustomEvent('test:complete', {
					detail: { result },
				})
			)

			return result
		} catch (error) {
			const failedResult = await this.generateReport(
				testId,
				startTime,
				{ patterns: [], elements: [], url: this.config.targetUrl },
				[],
				error as Error
			)

			this.dispatchEvent(
				new CustomEvent('test:error', {
					detail: { error, result: failedResult },
				})
			)

			return failedResult
		} finally {
			this.isRunning = false
			this.cleanup()
		}
	}

	/**
	 * Stop the test
	 */
	stop(): void {
		this.abortController.abort()
		this.isRunning = false
	}

	/**
	 * Initialize testing environment
	 */
	private async initialize(): Promise<void> {
		// Navigate to target URL
		if (window.location.href !== this.config.targetUrl) {
			window.location.href = this.config.targetUrl
			await this.adaptiveWait.waitForNetworkIdle()
		}

		// Initialize components
		this.adaptiveWait.initialize()
		await this.elementEmbeddings.initialize()

		// Wait for page to be ready
		await this.adaptiveWait.waitForDOMStable()
	}

	/**
	 * Phase 1: Explore the page
	 */
	private async explore(): Promise<{
		patterns: DetectedPattern[]
		elements: Array<{ index: number; description: string }>
		url: string
	}> {
		this.dispatchEvent(new CustomEvent('test:phase', { detail: { phase: 'explore' } }))

		// Get page state
		const browserState = await this.pageAgent['pageController'].getBrowserState()
		const flatTree = await this.pageAgent['pageController']['updateTree']()

		// Analyze page patterns
		const patterns = await this.smartSuggestions.analyzePage(flatTree, window.location.href)

		// Collect interactive elements
		const elements: Array<{ index: number; description: string }> = []
		for (const node of Object.values(flatTree.map)) {
			if (node.isInteractive && typeof node.highlightIndex === 'number') {
				elements.push({
					index: node.highlightIndex,
					description: this.getElementDescription(node as any),
				})
			}
		}

		this.dispatchEvent(
			new CustomEvent('test:exploration', {
				detail: { patterns, elementCount: elements.length },
			})
		)

		return { patterns, elements, url: window.location.href }
	}

	/**
	 * Phase 2: Plan tests based on exploration
	 */
	private async planTests(exploration: {
		patterns: DetectedPattern[]
		elements: Array<{ index: number; description: string }>
		url: string
	}): Promise<TestPlan[]> {
		this.dispatchEvent(new CustomEvent('test:phase', { detail: { phase: 'plan' } }))

		const plans: TestPlan[] = []

		// Generate suggestions from patterns
		const suggestions = this.smartSuggestions.generateSuggestions(exploration.patterns)

		for (const suggestion of suggestions) {
			if (!suggestion.autoExecutable) continue

			const plan: TestPlan = {
				id: uid(),
				name: suggestion.title,
				description: suggestion.description,
				priority: Math.floor(suggestion.confidence * 100),
				pattern: suggestion.pattern,
				expectedResult: `Successfully ${suggestion.description.toLowerCase()}`,
				steps: [], // Will be populated during execution
			}

			plans.push(plan)
		}

		// Add generic exploration plan
		plans.push({
			id: uid(),
			name: 'Page Exploration',
			description: 'Explore all interactive elements on the page',
			priority: 50,
			expectedResult: 'All interactive elements are accessible and functional',
			steps: [],
		})

		// Sort by priority
		plans.sort((a, b) => b.priority - a.priority)

		this.dispatchEvent(
			new CustomEvent('test:plans', {
				detail: { planCount: plans.length },
			})
		)

		return plans
	}

	/**
	 * Phase 3: Execute test plans
	 */
	private async executeTests(plans: TestPlan[]): Promise<TestExecutionResult[]> {
		this.dispatchEvent(new CustomEvent('test:phase', { detail: { phase: 'execute' } }))

		const results: TestExecutionResult[] = []
		const maxDuration = this.config.maxDuration
		const startTime = Date.now()

		for (const plan of plans) {
			// Check timeout
			if (Date.now() - startTime > maxDuration) {
				this.addFinding({
					severity: 'warning',
					category: 'performance',
					title: 'Test Timeout',
					description: `Test execution exceeded maximum duration of ${formatDuration(maxDuration)}`,
					reproduction: [],
					evidence: { screenshots: [], domSnapshots: [], consoleLogs: [] },
				})
				break
			}

			// Check abort
			if (this.abortController.signal.aborted) {
				break
			}

			const result = await this.executeTestPlan(plan)
			results.push(result)

			this.dispatchEvent(
				new CustomEvent('test:step', {
					detail: { plan: plan.name, status: result.status },
				})
			)
		}

		return results
	}

	/**
	 * Execute a single test plan
	 */
	private async executeTestPlan(plan: TestPlan): Promise<TestExecutionResult> {
		const startTime = Date.now()
		const planFindings: TestFinding[] = []

		// Start recording
		this.playbookRecorder.startRecording(plan.name)

		try {
			// Execute based on pattern
			switch (plan.pattern) {
				case 'login':
					await this.executeLoginTest(plan)
					break
				case 'search':
					await this.executeSearchTest(plan)
					break
				case 'form':
					await this.executeFormTest(plan)
					break
				case 'navigation':
					await this.executeNavigationTest(plan)
					break
				default:
					await this.executeExplorationTest(plan)
			}

			// Check for visual changes
			const visualChanges = await this.checkVisualChanges()
			if (visualChanges) {
				planFindings.push({
					id: uid(),
					severity: 'info',
					category: 'ui',
					title: 'Visual Changes Detected',
					description: 'The test caused visual changes to the page',
					reproduction: [],
					evidence: {
						screenshots: visualChanges.screenshots,
						domSnapshots: [],
						consoleLogs: [],
					},
				})
			}

			const playbook = this.playbookRecorder.stopRecording()
			this.playbooks.push(playbook)

			return {
				planId: plan.id,
				status: 'passed',
				startTime,
				endTime: Date.now(),
				duration: Date.now() - startTime,
				stepsExecuted: playbook.steps.length,
				findings: planFindings,
				playbook,
			}
		} catch (error) {
			const playbook = this.playbookRecorder.stopRecording()
			this.playbooks.push(playbook)

			const finding: TestFinding = {
				id: uid(),
				severity: 'error',
				category: 'functional',
				title: `Test Failed: ${plan.name}`,
				description: (error as Error).message,
				reproduction: playbook.steps,
				evidence: {
					screenshots: [],
					domSnapshots: [],
					consoleLogs: [],
				},
			}

			planFindings.push(finding)
			this.findings.push(finding)

			return {
				planId: plan.id,
				status: 'failed',
				startTime,
				endTime: Date.now(),
				duration: Date.now() - startTime,
				stepsExecuted: playbook.steps.length,
				findings: planFindings,
				playbook,
			}
		}
	}

	/**
	 * Execute login test
	 */
	private async executeLoginTest(plan: TestPlan): Promise<void> {
		// Find login form elements
		const flatTree = await this.pageAgent['pageController']['updateTree']()

		// Find email/username input
		const emailResult = await this.elementEmbeddings.findElement(
			'email input field',
			flatTree,
			0.6
		)

		if (emailResult) {
			await this.clickElement(emailResult.index)
			await this.inputText(emailResult.index, 'test@example.com')
		}

		// Find password input
		const passwordResult = await this.elementEmbeddings.findElement(
			'password input field',
			flatTree,
			0.6
		)

		if (passwordResult) {
			await this.clickElement(passwordResult.index)
			await this.inputText(passwordResult.index, 'TestPassword123')
		}

		// Find submit button
		const submitResult = await this.elementEmbeddings.findElement(
			'login button submit',
			flatTree,
			0.6
		)

		if (submitResult) {
			await this.clickElement(submitResult.index)
			await this.adaptiveWait.smartWait('click')
		}
	}

	/**
	 * Execute search test
	 */
	private async executeSearchTest(plan: TestPlan): Promise<void> {
		const flatTree = await this.pageAgent['pageController']['updateTree']()

		// Find search input
		const searchResult = await this.elementEmbeddings.findElement(
			'search input field',
			flatTree,
			0.6
		)

		if (searchResult) {
			await this.clickElement(searchResult.index)
			await this.inputText(searchResult.index, 'test query')
		}

		// Find search button or submit
		const submitResult = await this.elementEmbeddings.findElement(
			'search button submit',
			flatTree,
			0.5
		)

		if (submitResult) {
			await this.clickElement(submitResult.index)
			await this.adaptiveWait.smartWait('click')
		}
	}

	/**
	 * Execute form test
	 */
	private async executeFormTest(plan: TestPlan): Promise<void> {
		const flatTree = await this.pageAgent['pageController']['updateTree']()

		// Find all input fields
		const inputs: Array<{ index: number; type: string }> = []

		for (const node of Object.values(flatTree.map)) {
			if (!node.ref) continue

			if (node.ref.tagName.toLowerCase() === 'input') {
				const inputType = (node.ref as HTMLInputElement).type
				if (node.highlightIndex !== undefined) {
					inputs.push({ index: node.highlightIndex, type: inputType })
				}
			}
		}

		// Fill each input
		for (const input of inputs) {
			const value = this.generateTestValue(input.type)
			await this.clickElement(input.index)
			await this.inputText(input.index, value)
		}

		// Find and click submit
		const submitResult = await this.elementEmbeddings.findElement(
			'submit button',
			flatTree,
			0.5
		)

		if (submitResult) {
			await this.clickElement(submitResult.index)
			await this.adaptiveWait.smartWait('click')
		}
	}

	/**
	 * Execute navigation test
	 */
	private async executeNavigationTest(plan: TestPlan): Promise<void> {
		const flatTree = await this.pageAgent['pageController']['updateTree']()

		// Find navigation links
		const links: number[] = []

		for (const node of Object.values(flatTree.map)) {
			if (!node.ref) continue

			if (node.ref.tagName.toLowerCase() === 'a') {
				const href = (node.ref as HTMLAnchorElement).href
				// Only internal links
				if (href && href.startsWith(window.location.origin)) {
					if (node.highlightIndex !== undefined) {
						links.push(node.highlightIndex)
					}
				}
			}
		}

		// Click first few links
		for (const index of links.slice(0, 3)) {
			await this.clickElement(index)
			await this.adaptiveWait.smartWait('navigate')

			// Go back
			window.history.back()
			await this.adaptiveWait.waitForDOMStable()
		}
	}

	/**
	 * Execute exploration test
	 */
	private async executeExplorationTest(plan: TestPlan): Promise<void> {
		const flatTree = await this.pageAgent['pageController']['updateTree']()

		// Click on interactive elements
		const interactiveElements: number[] = []

		for (const node of Object.values(flatTree.map)) {
			if (node.isInteractive && typeof node.highlightIndex === 'number') {
				interactiveElements.push(node.highlightIndex)
			}
		}

		// Sample elements to test
		const sampleSize = Math.min(5, interactiveElements.length)
		const samples = interactiveElements.slice(0, sampleSize)

		for (const index of samples) {
			try {
				await this.clickElement(index)
				await this.adaptiveWait.smartWait('click')
			} catch (e) {
				// Continue with next element
			}
		}
	}

	/**
	 * Check for visual changes
	 */
	private async checkVisualChanges(): Promise<{ screenshots: string[] } | null> {
		// This would capture before/after screenshots
		// For now, return null
		return null
	}

	/**
	 * Generate test value based on input type
	 */
	private generateTestValue(type: string): string {
		switch (type) {
			case 'email':
				return 'test@example.com'
			case 'password':
				return 'TestPassword123'
			case 'tel':
				return '555-123-4567'
			case 'number':
				return '42'
			case 'date':
				return '2024-01-01'
			case 'url':
				return 'https://example.com'
			default:
				return 'Test Value'
		}
	}

	/**
	 * Click element with self-healing
	 */
	private async clickElement(index: number): Promise<void> {
		// Cache fingerprint before action
		const flatTree = await this.pageAgent['pageController']['updateTree']()
		this.selfHealing.cacheFingerprint(index, flatTree)

		try {
			await this.pageAgent['pageController'].clickElement(index)
			await this.playbookRecorder.recordClick(index)
		} catch (error) {
			// Try self-healing
			const healed = await this.selfHealing.healSelector(index, flatTree)
			if (healed) {
				await this.pageAgent['pageController'].clickElement(healed.index)
				await this.playbookRecorder.recordClick(healed.index, `healed from ${index}`)
			} else {
				throw error
			}
		}
	}

	/**
	 * Input text with self-healing
	 */
	private async inputText(index: number, text: string): Promise<void> {
		const flatTree = await this.pageAgent['pageController']['updateTree']()
		this.selfHealing.cacheFingerprint(index, flatTree)

		try {
			await this.pageAgent['pageController'].inputText(index, text)
			await this.playbookRecorder.recordInput(index, text)
		} catch (error) {
			const healed = await this.selfHealing.healSelector(index, flatTree)
			if (healed) {
				await this.pageAgent['pageController'].inputText(healed.index, text)
				await this.playbookRecorder.recordInput(healed.index, text, `healed from ${index}`)
			} else {
				throw error
			}
		}
	}

	/**
	 * Phase 4: Generate test report
	 */
	private async generateReport(
		testId: string,
		startTime: number,
		exploration: { patterns: DetectedPattern[]; elements: Array<{ index: number; description: string }>; url: string },
		executionResults: TestExecutionResult[],
		error?: Error
	): Promise<TestResult> {
		this.dispatchEvent(new CustomEvent('test:phase', { detail: { phase: 'report' } }))

		const endTime = Date.now()
		const duration = endTime - startTime

		// Calculate coverage
		const elementsInteracted = new Set<number>()
		const pagesVisited = new Set<string>([window.location.href])
		const formsTested: string[] = []
		const patternsTested: DetectedPattern['type'][] = []

		for (const result of executionResults) {
			if (result.playbook) {
				for (const step of result.playbook.steps) {
					if (step.target?.index !== undefined) {
						elementsInteracted.add(step.target.index)
					}
				}
			}
			if (result.status === 'passed') {
				patternsTested.push(exploration.patterns.find((p) => p.type === result.planId)?.type!)
			}
		}

		// Calculate coverage percentage
		const coverage = exploration.elements.length > 0
			? (elementsInteracted.size / exploration.elements.length) * 100
			: 0

		// Count findings by severity
		const findingsBySeverity: Record<string, number> = {}
		for (const finding of this.findings) {
			findingsBySeverity[finding.severity] = (findingsBySeverity[finding.severity] || 0) + 1
		}

		// Generate AI report
		const aiReport = this.aiReportGenerator.generate({
			summary: {
				totalTests: executionResults.length,
				passed: executionResults.filter((r) => r.status === 'passed').length,
				failed: executionResults.filter((r) => r.status === 'failed').length,
				skipped: executionResults.filter((r) => r.status === 'skipped').length,
				duration,
				coverage,
				findingsBySeverity,
			},
			findings: this.findings.map((f) => this.enhanceFindingForAI(f)),
			context: {
				pageStructure: this.generatePageStructureDescription(exploration),
				interactiveElements: exploration.elements,
				knownIssues: this.findings.filter((f) => f.severity === 'error' || f.severity === 'critical').map((f) => f.title),
				testPatterns: patternsTested.filter(Boolean),
				urlsVisited: Array.from(pagesVisited),
			},
			recommendations: this.generateRecommendations(),
			raw: {
				allSteps: this.playbooks.flatMap((p) => p.steps),
				allDiffs: [],
				consoleLogs: [],
				networkLogs: [],
			},
		})

		// Generate Playwright tests
		const playwrightTests = this.config.generatePlaywright
			? this.playbooks.map((p) => this.playwrightGenerator.generateTest(p))
			: []

		// Determine overall status
		let status: TestResult['status'] = 'passed'
		if (error) {
			status = 'failed'
		} else if (executionResults.some((r) => r.status === 'failed')) {
			status = 'partial'
		}

		return {
			id: testId,
			config: this.config,
			startTime,
			endTime,
			status,
			coverage: {
				pagesVisited: Array.from(pagesVisited),
				elementsInteracted: Array.from(elementsInteracted),
				formsTested,
				patternsTested: patternsTested.filter(Boolean),
			},
			findings: this.findings,
			playwrightTests,
			aiReport,
			playbooks: this.playbooks,
		}
	}

	/**
	 * Enhance finding with AI context
	 */
	private enhanceFindingForAI(finding: TestFinding): AIFinding {
		return {
			...finding,
			aiContext: {
				likelyCause: this.analyzeLikelyCause(finding),
				suggestedFilesToCheck: this.suggestFilesToCheck(finding),
				suggestedCodePattern: this.suggestCodePattern(finding),
				confidence: 0.7,
			},
		}
	}

	/**
	 * Analyze likely cause of finding
	 */
	private analyzeLikelyCause(finding: TestFinding): string {
		// Simple heuristic analysis
		if (finding.category === 'functional') {
			return 'Element may have changed position or attributes since test was recorded'
		}
		if (finding.category === 'ui') {
			return 'Visual regression or styling issue'
		}
		if (finding.category === 'performance') {
			return 'Network latency or resource loading issue'
		}
		return 'Unknown cause - requires manual investigation'
	}

	/**
	 * Suggest files to check
	 */
	private suggestFilesToCheck(finding: TestFinding): string[] {
		const suggestions: string[] = []

		if (finding.category === 'functional') {
			suggestions.push('Component files related to the failing element')
			suggestions.push('Event handler definitions')
		}
		if (finding.category === 'ui') {
			suggestions.push('CSS/SCSS files')
			suggestions.push('Component styling')
		}

		return suggestions
	}

	/**
	 * Suggest code pattern for fix
	 */
	private suggestCodePattern(finding: TestFinding): string {
		if (finding.category === 'functional') {
			return 'Add data-testid attributes for more stable selectors'
		}
		return 'Review and update test assertions'
	}

	/**
	 * Generate recommendations
	 */
	private generateRecommendations(): AIReport['recommendations'] {
		const recommendations: AIReport['recommendations'] = []

		if (this.findings.some((f) => f.severity === 'critical')) {
			recommendations.push({
				priority: 1,
				title: 'Address Critical Issues',
				description: 'Fix critical issues before deploying to production',
				relatedFindings: this.findings.filter((f) => f.severity === 'critical').map((f) => f.id),
			})
		}

		if (this.selfHealing.getStats().attempts > 5) {
			recommendations.push({
				priority: 2,
				title: 'Improve Element Stability',
				description: 'Multiple elements required self-healing. Consider adding stable selectors.',
				relatedFindings: [],
			})
		}

		return recommendations
	}

	/**
	 * Generate page structure description
	 */
	private generatePageStructureDescription(exploration: {
		patterns: DetectedPattern[]
		elements: Array<{ index: number; description: string }>
	}): string {
		const parts: string[] = []

		parts.push(`Page contains ${exploration.elements.length} interactive elements`)

		for (const pattern of exploration.patterns) {
			parts.push(`Detected ${pattern.type} pattern (${(pattern.confidence * 100).toFixed(0)}% confidence)`)
		}

		return parts.join('. ')
	}

	/**
	 * Get element description
	 */
	private getElementDescription(node: InteractiveElementDomNode & { ref?: HTMLElement }): string {
		if (!node.ref) return 'unknown'

		const parts: string[] = []
		parts.push(node.ref.tagName.toLowerCase())

		const text = normalizeText(node.ref.textContent || '')
		if (text) {
			parts.push(`"${text.substring(0, 30)}"`)
		}

		const ariaLabel = node.ref.getAttribute('aria-label')
		if (ariaLabel) {
			parts.push(`[${ariaLabel}]`)
		}

		return parts.join(' ')
	}

	/**
	 * Add a finding
	 */
	private addFinding(finding: Omit<TestFinding, 'id'>): void {
		this.findings.push({ ...finding, id: uid() })
	}

	/**
	 * Cleanup resources
	 */
	private cleanup(): void {
		this.adaptiveWait.dispose()
		this.selfHealing.clearCache()
		this.elementEmbeddings.clearCache()
	}
}
