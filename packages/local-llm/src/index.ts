/**
 * @page-agent/local-llm
 * Local GGUF model inference with continuous learning for page-agent
 */

// Core client
export { LocalLLMClient } from './LocalLLMClient.js'

// Components
export { ModelManager, PRESET_MODELS } from './ModelManager.js'
export { InferenceEngine } from './InferenceEngine.js'
export { LearningEngine } from './LearningEngine.js'
export { FeedbackLoop } from './FeedbackLoop.js'

// Storage
export { ModelStorage } from './storage/ModelStorage.js'
export { LearningStorage } from './storage/LearningStorage.js'

// UI Components
export { ModelSelector } from './ui/ModelSelector.js'
export { LearningDashboard } from './ui/LearningDashboard.js'

// Types
export type {
	LocalLLMConfig,
	ModelMetadata,
	PresetModel,
	InferenceOptions,
	LearningExample,
	LearningExampleMetadata,
	LearningStats,
	LearningPattern,
	FeedbackEvent,
	StorageQuota,
	DownloadProgress,
	LocalInferenceResult,
	WorkerMessage,
	WorkerResponse,
	// Re-exports from @page-agent/llms
	Message,
	Tool,
	InvokeResult,
	InvokeOptions,
	LLMConfig,
} from './types.js'

// Utility function to create a local LLM client
import type { LocalLLMConfig } from './types.js'
import { LocalLLMClient } from './LocalLLMClient.js'

/**
 * Create a local LLM client with the given configuration
 */
export function createLocalLLM(config: LocalLLMConfig): LocalLLMClient {
	return new LocalLLMClient(config)
}

// Factory function to create LLM with local client
// @ts-ignore - workspace dependency
import { LLM, type LLMConfig } from '@page-agent/llms'

/**
 * Create an LLM instance with local GGUF model support
 * This factory creates an LLM instance configured to use a local model
 * 
 * @example
 * ```typescript
 * import { createLocalLLMClient } from '@page-agent/local-llm'
 * import { PageAgent } from 'page-agent'
 * 
 * // Use preset model
 * const agent = new PageAgent({
 *   llm: createLocalLLMClient({ model: 'llama-3.2-3b-instruct-q4' })
 * })
 * 
 * // Use downloaded model
 * const agent = new PageAgent({
 *   llm: createLocalLLMClient({ modelPath: 'indexeddb://my-model' })
 * })
 * ```
 */
export function createLocalLLMClient(config: Omit<LocalLLMConfig, 'baseURL' | 'apiKey'>): LLM {
	// Create a dummy config that satisfies LLMConfig requirements
	// The actual inference will use the local client
	const fullConfig = config as LocalLLMConfig
	const dummyConfig: LLMConfig = {
		baseURL: 'http://localhost:11434', // Ollama default, won't be used
		apiKey: 'local',
		model: fullConfig.model || fullConfig.modelId || 'local-model',
		temperature: (fullConfig as any).temperature,
		maxRetries: 0, // Local models don't retry
	}

	const localClient = new LocalLLMClient({
		...dummyConfig,
		...fullConfig,
	})

	return new LLM(dummyConfig, { client: localClient })
}

/**
 * Check if local LLM is supported in the current environment
 */
export function isLocalLLMSupported(): boolean {
	// Check for required APIs
	const hasIndexedDB = typeof indexedDB !== 'undefined'
	const hasWebWorkers = typeof Worker !== 'undefined'
	const hasWebAssembly = typeof WebAssembly !== 'undefined'

	return hasIndexedDB && hasWebWorkers && hasWebAssembly
}

/**
 * Get storage estimate for models
 */
export async function getStorageEstimate(): Promise<{
	supported: boolean
	quota?: number
	usage?: number
	remaining?: number
}> {
	if (!isLocalLLMSupported()) {
		return { supported: false }
	}

	try {
		if ('storage' in navigator && 'estimate' in navigator.storage) {
			const estimate = await navigator.storage.estimate()
			return {
				supported: true,
				quota: estimate.quota,
				usage: estimate.usage,
				remaining: estimate.quota && estimate.usage ? estimate.quota - estimate.usage : undefined,
			}
		}
	} catch {
		// Ignore errors
	}

	return { supported: true }
}
