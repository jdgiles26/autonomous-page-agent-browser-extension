/**
 * Testing Panel - UI for the testing framework
 */

import type { PageAgent } from '@page-agent/core'
import { Panel } from '@page-agent/ui'

import type { AIReport, Playbook, TestConfig, TestResult } from '../types'
import { AutonomousTester } from '../AutonomousTester'
import { formatDuration } from '../utils'

export interface TestingPanelConfig {
	pageAgent: PageAgent
	autoRun?: boolean
}

/**
 * Testing Panel - Interactive UI for autonomous testing
 */
export class TestingPanel extends Panel {
	private pageAgent: PageAgent
	private tester: AutonomousTester | null = null
	private currentResult: TestResult | null = null
	private isRunning = false

	// UI Elements
	private runButton: HTMLButtonElement
	private stopButton: HTMLButtonElement
	private exportButton: HTMLButtonElement
	private statusDisplay: HTMLElement
	private progressBar: HTMLElement
	private findingsList: HTMLElement
	private reportSection: HTMLElement

	constructor(config: TestingPanelConfig) {
		// Create a wrapper agent adapter for the Panel base class
		const agentAdapter = {
			status: 'idle' as const,
			history: [],
			task: '',
			execute: async () => {},
			stop: () => {},
			dispose: () => {},
			addEventListener: () => {},
			removeEventListener: () => {},
			onAskUser: undefined,
		}

		super(agentAdapter as any, { language: 'en-US' })

		this.pageAgent = config.pageAgent

		// Create custom UI
		this.createTestingUI()

		// Auto-run if configured
		if (config.autoRun) {
			this.runTest()
		}
	}

	/**
	 * Create testing-specific UI elements
	 */
	private createTestingUI(): void {
		const wrapper = this.wrapper

		// Find or create header section
		let header = wrapper.querySelector('.testing-header') as HTMLElement
		if (!header) {
			header = document.createElement('div')
			header.className = 'testing-header'
			header.style.cssText = `
				padding: 12px;
				border-bottom: 1px solid #e0e0e0;
				display: flex;
				gap: 8px;
				align-items: center;
			`
			wrapper.insertBefore(header, wrapper.firstChild)
		}

		// Run button
		this.runButton = document.createElement('button')
		this.runButton.textContent = '▶ Run Test'
		this.runButton.style.cssText = `
			padding: 8px 16px;
			background: #4CAF50;
			color: white;
			border: none;
			border-radius: 4px;
			cursor: pointer;
			font-size: 14px;
		`
		this.runButton.onclick = () => this.runTest()
		header.appendChild(this.runButton)

		// Stop button
		this.stopButton = document.createElement('button')
		this.stopButton.textContent = '⏹ Stop'
		this.stopButton.style.cssText = `
			padding: 8px 16px;
			background: #f44336;
			color: white;
			border: none;
			border-radius: 4px;
			cursor: pointer;
			font-size: 14px;
			display: none;
		`
		this.stopButton.onclick = () => this.stopTest()
		header.appendChild(this.stopButton)

		// Export button
		this.exportButton = document.createElement('button')
		this.exportButton.textContent = '⬇ Export'
		this.exportButton.style.cssText = `
			padding: 8px 16px;
			background: #2196F3;
			color: white;
			border: none;
			border-radius: 4px;
			cursor: pointer;
			font-size: 14px;
			display: none;
		`
		this.exportButton.onclick = () => this.exportResults()
		header.appendChild(this.exportButton)

		// Status display
		this.statusDisplay = document.createElement('div')
		this.statusDisplay.style.cssText = `
			margin-left: auto;
			font-size: 14px;
			color: #666;
		`
		this.statusDisplay.textContent = 'Ready'
		header.appendChild(this.statusDisplay)

		// Progress bar
		this.progressBar = document.createElement('div')
		this.progressBar.style.cssText = `
			width: 100%;
			height: 4px;
			background: #e0e0e0;
			position: relative;
			display: none;
		`

		const progressFill = document.createElement('div')
		progressFill.style.cssText = `
			width: 0%;
			height: 100%;
			background: #4CAF50;
			transition: width 0.3s;
		`
		progressFill.id = 'progress-fill'
		this.progressBar.appendChild(progressFill)
		wrapper.appendChild(this.progressBar)

		// Findings list
		this.findingsList = document.createElement('div')
		this.findingsList.style.cssText = `
			padding: 12px;
			max-height: 300px;
			overflow-y: auto;
			display: none;
		`
		wrapper.appendChild(this.findingsList)

		// Report section
		this.reportSection = document.createElement('div')
		this.reportSection.style.cssText = `
			padding: 12px;
			border-top: 1px solid #e0e0e0;
			display: none;
		`
		wrapper.appendChild(this.reportSection)
	}

