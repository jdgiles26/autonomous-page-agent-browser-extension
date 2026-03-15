/**
 * Core types for local GGUF model inference and learning
 */

// Import types from @page-agent/llms - these will be resolved at build time
// @ts-ignore - workspace dependency
import type { LLMConfig, Message, Tool, InvokeResult, InvokeOptions } from '@page-agent/llms'

/**
 * Configuration for local GGUF models
 */
export interface LocalLLMConfig extends LLMConfig {
	/** Preset model ID to use (e.g., 'llama-3.2-3b-instruct-q4') */
	model?: string
	/** Path to GGUF file or 'indexeddb://model-id' for cached models */
	modelPath?: string
	/** URL to download model from (e.g., HuggingFace) */
	modelUrl?: string
	/** Unique identifier for the model */
	modelId?: string
	/** Context window size (default: 4096) */
	contextSize?: number
	/** Number of layers to offload to GPU (default: 0, CPU only) */
	gpuLayers?: number
	/** Use memory mapping for model loading (default: true) */
	useMmap?: boolean
	/** Lock model in memory (default: false) */
	useMlock?: boolean
	/** Enable continuous learning (default: true) */
	learningEnabled?: boolean
	/** Maximum learning examples to store (default: 10000) */
	maxLearningExamples?: number
	/** Fallback to API-based LLM if local model fails */
	fallbackConfig?: LLMConfig
}

/**
 * Model metadata stored in IndexedDB
 */
export interface ModelMetadata {
	id: string
	name: string
	size: number
	contextSize: number
	parameters?: string
	quantization?: string
	downloadedAt: number
	lastUsedAt: number
	useCount: number
	sha256?: string
}

/**
 * Preset models available for download
 */
export interface PresetModel {
	id: string
	name: string
	url: string
	size: string
	description: string
	contextSize: number
	parameters: string
	quantization: string
}

/**
 * Inference options for local models
 */
export interface InferenceOptions {
	temperature?: number
	maxTokens?: number
	stopSequences?: string[]
	seed?: number
	repeatPenalty?: number
	topK?: number
	topP?: number
}

/**
 * Metadata for learning examples
 */
export interface LearningExampleMetadata {
	url: string
	taskType: string
	elementCount: number
	executionTime: number
	modelId: string
	timestamp: number
}

/**
 * A single learning example from agent interactions
 */
export interface LearningExample {
	id: string
	prompt: string
	context: string
	response: string
	success: boolean
	timestamp: number
	metadata: LearningExampleMetadata
}

/**
 * Statistics about the learning system
 */
export interface LearningStats {
	totalExamples: number
	successfulExamples: number
	failedExamples: number
	accuracy: number
	averageExecutionTime: number
	topPatterns: Array<{
		pattern: string
		type: 'domain' | 'task' | 'selector' | 'prompt'
		successRate: number
		count: number
	}>
}

/**
 * Feedback event for learning system
 */
export interface FeedbackEvent {
	type: 'success' | 'failure' | 'partial'
	step: string
	prompt: string
	response: string
	error?: string
	metadata: LearningExampleMetadata
}

/**
 * Pattern extracted from learning examples
 */
export interface LearningPattern {
	id: string
	type: 'domain' | 'task' | 'selector' | 'prompt'
	pattern: string
	successRate: number
	count: number
	createdAt: number
	lastUsedAt: number
}

/**
 * Storage quota information
 */
export interface StorageQuota {
	used: number
	total: number
}

/**
 * Download progress event
 */
export interface DownloadProgress {
	loaded: number
	total: number
	percentage: number
}

/**
 * Inference result with metadata
 */
export interface LocalInferenceResult {
	text: string
	usage: {
		promptTokens: number
		completionTokens: number
		totalTokens: number
	}
	generationTime: number
}

/**
 * Worker message types for inference
 */
export interface WorkerMessageInit {
	type: 'init'
	modelPath: string
	options?: { gpuLayers?: number; contextSize?: number }
}

export interface WorkerMessageGenerate {
	type: 'generate'
	prompt: string
	options?: InferenceOptions
}

export interface WorkerMessageGenerateStream {
	type: 'generateStream'
	prompt: string
	options?: InferenceOptions
}

export interface WorkerMessageDispose {
	type: 'dispose'
}

export interface WorkerMessagePing {
	type: 'ping'
}

export type WorkerMessage =
	| WorkerMessageInit
	| WorkerMessageGenerate
	| WorkerMessageGenerateStream
	| WorkerMessageDispose
	| WorkerMessagePing

export type WorkerResponse =
	| { type: 'init'; success: boolean; error?: string; id: string }
	| { type: 'generate'; id: string; result: LocalInferenceResult; error?: string }
	| { type: 'generateStream'; id: string; chunk: string; done: boolean; error?: string }
	| { type: 'dispose'; success: boolean; error?: string; id: string }
	| { type: 'pong'; id: string }
	| { type: 'progress'; loaded: number; total: number }

/**
 * Re-export types from @page-agent/llms for convenience
 */
export type { Message, Tool, InvokeResult, InvokeOptions, LLMConfig }
