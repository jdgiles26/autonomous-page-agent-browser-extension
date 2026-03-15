/**
 * AI Report Generator - Creates AI-friendly reports for coding assistants
 */

import type { AIFinding, AIReport, TestFinding } from '../types'

export interface AIReportConfig {
	detail: 'minimal' | 'standard' | 'comprehensive'
	includeCodeExamples: boolean
	includeStackTraces: boolean
}

export const defaultAIReportConfig: AIReportConfig = {
	detail: 'comprehensive',
	includeCodeExamples: true,
	includeStackTraces: true,
}

/**
 * AI Report Generator
 */
export class AIReportGenerator {
	private config: AIReportConfig

	constructor(config: Partial<AIReportConfig> = {}) {
		this.config = { ...defaultAIReportConfig, ...config }
	}

	/**
	 * Generate AI report from test data
	 */
	generate(data: {
		summary: AIReport['summary']
		findings: AIFinding[]
		context: AIReport['context']
		recommendations: AIReport['recommendations']
		raw: AIReport['raw']
	}): AIReport {
		return {
			...data,
			findings: this.prioritizeFindings(data.findings),
		}
	}

	/**
	 * Generate markdown report optimized for AI consumption
	 */
	generateMarkdown(report: AIReport): string {
		const lines: string[] = []

		// Header
		lines.push('# AI-Friendly Test Report')
		lines.push('')

		// Summary
		lines.push('## Summary')
		lines.push(`- **Total Tests**: ${report.summary.totalTests}`)
		lines.push(`- **Passed**: ${report.summary.passed}`)
		lines.push(`- **Failed**: ${report.summary.failed}`)
		lines.push(`- **Skipped**: ${report.summary.skipped}`)
		lines.push(`- **Duration**: ${this.formatDuration(report.summary.duration)}`)
		lines.push(`- **Coverage**: ${report.summary.coverage.toFixed(1)}%`)
		lines.push('')

		// Findings by severity
		lines.push('### Findings by Severity')
		for (const [severity, count] of Object.entries(report.summary.findingsBySeverity)) {
			lines.push(`- ${severity}: ${count}`)
		}
		lines.push('')

		// Context
		lines.push('## Context')
		lines.push('')
		lines.push('### Page Structure')
		lines.push(report.context.pageStructure)
		lines.push('')

		lines.push('### Interactive Elements')
		for (const element of report.context.interactiveElements.slice(0, 20)) {
			lines.push(`- [${element.index}] ${element.tagName}: ${element.description}`)
		}
		if (report.context.interactiveElements.length > 20) {
			lines.push(`- ... and ${report.context.interactiveElements.length - 20} more`)
		}
		lines.push('')

		// Findings
		lines.push('## Findings')
		lines.push('')

		for (const finding of report.findings) {
			lines.push(this.generateFindingMarkdown(finding))
			lines.push('')
		}

		// Recommendations
		if (report.recommendations.length > 0) {
			lines.push('## Recommendations')
			lines.push('')

			for (const rec of report.recommendations.sort((a, b) => a.priority - b.priority)) {
				lines.push(`### Priority ${rec.priority}: ${rec.title}`)
				lines.push(rec.description)
				lines.push('')
			}
		}

		// AI Context Section
		lines.push('## AI Analysis Context')
		lines.push('')
		lines.push('### For AI Coding Assistants')
		lines.push('')
		lines.push('This report contains structured data about UI test failures. Each finding includes:')
		lines.push('- **Location**: Where the issue occurred')
		lines.push('- **Reproduction**: Exact steps to reproduce')
		lines.push('- **AI Context**: Likely cause and suggested fixes')
		lines.push('')
		lines.push('Use the `aiContext` field in each finding to understand:')
		lines.push('1. What probably caused the issue')
		lines.push('2. Which files to check')
		lines.push('3. What code patterns might fix it')
		lines.push('')

		return lines.join('\n')
	}

	/**
	 * Generate markdown for a single finding
	 */
	private generateFindingMarkdown(finding: AIFinding): string {
		const lines: string[] = []

		const severityEmoji = {
			critical: '🔴',
			high: '🟠',
			medium: '🟡',
			low: '🟢',
			info: '🔵',
		}[finding.severity] || '⚪'

		lines.push(`### ${severityEmoji} ${finding.title}`)
		lines.push('')
		lines.push(`**Severity**: ${finding.severity}`)
		lines.push(`**Category**: ${finding.category}`)
		lines.push(`**ID**: ${finding.id}`)
		lines.push('')
		lines.push('**Description**:')
		lines.push(finding.description)
		lines.push('')

		// Location
		lines.push('**Location**:')
		lines.push(`- URL: ${finding.location.url}`)
		if (finding.location.element) {
			lines.push(`- Element: [${finding.location.element.index}] ${finding.location.element.description}`)
		}
		lines.push('')

		// Reproduction
		if (finding.reproduction.length > 0) {
			lines.push('**Reproduction Steps**:')
			for (let i = 0; i < finding.reproduction.length; i++) {
				const step = finding.reproduction[i]
				lines.push(`${i + 1}. ${step.type}${step.target ? ` [${step.target.index}]` : ''}${step.value ? `: "${step.value}"` : ''}`)
			}
			lines.push('')
		}

		// AI Context
		lines.push('**AI Analysis**:')
		lines.push(`- **Likely Cause**: ${finding.aiContext.likelyCause}`)
		lines.push(`- **Confidence**: ${(finding.aiContext.confidence * 100).toFixed(0)}%`)
		lines.push('')

		if (finding.aiContext.suggestedFilesToCheck.length > 0) {
			lines.push('- **Files to Check**:')
			for (const file of finding.aiContext.suggestedFilesToCheck) {
				lines.push(`  - ${file}`)
			}
		}

		lines.push(`- **Suggested Pattern**: ${finding.aiContext.suggestedCodePattern}`)
		lines.push('')

		// Technical details
		if (this.config.includeStackTraces && finding.technicalDetails?.stackTrace) {
			lines.push('**Stack Trace**:')
			lines.push('```')
			lines.push(finding.technicalDetails.stackTrace)
			lines.push('```')
			lines.push('')
		}

		// Suggested fix
		if (finding.suggestedFix) {
			lines.push('**Suggested Fix**:')
			lines.push(finding.suggestedFix)
			lines.push('')
		}

		return lines.join('\n')
	}

