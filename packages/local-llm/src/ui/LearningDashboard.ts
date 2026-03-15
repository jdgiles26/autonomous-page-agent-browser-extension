/**
 * LearningDashboard UI Component
 * Displays learning statistics, examples, and patterns
 */

import type { LearningEngine } from '../LearningEngine.js'
import type { LearningStats, LearningExample, LearningPattern } from '../types.js'

export interface LearningDashboardConfig {
	learningEngine: LearningEngine
	container?: HTMLElement
}

export class LearningDashboard extends EventTarget {
	private config: LearningDashboardConfig
	private container: HTMLElement
	private refreshInterval: number | null = null

	constructor(config: LearningDashboardConfig) {
		super()
		this.config = config
		this.container = config.container || this.createDefaultContainer()
	}

	private createDefaultContainer(): HTMLElement {
		const div = document.createElement('div')
		div.className = 'page-agent-learning-dashboard'
		div.innerHTML = `
			<style>
				.page-agent-learning-dashboard {
					font-family: system-ui, -apple-system, sans-serif;
					padding: 16px;
					background: #f5f5f5;
					border-radius: 8px;
					max-width: 800px;
				}
				.dashboard-header {
					display: flex;
					justify-content: space-between;
					align-items: center;
					margin-bottom: 20px;
				}
				.dashboard-header h2 {
					margin: 0;
					font-size: 18px;
				}
				.stats-grid {
					display: grid;
					grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
					gap: 12px;
					margin-bottom: 20px;
				}
				.stat-card {
					background: white;
					padding: 16px;
					border-radius: 6px;
					text-align: center;
				}
				.stat-value {
					font-size: 24px;
					font-weight: 600;
					color: #007acc;
				}
				.stat-label {
					font-size: 12px;
					color: #666;
					margin-top: 4px;
				}
				.section {
					background: white;
					padding: 16px;
					border-radius: 6px;
					margin-bottom: 16px;
				}
				.section h3 {
					margin: 0 0 12px 0;
					font-size: 14px;
					text-transform: uppercase;
					color: #666;
				}
				.accuracy-bar {
					width: 100%;
					height: 20px;
					background: #e0e0e0;
					border-radius: 10px;
					overflow: hidden;
					position: relative;
				}
				.accuracy-fill {
					height: 100%;
					background: linear-gradient(90deg, #ff6b6b 0%, #ffd93d 50%, #6bcf7f 100%);
					transition: width 0.5s ease;
				}
				.accuracy-text {
					position: absolute;
					top: 50%;
					left: 50%;
					transform: translate(-50%, -50%);
					font-size: 12px;
					font-weight: 600;
					color: #333;
				}
				.pattern-list {
					list-style: none;
					padding: 0;
					margin: 0;
				}
				.pattern-item {
					display: flex;
					justify-content: space-between;
					padding: 8px 0;
					border-bottom: 1px solid #eee;
				}
				.pattern-item:last-child {
					border-bottom: none;
				}
				.pattern-name {
					font-size: 13px;
				}
				.pattern-rate {
					font-size: 12px;
					font-weight: 600;
				}
				.pattern-rate.high {
					color: #28a745;
				}
				.pattern-rate.medium {
					color: #ffc107;
				}
				.pattern-rate.low {
					color: #dc3545;
				}
				.example-list {
					max-height: 300px;
					overflow-y: auto;
				}
				.example-item {
					padding: 12px;
					border-bottom: 1px solid #eee;
					font-size: 13px;
				}
				.example-item:last-child {
					border-bottom: none;
				}
				.example-success {
					color: #28a745;
				}
				.example-failure {
					color: #dc3545;
				}
				.example-meta {
					font-size: 11px;
					color: #888;
					margin-top: 4px;
				}
				.btn {
					padding: 8px 16px;
					background: #007acc;
					color: white;
					border: none;
					border-radius: 4px;
					cursor: pointer;
					font-size: 13px;
					margin-right: 8px;
				}
				.btn:hover {
					background: #005fa3;
				}
				.btn-secondary {
					background: #6c757d;
				}
				.btn-secondary:hover {
					background: #545b62;
				}
				.btn-danger {
					background: #dc3545;
				}
				.btn-danger:hover {
					background: #c82333;
				}
				.empty-state {
					text-align: center;
					padding: 32px;
					color: #888;
				}
				.tabs {
					display: flex;
					gap: 8px;
					margin-bottom: 16px;
				}
				.tab {
					padding: 8px 16px;
					background: #e0e0e0;
					border: none;
					border-radius: 4px;
					cursor: pointer;
					font-size: 13px;
				}
				.tab.active {
					background: #007acc;
					color: white;
				}
			</style>
			<div class="dashboard-header">
				<h2>📊 Learning Dashboard</h2>
				<div>
					<button class="btn" id="refresh-btn">Refresh</button>
					<button class="btn btn-secondary" id="export-btn">Export</button>
					<button class="btn btn-danger" id="reset-btn">Reset</button>
				</div>
			</div>
			<div class="stats-grid" id="stats-grid"></div>
			<div class="tabs">
				<button class="tab active" data-tab="patterns">Patterns</button>
				<button class="tab" data-tab="examples">Recent Examples</button>
			</div>
			<div id="tab-content"></div>
			<input type="file" id="import-input" accept=".json" style="display: none;" />
		`

		// Setup event listeners
		div.querySelector('#refresh-btn')?.addEventListener('click', () => this.update())
		div.querySelector('#export-btn')?.addEventListener('click', () => this.exportData())
		div.querySelector('#reset-btn')?.addEventListener('click', () => this.resetData())

		const importInput = div.querySelector('#import-input') as HTMLInputElement
		importInput?.addEventListener('change', (e) => this.importData(e))

		// Add import button
		const exportBtn = div.querySelector('#export-btn')
		if (exportBtn) {
			const importBtn = document.createElement('button')
			importBtn.className = 'btn btn-secondary'
			importBtn.textContent = 'Import'
			importBtn.addEventListener('click', () => importInput?.click())
			exportBtn.after(importBtn)
		}

		// Tab switching
		div.querySelectorAll('.tab').forEach((tab) => {
			tab.addEventListener('click', () => {
				div.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'))
				tab.classList.add('active')
				this.renderTabContent(tab.getAttribute('data-tab') as string)
			})
		})

		return div
	}

