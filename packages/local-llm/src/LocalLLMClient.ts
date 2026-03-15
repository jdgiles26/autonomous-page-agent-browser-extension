/**
 * LocalLLMClient - Main client for local GGUF model inference
 * Implements the LLMClient interface from @page-agent/llms
 */

// @ts-ignore - workspace dependency
import type { Message, Tool, InvokeResult, InvokeOptions, LLMClient } from '@page-agent/llms'
import { ModelManager } from './ModelManager.js'
import { InferenceEngine } from './InferenceEngine.js'
import { LearningEngine } from './LearningEngine.js'
import { FeedbackLoop } from './FeedbackLoop.js'
import type {
	LocalLLMConfig,
	LocalInferenceResult,
	InferenceOptions,
	LearningExampleMetadata,
} from './types.js'

export class LocalLLMClient extends EventTarget implements LLMClient {
	private config: LocalLLMConfig
	private modelManager: ModelManager
	private inferenceEngine: InferenceEngine
	private learningEngine: LearningEngine
	private feedbackLoop: FeedbackLoop
	private isInitialized = false
	private initPromise: Promise<void> | null = null
	private currentModelId: string | null = null

	constructor(config: LocalLLMConfig) {
		super()
		this.config = {
			...config,
			contextSize: config.contextSize ?? 4096,
			gpuLayers: config.gpuLayers ?? 0,
			learningEnabled: config.learningEnabled ?? true,
			maxLearningExamples: config.maxLearningExamples ?? 10000,
		}

		this.modelManager = new ModelManager()
		this.inferenceEngine = new InferenceEngine({
			contextSize: this.config.contextSize,
			gpuLayers: this.config.gpuLayers,
			useWorker: true,
		})
		this.learningEngine = new LearningEngine({
			enabled: this.config.learningEnabled,
			maxExamples: this.config.maxLearningExamples,
		})
		this.feedbackLoop = new FeedbackLoop(this.learningEngine)

		// Forward events
		this.setupEventForwarding()
	}

	private setupEventForwarding(): void {
		// Forward model manager events
		this.modelManager.addEventListener('model-loaded', (e) => {
			this.dispatchEvent(new CustomEvent('model-loaded', { detail: (e as CustomEvent).detail }))
		})
		this.modelManager.addEventListener('download-progress', (e) => {
			this.dispatchEvent(new CustomEvent('download-progress', { detail: (e as CustomEvent).detail }))
		})

		// Forward feedback loop events
		this.feedbackLoop.addEventListener('adjustment-suggested', (e) => {
			this.dispatchEvent(
				new CustomEvent('adjustment-suggested', { detail: (e as CustomEvent).detail })
			)
		})
	}

	/**
	 * Initialize the client with a model
	 */
	async initialize(): Promise<void> {
		if (this.initPromise) return this.initPromise
		this.initPromise = this.doInitialize()
		return this.initPromise
	}

	private async doInitialize(): Promise<void> {
		// Initialize model manager
		await this.modelManager.initialize()

		// Initialize learning engine
		if (this.config.learningEnabled) {
			await this.learningEngine.initialize()
		}

		// Load model if specified
		if (this.config.modelPath) {
			await this.loadModel(this.config.modelPath)
		} else if (this.config.modelUrl) {
			const modelId = this.config.modelId || this.inferModelIdFromUrl(this.config.modelUrl)
			await this.modelManager.downloadModel(this.config.modelUrl, modelId)
			await this.loadModel(`indexeddb://${modelId}`)
		} else if (this.config.model) {
			// Try to load as preset model
			await this.modelManager.downloadPresetModel(this.config.model)
			await this.loadModel(`indexeddb://${this.config.model}`)
		}

		this.isInitialized = true
	}

	/**
	 * Load a model by path or ID
	 */
	async loadModel(modelPath: string): Promise<void> {
		await this.modelManager.initialize()

		let modelId: string
		let modelBuffer: ArrayBuffer

		if (modelPath.startsWith('indexeddb://')) {
			// Load from IndexedDB
			modelId = modelPath.replace('indexeddb://', '')
			const model = await this.modelManager.getModelBlob(modelId)
			if (!model) {
				throw new Error(`Model not found in storage: ${modelId}`)
			}
			modelBuffer = await model.arrayBuffer()
		} else {
			// Load from file path (Node.js) or File object
			if (typeof window !== 'undefined' && modelPath.startsWith('blob:')) {
				// Browser File object
				const response = await fetch(modelPath)
				modelBuffer = await response.arrayBuffer()
				modelId = `user-${Date.now()}`
			} else {
				// Node.js file system
				// This would require fs module, handled differently in browser vs node
				throw new Error(
					'File system paths not supported in browser. Use indexeddb:// or provide a File object.'
				)
			}
		}

		// Initialize inference engine
		await this.inferenceEngine.initialize(modelBuffer)
		this.currentModelId = modelId
	}