	/**
	 * Generate JSON for programmatic consumption
	 */
	generateJSON(report: AIReport): string {
		return JSON.stringify(report, null, 2)
	}

	/**
	 * Generate a prompt for AI assistant
	 */
	generateAIPrompt(report: AIReport, findingId?: string): string {
		if (findingId) {
			// Prompt for specific finding
			const finding = report.findings.find((f) => f.id === findingId)
			if (!finding) return `Finding ${findingId} not found`

			return this.generateSingleFindingPrompt(finding)
		}

		// General prompt for all findings
		return this.generateGeneralPrompt(report)
	}

	/**
	 * Generate prompt for a single finding
	 */
	private generateSingleFindingPrompt(finding: AIFinding): string {
		const lines: string[] = []

		lines.push('You are an expert web developer analyzing a UI test failure.')
		lines.push('')
		lines.push('## Finding Details')
		lines.push('')
		lines.push(`**Title**: ${finding.title}`)
		lines.push(`**Severity**: ${finding.severity}`)
		lines.push(`**Category**: ${finding.category}`)
		lines.push('')
		lines.push('**Description**:')
		lines.push(finding.description)
		lines.push('')

		lines.push('**AI Analysis**:')
		lines.push(`- Likely Cause: ${finding.aiContext.likelyCause}`)
		lines.push(`- Suggested Files: ${finding.aiContext.suggestedFilesToCheck.join(', ')}`)
		lines.push(`- Suggested Pattern: ${finding.aiContext.suggestedCodePattern}`)
		lines.push('')

		if (finding.reproduction.length > 0) {
			lines.push('**Reproduction Steps**:')
			for (const step of finding.reproduction) {
				lines.push(`- ${step.type}${step.target ? ` element [${step.target.index}]` : ''}${step.value ? ` with value "${step.value}"` : ''}`)
			}
			lines.push('')
		}

		lines.push('## Your Task')
		lines.push('')
		lines.push('1. Analyze the likely cause of this test failure')
		lines.push('2. Identify the specific code that needs to be fixed')
		lines.push('3. Provide a concrete code fix or suggestion')
		lines.push('4. Explain how to prevent similar issues in the future')
		lines.push('')

		return lines.join('\n')
	}

	/**
	 * Generate general prompt for all findings
	 */
	private generateGeneralPrompt(report: AIReport): string {
		const lines: string[] = []

		lines.push('You are an expert QA engineer analyzing a web application test report.')
		lines.push('')
		lines.push('## Test Summary')
		lines.push('')
		lines.push(`- Total Tests: ${report.summary.totalTests}`)
		lines.push(`- Passed: ${report.summary.passed}`)
		lines.push(`- Failed: ${report.summary.failed}`)
		lines.push(`- Coverage: ${report.summary.coverage.toFixed(1)}%`)
		lines.push('')

		lines.push('## Findings Overview')
		lines.push('')

		for (const finding of report.findings.slice(0, 10)) {
			lines.push(`### ${finding.title}`)
			lines.push(`- Severity: ${finding.severity}`)
			lines.push(`- Category: ${finding.category}`)
			lines.push(`- Description: ${finding.description}`)
			lines.push('')
		}

		if (report.findings.length > 10) {
			lines.push(`... and ${report.findings.length - 10} more findings`)
			lines.push('')
		}

		lines.push('## Your Task')
		lines.push('')
		lines.push('1. Prioritize the findings by impact and effort to fix')
		lines.push('2. Identify common patterns across failures')
		lines.push('3. Suggest architectural improvements to prevent future issues')
		lines.push('4. Create a remediation plan with estimated effort')
		lines.push('')

		return lines.join('\n')
	}

	/**
	 * Prioritize findings by severity and impact
	 */
	private prioritizeFindings(findings: AIFinding[]): AIFinding[] {
		const severityOrder = { critical: 0, high: 1, error: 2, warning: 3, medium: 4, low: 5, info: 6 }

		return findings.sort((a, b) => {
			const severityDiff =
				(severityOrder[a.severity] ?? 999) - (severityOrder[b.severity] ?? 999)
			if (severityDiff !== 0) return severityDiff

			// Within same severity, sort by confidence
			return b.aiContext.confidence - a.aiContext.confidence
		})
	}

	/**
	 * Format duration
	 */
	private formatDuration(ms: number): string {
		if (ms < 1000) return `${ms}ms`
		if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
		const minutes = Math.floor(ms / 60000)
		const seconds = ((ms % 60000) / 1000).toFixed(1)
		return `${minutes}m ${seconds}s`
	}
}