	/**
	 * Update the dashboard with current stats
	 */
	async update(): Promise<void> {
		const stats = await this.config.learningEngine.getStats()
		this.renderStats(stats)
		this.renderTabContent('patterns')
	}

	/**
	 * Render statistics cards
	 */
	private renderStats(stats: LearningStats): void {
		const container = this.container.querySelector('#stats-grid')
		if (!container) return

		container.innerHTML = `
			<div class="stat-card">
				<div class="stat-value">${stats.totalExamples}</div>
				<div class="stat-label">Total Examples</div>
			</div>
			<div class="stat-card">
				<div class="stat-value">${stats.successfulExamples}</div>
				<div class="stat-label">Successful</div>
			</div>
			<div class="stat-card">
				<div class="stat-value">${stats.failedExamples}</div>
				<div class="stat-label">Failed</div>
			</div>
			<div class="stat-card">
				<div class="stat-value">${(stats.accuracy * 100).toFixed(1)}%</div>
				<div class="stat-label">Accuracy</div>
			</div>
			<div class="stat-card">
				<div class="stat-value">${(stats.averageExecutionTime / 1000).toFixed(1)}s</div>
				<div class="stat-label">Avg Time</div>
			</div>
		`

		// Add accuracy bar
		const accuracySection = document.createElement('div')
		accuracySection.className = 'section'
		accuracySection.innerHTML = `
			<h3>Overall Accuracy</h3>
			<div class="accuracy-bar">
				<div class="accuracy-fill" style="width: ${stats.accuracy * 100}%"></div>
				<div class="accuracy-text">${(stats.accuracy * 100).toFixed(1)}%</div>
			</div>
		`

		const existingAccuracy = this.container.querySelector('.accuracy-section')
		if (existingAccuracy) {
			existingAccuracy.replaceWith(accuracySection)
		} else {
			container.after(accuracySection)
		}
		accuracySection.classList.add('accuracy-section')
	}

