/**
 * Core types for the Page Agent Testing framework
 */

import type { FlatDomTree, InteractiveElementDomNode } from '@page-agent/page-controller'

// ============================================================================
// Playbook Types (Feature 1)
// ============================================================================

export type PlaybookStepType = 'click' | 'input' | 'scroll' | 'select' | 'wait' | 'assert' | 'navigate'

export interface PlaybookStep {
	id: string
	type: PlaybookStepType
	target?: {
		index?: number
		description?: string
		fingerprint?: ElementFingerprint
		xpath?: string
	}
	value?: string
	timestamp: number
	duration?: number // How long the step took
	success?: boolean
	error?: string
	domSnapshot?: FlatDomTree
	screenshot?: string // Base64 encoded
}

export interface Playbook {
	id: string
	name: string
	url: string
	steps: PlaybookStep[]
	createdAt: number
	metadata: {
		totalSteps: number
		estimatedDuration: number
		successRate?: number
		lastRun?: number
		runCount?: number
	}
}

// ============================================================================
// Element Fingerprinting Types (Feature 4)
// ============================================================================

export interface ElementFingerprint {
	// Structural fingerprint
	tagName: string
	depth: number
	siblingIndex: number
	parentTag: string
	childCount: number

	// Content fingerprint
	textContent: string
	textHash: string
	textLength: number

	// Attribute fingerprint
	attributes: Record<string, string>
	classSignature: string
	id?: string

	// Visual fingerprint (relative to viewport)
	positionRatio: { x: number; y: number }
	sizeRatio: { width: number; height: number }

	// Semantic fingerprint
	role: string | null
	ariaLabel: string | null
	ariaDescription: string | null
	testId: string | null
	dataTestId: string | null
	dataCy: string | null

	// Interactive properties
	isVisible: boolean
	isEnabled: boolean
	isRequired?: boolean
	inputType?: string
}

export interface HealResult {
	index: number
	confidence: number
	method: 'text' | 'attributes' | 'position' | 'structure' | 'semantic' | 'fuzzy'
	fingerprint: ElementFingerprint
}

// ============================================================================
// Adaptive Wait Types (Feature 3)
// ============================================================================

export type WaitConditionType =
	| 'element_present'
	| 'element_visible'
	| 'text_present'
	| 'text_missing'
	| 'network_idle'
	| 'dom_stable'
	| 'custom'

export interface WaitCondition {
	type: WaitConditionType
	selector?: string
	text?: string
	timeout?: number
	pollInterval?: number
	customCondition?: () => boolean | Promise<boolean>
}

export interface NetworkActivity {
	pendingRequests: number
	lastActivity: number
	isIdle: boolean
}

// ============================================================================
// Visual Diff Types (Feature 7)
// ============================================================================

export interface VisualDiffResult {
	matchPercentage: number
	diffPixels: number
	totalPixels: number
	threshold: number
	diffBounds: { x: number; y: number; width: number; height: number } | null
	diffImage?: string // Base64 PNG
	beforeImage?: string
	afterImage?: string
}

export interface DOMDiffResult {
	added: Array<{
		index: number
		element: InteractiveElementDomNode
		fingerprint: ElementFingerprint
	}>
	removed: Array<{
		index: number
		fingerprint: ElementFingerprint
	}>
	modified: Array<{
		index: number
		changes: Array<{
			field: string
			old: unknown
			new: unknown
		}>
		fingerprint: ElementFingerprint
	}>
	unchanged: number[]
	moved: Array<{
		oldIndex: number
		newIndex: number
		fingerprint: ElementFingerprint
	}>
}

// ============================================================================
// Data Extraction Types (Feature 6)
// ============================================================================

export type ExtractionType = 'object' | 'array' | 'table'

export interface ExtractionField {
	name: string
	description: string
	type: 'string' | 'number' | 'boolean' | 'url' | 'date' | 'email'
	required?: boolean
	selector?: string // Element index or description
}

export interface ExtractionSchema {
	type: ExtractionType
	fields: ExtractionField[]
	pagination?: {
		nextButtonDescription?: string
		nextButtonIndex?: number
		maxPages: number
	}
}

export interface ExtractionResult<T = unknown> {
	data: T
	confidence: number
	sourceElements: Array<{
		index: number
		field: string
		value: string
	}>
	paginationInfo?: {
		currentPage: number
		totalPages: number
		hasMore: boolean
	}
	extractionTime: number
}

// ============================================================================
// Smart Suggestions Types (Feature 5)
// ============================================================================

export type PatternType =
	| 'login'
	| 'search'
	| 'checkout'
	| 'form'
	| 'data_table'
	| 'navigation'
	| 'modal'
	| 'wizard'
	| 'filter'
	| 'pagination'

export interface DetectedPattern {
	type: PatternType
	confidence: number
	elements: Array<{
		index: number
		role: string
		description: string
	}>
	suggestedActions: string[]
	metadata?: Record<string, unknown>
}

export interface SuggestedTask {
	id: string
	title: string
	description: string
	pattern: PatternType
	confidence: number
	icon?: string
	autoExecutable?: boolean
}

// ============================================================================
// Autonomous Tester Types
// ============================================================================

