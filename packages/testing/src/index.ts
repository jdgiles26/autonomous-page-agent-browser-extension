/**
 * Page Agent Testing Framework
 * 
 * A comprehensive testing framework for autonomous UI/GUI web testing
 * with Playwright test generation and AI-friendly reporting.
 */

// Core testing engine
export { AutonomousTester } from './AutonomousTester'

// Feature modules
export { PlaybookRecorder } from './PlaybookRecorder'
export { AdaptiveWait, NetworkMonitor, DOMStabilityMonitor } from './AdaptiveWait'
export { SelfHealingSelector } from './SelfHealingSelector'
export { ElementEmbeddings } from './ElementEmbeddings'
export { DOMDiff } from './DOMDiff'
export { VisualDiff } from './VisualDiff'
export { DataExtractor } from './DataExtractor'
export { SmartSuggestions } from './SmartSuggestions'

// Reporters
export { AIReportGenerator } from './reporters/AIReportGenerator'
export { PlaywrightGenerator } from './reporters/PlaywrightGenerator'

// Types
export type {
	// Playbook types
	Playbook,
	PlaybookStep,
	PlaybookStepType,

	// Fingerprinting types
	ElementFingerprint,
	HealResult,

	// Wait types
	WaitCondition,
	WaitConditionType,
	NetworkActivity,

	// Diff types
	VisualDiffResult,
	DOMDiffResult,

	// Data extraction types
	ExtractionSchema,
	ExtractionField,
	ExtractionResult,

	// Suggestion types
	DetectedPattern,
	PatternType,
	SuggestedTask,

	// Test types
	TestConfig,
	TestType,
	TestDepth,
	TestStatus,
	TestFinding,
	AIFinding,
	AIFindingContext,
	AIReport,
	TestResult,
	TestPlan,
	TestExecutionResult,

	// Configuration types
	TestingConfig,
} from './types'

// Utilities
export {
	uid,
	waitFor,
	truncate,
	fnv1aHash,
	normalizeText,
	generateElementFingerprint,
	cosineSimilarity,
	debounce,
	throttle,
	deepClone,
	formatDuration,
	getElementDescription,
	fingerprintsMatch,
} from './utils'

// Default configurations
export { defaultRecorderConfig } from './PlaybookRecorder'
export { defaultAdaptiveWaitConfig } from './AdaptiveWait'
export { defaultSelfHealingConfig } from './SelfHealingSelector'
export { defaultEmbeddingConfig } from './ElementEmbeddings'
export { defaultVisualDiffConfig } from './VisualDiff'
export { defaultDOMDiffConfig } from './DOMDiff'
export { defaultDataExtractorConfig } from './DataExtractor'
export { defaultSmartSuggestionsConfig } from './SmartSuggestions'
export { defaultAIReportConfig } from './reporters/AIReportGenerator'
export { defaultPlaywrightGeneratorConfig } from './reporters/PlaywrightGenerator'

// Version
export const VERSION = '1.5.4'
