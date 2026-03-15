/**
 * Demo Testing Mode - Auto-run tests on the current page
 */

import type { PageAgent } from '@page-agent/core'

import { AutonomousTester } from './AutonomousTester'
import { TestingPanel } from './panel/TestingPanel'
import type { TestConfig, TestResult } from './types'

export interface DemoTestConfig {
	pageAgent: PageAgent
	autoRun?: boolean
	showPanel?: boolean
	maxDuration?: number
	onComplete?: (result: TestResult) => void
}

/**
 * Run demo test on the current page
 */
export async function runDemoTest(config: DemoTestConfig): Promise<TestResult> {
	const testConfig: TestConfig = {
		targetUrl: window.location.href,
		testType: 'exploratory',
		depth: 'shallow',
		maxDuration: config.maxDuration || 60000,
		generatePlaywright: true,
		generateReport: true,
	}

	// Create and show panel if requested
	let panel: TestingPanel | null = null
	if (config.showPanel !== false) {
		panel = new TestingPanel({
			pageAgent: config.pageAgent,
			autoRun: config.autoRun,
		})
		panel.show()
	}

	// Create tester
	const tester = new AutonomousTester({
		pageAgent: config.pageAgent,
		testConfig,
	})

	// Listen to events
	tester.addEventListener('test:start', () => {
		console.log('🧪 Demo test started')
	})

	tester.addEventListener('test:phase', (e: Event) => {
		const { phase } = (e as CustomEvent).detail
		console.log(`📍 Phase: ${phase}`)
	})

	tester.addEventListener('test:complete', (e: Event) => {
		const { result } = (e as CustomEvent).detail
		console.log('✅ Demo test completed:', result.status)
		console.log('📊 Results:', {
			duration: result.endTime - result.startTime,
			findings: result.findings.length,
			playwrightTests: result.playwrightTests.length,
		})

		// Log AI report summary
		if (result.aiReport) {
			console.log('🤖 AI Report Summary:')
			console.log(`   - Total Tests: ${result.aiReport.summary.totalTests}`)
			console.log(`   - Passed: ${result.aiReport.summary.passed}`)
			console.log(`   - Failed: ${result.aiReport.summary.failed}`)
			console.log(`   - Coverage: ${result.aiReport.summary.coverage.toFixed(1)}%`)
		}

		// Call completion callback
		if (config.onComplete) {
			config.onComplete(result)
		}
	})

	tester.addEventListener('test:error', (e: Event) => {
		const { error } = (e as CustomEvent).detail
		console.error('❌ Demo test error:', error)
	})

	// Run test
	const result = await tester.run()

	return result
}

/**
 * Initialize demo mode automatically
 */
export function initDemoMode(pageAgent: PageAgent): void {
	console.log('🚀 Page Agent Testing Demo Mode')
	console.log('   Press Ctrl+Shift+T to run tests')

	// Add keyboard shortcut
	document.addEventListener('keydown', (e) => {
		if (e.ctrlKey && e.shiftKey && e.key === 'T') {
			e.preventDefault()
			runDemoTest({
				pageAgent,
				autoRun: true,
				showPanel: true,
			})
		}
	})

	// Auto-run if URL has ?test=true
	if (new URLSearchParams(window.location.search).has('test')) {
		setTimeout(() => {
			runDemoTest({
				pageAgent,
				autoRun: true,
				showPanel: true,
			})
		}, 2000)
	}
}

/**
 * Export results to console in AI-friendly format
 */
export function exportResultsToConsole(result: TestResult): void {
	console.group('🤖 AI-Friendly Test Report')

	console.log('## Summary')
	console.log(`Status: ${result.status}`)
	console.log(`Duration: ${result.endTime - result.startTime}ms`)
	console.log(`Coverage: ${result.coverage.elementsInteracted.length} elements tested`)

	console.log('## Findings')
	for (const finding of result.findings) {
		console.group(`[${finding.severity.toUpperCase()}] ${finding.title}`)
		console.log(finding.description)
		if ('aiContext' in finding) {
			const aiFinding = finding as any
			console.log('AI Analysis:')
			console.log(`  - Likely Cause: ${aiFinding.aiContext?.likelyCause}`)
			console.log(`  - Suggested Fix: ${aiFinding.aiContext?.suggestedCodePattern}`)
		}
		console.groupEnd()
	}

	console.log('## Generated Playwright Tests')
	console.log(`${result.playwrightTests.length} tests generated`)
	for (let i = 0; i < Math.min(3, result.playwrightTests.length); i++) {
		console.group(`Test ${i + 1}`)
		console.log(result.playwrightTests[i].substring(0, 500) + '...')
		console.groupEnd()
	}

	console.groupEnd()
}

// Auto-initialize if pageAgent is available on window
if (typeof window !== 'undefined') {
	const win = window as any
	if (win.pageAgent) {
		initDemoMode(win.pageAgent)
	}
}