	/**
	 * Infer model ID from download URL
	 */
	private inferModelIdFromUrl(url: string): string {
		const match = url.match(/\/([^\/]+\.gguf)/)
		return match ? match[1].replace('.gguf', '') : `model-${Date.now()}`
	}

	/**
	 * Main invoke method - implements LLMClient interface
	 */
	async invoke(
		messages: Message[],
		tools: Record<string, Tool>,
		abortSignal?: AbortSignal,
		options?: InvokeOptions
	): Promise<InvokeResult> {
		await this.initialize()

		if (!this.inferenceEngine.getIsInitialized()) {
			throw new Error('Inference engine not initialized. Call loadModel() first.')
		}

		// Convert messages to prompt
		const prompt = this.messagesToPrompt(messages, tools, options?.toolChoiceName)

		// Enhance prompt with learning
		const enhanced = await this.learningEngine.enhancePrompt(prompt)
		const finalPrompt = enhanced.enhancedPrompt

		// Get adjusted parameters from feedback loop
		const adjustedParams = this.feedbackLoop.getAdjustedParameters()

		// Generate response
		const inferenceOptions: InferenceOptions = {
			temperature: adjustedParams.temperature,
			topP: adjustedParams.topP,
			maxTokens: adjustedParams.maxTokens,
			stopSequences: ['</s>', 'Human:', 'Assistant:', '<|im_end|>'],
		}

		const startTime = performance.now()
		let result: LocalInferenceResult

		try {
			result = await this.inferenceEngine.generate(finalPrompt, inferenceOptions, abortSignal)
		} catch (error) {
			// Try fallback if configured
			if (this.config.fallbackConfig) {
				return this.fallbackToAPI(messages, tools, abortSignal, options)
			}
			throw error
		}

		// Parse tool call from response
		const toolCall = this.parseToolCall(result.text, tools, options)

		// Execute tool
		const toolDef = tools[toolCall.name]
		if (!toolDef) {
			throw new Error(`Unknown tool: ${toolCall.name}`)
		}

		let toolResult: unknown
		let success = true
		let errorMessage = ''

		try {
			toolResult = await toolDef.execute(toolCall.args)
		} catch (error) {
			success = false
			errorMessage = error instanceof Error ? error.message : String(error)
			toolResult = { error: errorMessage }
		}

		const duration = performance.now() - startTime

		// Record feedback
		const metadata: LearningExampleMetadata = {
			url: typeof window !== 'undefined' ? window.location.href : '',
			taskType: toolCall.name,
			elementCount: this.countElementsInPrompt(prompt),
			executionTime: duration,
			modelId: this.currentModelId || 'unknown',
			timestamp: Date.now(),
		}

		if (success) {
			await this.feedbackLoop.recordSuccess(
				toolCall.name,
				finalPrompt,
				result.text,
				metadata
			)
		} else {
			await this.feedbackLoop.recordFailure(toolCall.name, finalPrompt, errorMessage, metadata)
		}

		return {
			toolCall: {
				name: toolCall.name,
				args: toolCall.args,
			},
			toolResult,
			usage: result.usage,
			rawResponse: result.text,
		}
	}

	/**
	 * Fallback to API-based LLM
	 */
	private async fallbackToAPI(
		messages: Message[],
		tools: Record<string, Tool>,
		abortSignal?: AbortSignal,
		options?: InvokeOptions
	): Promise<InvokeResult> {
		if (!this.config.fallbackConfig) {
			throw new Error('No fallback configuration provided')
		}

		// Dynamic import to avoid circular dependency
		// @ts-ignore - workspace dependency
		const { LLM } = await import('@page-agent/llms')
		const fallbackLLM = new LLM(this.config.fallbackConfig)

		return fallbackLLM.invoke(messages, tools, abortSignal, options)
	}