export type TestType = 'exploratory' | 'regression' | 'accessibility' | 'e2e' | 'smoke'
export type TestDepth = 'shallow' | 'medium' | 'deep'
export type TestStatus = 'passed' | 'failed' | 'partial' | 'skipped' | 'running'

export interface TestConfig {
	targetUrl: string
	testType: TestType
	depth: TestDepth
	maxDuration: number // milliseconds
	maxSteps?: number
	generatePlaywright: boolean
	generateReport: boolean
	viewport?: { width: number; height: number }
	cookies?: Record<string, string>
	headers?: Record<string, string>
}

export interface TestFinding {
	id: string
	severity: 'info' | 'warning' | 'error' | 'critical'
	category: 'functional' | 'ui' | 'performance' | 'accessibility' | 'security' | 'compatibility'
	title: string
	description: string
	reproduction: PlaybookStep[]
	evidence: {
		screenshots: string[]
		domSnapshots: FlatDomTree[]
		consoleLogs: string[]
		networkLogs: string[]
		visualDiffs?: VisualDiffResult[]
	}
	suggestedFix?: string
	relatedFindings?: string[]
}

export interface AIFindingContext {
	likelyCause: string
	suggestedFilesToCheck: string[]
	suggestedCodePattern: string
	confidence: number
	relatedErrors?: string[]
	stackTraceAnalysis?: string
}

export interface AIFinding extends TestFinding {
	aiContext: AIFindingContext
}

export interface AIReport {
	summary: {
		totalTests: number
		passed: number
		failed: number
		skipped: number
		duration: number
		coverage: number // percentage
		findingsBySeverity: Record<string, number>
	}
	findings: AIFinding[]
	context: {
		pageStructure: string
		interactiveElements: Array<{
			index: number
			description: string
			tagName: string
		}>
		knownIssues: string[]
		testPatterns: string[]
		urlsVisited: string[]
	}
	recommendations: Array<{
		priority: number
		title: string
		description: string
		relatedFindings: string[]
	}>
	raw: {
		allSteps: PlaybookStep[]
		allDiffs: DOMDiffResult[]
		consoleLogs: string[]
		networkLogs: Array<{
			url: string
			method: string
			status: number
			duration: number
		}>
	}
}

export interface TestResult {
	id: string
	config: TestConfig
	startTime: number
	endTime: number
	status: TestStatus
	coverage: {
		pagesVisited: string[]
		elementsInteracted: number[]
		formsTested: string[]
		patternsTested: PatternType[]
	}
	findings: TestFinding[]
	playwrightTests: string[]
	aiReport: AIReport
	playbooks: Playbook[]
}

export interface TestPlan {
	id: string
	name: string
	description: string
	priority: number
	pattern?: PatternType
	expectedResult: string
	steps: PlaybookStep[]
}

export interface TestExecutionResult {
	planId: string
	status: TestStatus
	startTime: number
	endTime: number
	duration: number
	stepsExecuted: number
	findings: TestFinding[]
	playbook?: Playbook
	visualDiffs?: VisualDiffResult[]
}

// ============================================================================
// Event Types
// ============================================================================

export type TestingEventType =
	| 'recording:start'
	| 'recording:stop'
	| 'recording:step'
	| 'test:start'
	| 'test:step'
	| 'test:complete'
	| 'test:finding'
	| 'healing:attempt'
	| 'healing:success'
	| 'healing:failure'
	| 'wait:condition'
	| 'diff:detected'
	| 'suggestion:available'

export interface TestingEventDetail {
	type: TestingEventType
	timestamp: number
	data?: unknown
}

// ============================================================================
// Configuration Types
// ============================================================================

export interface TestingConfig {
	// Self-healing
	enableSelfHealing: boolean
	healingThreshold: number
	cacheFingerprints: boolean

	// Adaptive wait
	enableAdaptiveWait: boolean
	defaultTimeout: number
	networkIdleTime: number

	// Visual diff
	enableVisualDiff: boolean
	visualDiffThreshold: number
	captureScreenshots: boolean

	// Semantic search
	enableSemanticSearch: boolean
	semanticSearchThreshold: number

	// Smart suggestions
	enableSmartSuggestions: boolean
	suggestionConfidenceThreshold: number

	// Reporting
	reportFormat: 'json' | 'markdown' | 'html' | 'all'
	includeScreenshots: boolean
	includeDomSnapshots: boolean
	aiReportDetail: 'minimal' | 'standard' | 'comprehensive'
}

export const defaultTestingConfig: TestingConfig = {
	enableSelfHealing: true,
	healingThreshold: 0.7,
	cacheFingerprints: true,
	enableAdaptiveWait: true,
	defaultTimeout: 10000,
	networkIdleTime: 500,
	enableVisualDiff: true,
	visualDiffThreshold: 0.1,
	captureScreenshots: true,
	enableSemanticSearch: true,
	semanticSearchThreshold: 0.7,
	enableSmartSuggestions: true,
	suggestionConfidenceThreshold: 0.6,
	reportFormat: 'all',
	includeScreenshots: true,
	includeDomSnapshots: false,
	aiReportDetail: 'comprehensive',
}