	/**
	 * Run autonomous test
	 */
	private async runTest(): Promise<void> {
		if (this.isRunning) return

		this.isRunning = true
		this.currentResult = null

		// Update UI
		this.runButton.style.display = 'none'
		this.stopButton.style.display = 'block'
		this.exportButton.style.display = 'none'
		this.progressBar.style.display = 'block'
		this.findingsList.style.display = 'block'
		this.findingsList.innerHTML = ''
		this.reportSection.style.display = 'none'
		this.statusDisplay.textContent = 'Initializing...'

		// Create test config
		const testConfig: TestConfig = {
			targetUrl: window.location.href,
			testType: 'exploratory',
			depth: 'shallow',
			maxDuration: 60000,
			generatePlaywright: true,
			generateReport: true,
		}

		// Create tester
		this.tester = new AutonomousTester({
			pageAgent: this.pageAgent,
			testConfig,
		})

		// Listen to events
		this.tester.addEventListener('test:phase', (e: Event) => {
			const { phase } = (e as CustomEvent).detail
			this.statusDisplay.textContent = `Phase: ${phase}...`
			this.updateProgress(phase)
		})

		this.tester.addEventListener('test:step', (e: Event) => {
			const { plan, status } = (e as CustomEvent).detail
			this.addFindingToList({
				id: Date.now().toString(),
				severity: status === 'passed' ? 'info' : 'warning',
				category: 'functional',
				title: `${plan}: ${status}`,
				description: `Test step ${plan} ${status}`,
				reproduction: [],
				evidence: { screenshots: [], domSnapshots: [], consoleLogs: [] },
			})
		})

		this.tester.addEventListener('test:finding', (e: Event) => {
			const { finding } = (e as CustomEvent).detail
			this.addFindingToList(finding)
		})

		try {
			// Run test
			this.currentResult = await this.tester.run()
			this.displayResults(this.currentResult)
		} catch (error) {
			this.statusDisplay.textContent = `Error: ${(error as Error).message}`
			this.addFindingToList({
				id: Date.now().toString(),
				severity: 'error',
				category: 'functional',
				title: 'Test Execution Failed',
				description: (error as Error).message,
				reproduction: [],
				evidence: { screenshots: [], domSnapshots: [], consoleLogs: [] },
			})
		} finally {
			this.isRunning = false
			this.runButton.style.display = 'block'
			this.stopButton.style.display = 'none'
			this.exportButton.style.display = 'block'
			this.progressBar.style.display = 'none'
		}
	}

	/**
	 * Stop running test
	 */
	private stopTest(): void {
		if (this.tester) {
			this.tester.stop()
		}
		this.isRunning = false
		this.statusDisplay.textContent = 'Stopped'
		this.runButton.style.display = 'block'
		this.stopButton.style.display = 'none'
		this.progressBar.style.display = 'none'
	}

	/**
	 * Export test results
	 */
	private exportResults(): void {
		if (!this.currentResult) return

		// Create export menu
		const menu = document.createElement('div')
		menu.style.cssText = `
			position: absolute;
			top: 50px;
			right: 12px;
			background: white;
			border: 1px solid #ccc;
			border-radius: 4px;
			box-shadow: 0 2px 8px rgba(0,0,0,0.1);
			z-index: 10000;
		`

		const options = [
			{ label: 'AI Report (Markdown)', action: () => this.downloadAIReport() },
			{ label: 'AI Report (JSON)', action: () => this.downloadJSONReport() },
			{ label: 'Playwright Tests', action: () => this.downloadPlaywrightTests() },
			{ label: 'Playbooks (JSON)', action: () => this.downloadPlaybooks() },
		]

		for (const option of options) {
			const item = document.createElement('div')
			item.textContent = option.label
			item.style.cssText = `
				padding: 8px 16px;
				cursor: pointer;
				font-size: 14px;
			`
			item.onmouseover = () => (item.style.background = '#f5f5f5')
			item.onmouseout = () => (item.style.background = 'white')
			item.onclick = () => {
				option.action()
				menu.remove()
			}
			menu.appendChild(item)
		}

		this.wrapper.appendChild(menu)

		// Close menu on click outside
		setTimeout(() => {
			document.addEventListener('click', function closeMenu() {
				menu.remove()
				document.removeEventListener('click', closeMenu)
			})
		}, 0)
	}