	/**
	 * Convert messages to a prompt string
	 */
	private messagesToPrompt(
		messages: Message[],
		tools: Record<string, Tool>,
		forcedTool?: string
	): string {
		let prompt = ''

		// System message
		const systemMsg = messages.find((m) => m.role === 'system')
		if (systemMsg?.content) {
			prompt += `<|system|>\n${systemMsg.content}\n`
		}

		// Add tool descriptions
		if (Object.keys(tools).length > 0) {
			prompt += '\nAvailable tools:\n'
			for (const [name, tool] of Object.entries(tools)) {
				prompt += `- ${name}: ${tool.description || 'No description'}\n`
			}
		}

		// User and assistant messages
		for (const msg of messages) {
			if (msg.role === 'user') {
				prompt += `<|user|>\n${msg.content}\n`
			} else if (msg.role === 'assistant') {
				prompt += `<|assistant|>\n${msg.content}\n`
			}
		}

		// Force specific tool if requested
		if (forcedTool) {
			prompt += `\nYou must use the tool: ${forcedTool}\n`
		}

		prompt += '<|assistant|>\n'

		return prompt
	}

	/**
	 * Parse tool call from model response
	 */
	private parseToolCall(
		response: string,
		tools: Record<string, Tool>,
		options?: InvokeOptions
	): { name: string; args: Record<string, unknown> } {
		// Try to parse JSON response
		try {
			// Look for JSON in the response
			const jsonMatch = response.match(/\{[\s\S]*\}/)
			if (jsonMatch) {
				const parsed = JSON.parse(jsonMatch[0])

				// Check if it's a tool call format
				if (parsed.tool || parsed.action || parsed.name) {
					const toolName = parsed.tool || parsed.action || parsed.name
					const args = parsed.parameters || parsed.args || parsed.arguments || parsed

					// Validate tool exists
					if (tools[toolName] || options?.toolChoiceName === toolName) {
						return {
							name: options?.toolChoiceName || toolName,
							args: args,
						}
					}
				}

				// Try to infer tool from response structure
				for (const [name, tool] of Object.entries(tools)) {
					const schema = tool.inputSchema
					if (schema && typeof schema.parse === 'function') {
						try {
							schema.parse(parsed)
							return { name, args: parsed }
						} catch {
							// Not matching this tool
						}
					}
				}
			}
		} catch {
			// JSON parsing failed, try text extraction
		}

		// Fallback: use first tool or forced tool
		const toolName = options?.toolChoiceName || Object.keys(tools)[0]
		if (!toolName) {
			throw new Error('No tools available and no tool choice specified')
		}

		// Try to extract arguments from text
		const args = this.extractArgsFromText(response)

		return { name: toolName, args }
	}

	/**
	 * Extract arguments from text response
	 */
	private extractArgsFromText(text: string): Record<string, unknown> {
		const args: Record<string, unknown> = {}

		// Look for key-value patterns
		const patterns = [
			/(\w+):\s*(.+?)(?=\n\w+:|$)/gs,
			/(\w+)\s*=\s*(.+?)(?=\n\w+\s*=|$)/gs,
		]

		for (const pattern of patterns) {
			let match
			while ((match = pattern.exec(text)) !== null) {
				const key = match[1].trim()
				const value = match[2].trim()

				// Try to parse as number or boolean
				if (/^\d+$/.test(value)) {
					args[key] = parseInt(value, 10)
				} else if (/^\d+\.\d+$/.test(value)) {
					args[key] = parseFloat(value)
				} else if (value.toLowerCase() === 'true') {
					args[key] = true
				} else if (value.toLowerCase() === 'false') {
					args[key] = false
				} else {
					args[key] = value
				}
			}
		}

		return args
	}

	/**
	 * Count elements mentioned in prompt
	 */
	private countElementsInPrompt(prompt: string): number {
		const matches = prompt.match(/\[\d+\]/g)
		return matches ? new Set(matches).size : 0
	}

	/**
	 * Get learning statistics
	 */
	async getLearningStats() {
		return this.learningEngine.getStats()
	}

	/**
	 * Get feedback summary
	 */
	getFeedbackSummary() {
		return this.feedbackLoop.getFeedbackSummary()
	}

	/**
	 * Export learning data
	 */
	async exportLearningData(): Promise<string> {
		return this.learningEngine.exportLearningData()
	}

	/**
	 * Import learning data
	 */
	async importLearningData(data: string): Promise<void> {
		return this.learningEngine.importLearningData(data)
	}

	/**
	 * Get the model manager
	 */
	getModelManager(): ModelManager {
		return this.modelManager
	}

	/**
	 * Get the learning engine
	 */
	getLearningEngine(): LearningEngine {
		return this.learningEngine
	}

	/**
	 * Dispose of resources
	 */
	async dispose(): Promise<void> {
		await this.inferenceEngine.dispose()
		this.modelManager.unloadModel()
	}
}