	/**
	 * Render tab content
	 */
	private async renderTabContent(tab: string): Promise<void> {
		const container = this.container.querySelector('#tab-content')
		if (!container) return

		if (tab === 'patterns') {
			await this.renderPatterns(container)
		} else if (tab === 'examples') {
			await this.renderExamples(container)
		}
	}

	/**
	 * Render patterns list
	 */
	private async renderPatterns(container: Element): Promise<void> {
		const stats = await this.config.learningEngine.getStats()
		const patterns = stats.topPatterns

		if (patterns.length === 0) {
			container.innerHTML = `
				<div class="section">
					<div class="empty-state">No patterns learned yet. Keep using the agent to build patterns.</div>
				</div>
			`
			return
		}

		container.innerHTML = `
			<div class="section">
				<h3>Top Patterns</h3>
				<ul class="pattern-list">
					${patterns
						.map((p) => {
							const rateClass = p.successRate > 0.8 ? 'high' : p.successRate > 0.5 ? 'medium' : 'low'
							return `
							<li class="pattern-item">
								<span class="pattern-name">[${p.type}] ${p.pattern}</span>
								<span class="pattern-rate ${rateClass}">${(p.successRate * 100).toFixed(0)}% (${p.count})</span>
							</li>
							`
						})
						.join('')}
				</ul>
			</div>
		`
	}

	/**
	 * Render recent examples
	 */
	private async renderExamples(container: Element): Promise<void> {
		// Get examples from learning engine storage
		// Note: We'd need to add a method to LearningEngine to get recent examples
		// For now, show placeholder
		container.innerHTML = `
			<div class="section">
				<h3>Recent Examples</h3>
				<div class="example-list">
					<div class="empty-state">Examples are stored internally for learning purposes.</div>
				</div>
			</div>
		`
	}

	/**
	 * Export learning data
	 */
	private async exportData(): Promise<void> {
		try {
			const data = await this.config.learningEngine.exportLearningData()
			const blob = new Blob([data], { type: 'application/json' })
			const url = URL.createObjectURL(blob)

			const a = document.createElement('a')
			a.href = url
			a.download = `page-agent-learning-${Date.now()}.json`
			document.body.appendChild(a)
			a.click()
			document.body.removeChild(a)
			URL.revokeObjectURL(url)
		} catch (error) {
			alert('Failed to export: ' + (error instanceof Error ? error.message : String(error)))
		}
	}

	/**
	 * Import learning data
	 */
	private async importData(event: Event): Promise<void> {
		const input = event.target as HTMLInputElement
		const file = input.files?.[0]
		if (!file) return

		try {
			const text = await file.text()
			await this.config.learningEngine.importLearningData(text)
			await this.update()
			alert('Learning data imported successfully!')
		} catch (error) {
			alert('Failed to import: ' + (error instanceof Error ? error.message : String(error)))
		}

		input.value = ''
	}

	/**
	 * Reset all learning data
	 */
	private async resetData(): Promise<void> {
		if (!confirm('Are you sure you want to reset all learning data? This cannot be undone.')) {
			return
		}

		try {
			await this.config.learningEngine.clearLearningData()
			await this.update()
			alert('Learning data reset successfully!')
		} catch (error) {
			alert('Failed to reset: ' + (error instanceof Error ? error.message : String(error)))
		}
	}

	/**
	 * Start auto-refresh
	 */
	startAutoRefresh(intervalMs: number = 5000): void {
		this.stopAutoRefresh()
		this.refreshInterval = window.setInterval(() => this.update(), intervalMs)
	}

	/**
	 * Stop auto-refresh
	 */
	stopAutoRefresh(): void {
		if (this.refreshInterval) {
			clearInterval(this.refreshInterval)
			this.refreshInterval = null
		}
	}

	/**
	 * Get the container element
	 */
	getContainer(): HTMLElement {
		return this.container
	}

	/**
	 * Mount to a parent element
	 */
	mount(parent: HTMLElement): void {
		parent.appendChild(this.container)
		this.update()
	}

	/**
	 * Unmount from parent
	 */
	unmount(): void {
		this.stopAutoRefresh()
		this.container.remove()
	}
}