	/**
	 * Display test results
	 */
	private displayResults(result: TestResult): void {
		this.statusDisplay.textContent = `Completed: ${result.status}`

		// Update report section
		this.reportSection.style.display = 'block'
		this.reportSection.innerHTML = `
			<h3>Test Summary</h3>
			<p><strong>Status:</strong> ${result.status}</p>
			<p><strong>Duration:</strong> ${formatDuration(result.endTime - result.startTime)}</p>
			<p><strong>Coverage:</strong> ${result.coverage.elementsInteracted.length} elements</p>
			<p><strong>Findings:</strong> ${result.findings.length}</p>
			<p><strong>Playwright Tests:</strong> ${result.playwrightTests.length} generated</p>
		`
	}

	/**
	 * Add finding to the list
	 */
	private addFindingToList(finding: {
		id: string
		severity: string
		category: string
		title: string
		description: string
	}): void {
		const item = document.createElement('div')

		const severityColors: Record<string, string> = {
			critical: '#f44336',
			error: '#f44336',
			high: '#ff9800',
			warning: '#ff9800',
			medium: '#ffc107',
			low: '#4CAF50',
			info: '#2196F3',
		}

		item.style.cssText = `
			padding: 8px;
			margin-bottom: 4px;
			border-left: 4px solid ${severityColors[finding.severity] || '#999'};
			background: #f9f9f9;
			font-size: 13px;
		`

		item.innerHTML = `
			<strong>${finding.title}</strong>
			<div style="color: #666; font-size: 12px;">${finding.description}</div>
		`

		this.findingsList.appendChild(item)
		this.findingsList.scrollTop = this.findingsList.scrollHeight
	}

	/**
	 * Update progress bar
	 */
	private updateProgress(phase: string): void {
		const phases: Record<string, number> = {
			explore: 25,
			plan: 50,
			execute: 75,
			report: 100,
		}

		const progress = phases[phase] || 0
		const fill = this.progressBar.querySelector('#progress-fill') as HTMLElement
		if (fill) {
			fill.style.width = `${progress}%`
		}
	}

	/**
	 * Download AI report as markdown
	 */
	private downloadAIReport(): void {
		if (!this.currentResult) return

		const { AIReportGenerator } = require('../reporters/AIReportGenerator')
		const generator = new AIReportGenerator()
		const markdown = generator.generateMarkdown(this.currentResult.aiReport)

		this.downloadFile(markdown, 'ai-report.md', 'text/markdown')
	}

	/**
	 * Download JSON report
	 */
	private downloadJSONReport(): void {
		if (!this.currentResult) return

		const json = JSON.stringify(this.currentResult.aiReport, null, 2)
		this.downloadFile(json, 'ai-report.json', 'application/json')
	}

	/**
	 * Download Playwright tests
	 */
	private downloadPlaywrightTests(): void {
		if (!this.currentResult) return

		const tests = this.currentResult.playwrightTests.join('\n\n')
		this.downloadFile(tests, 'playwright-tests.spec.ts', 'text/typescript')
	}

	/**
	 * Download playbooks
	 */
	private downloadPlaybooks(): void {
		if (!this.currentResult) return

		const playbooks = JSON.stringify(this.currentResult.playbooks, null, 2)
		this.downloadFile(playbooks, 'playbooks.json', 'application/json')
	}

	/**
	 * Download file helper
	 */
	private downloadFile(content: string, filename: string, type: string): void {
		const blob = new Blob([content], { type })
		const url = URL.createObjectURL(blob)
		const a = document.createElement('a')
		a.href = url
		a.download = filename
		document.body.appendChild(a)
		a.click()
		document.body.removeChild(a)
		URL.revokeObjectURL(url)
	}

	/**
	 * Show the panel
	 */
	show(): void {
		super.show()
		this.expand()
	}
}
