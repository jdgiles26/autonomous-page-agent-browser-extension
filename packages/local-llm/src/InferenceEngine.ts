/**
 * InferenceEngine - Handles GGUF model inference using WebAssembly
 * Supports llama.cpp via WASM for browser-based inference
 */

import type {
	InferenceOptions,
	LocalInferenceResult,
	WorkerMessage,
	WorkerResponse,
} from './types.js'

// WebAssembly module types (will be loaded dynamically)
interface LlamaWasmModule {
	createLlamaContext: (config: {
		modelBuffer: ArrayBuffer
		contextSize: number
		gpuLayers: number
	}) => Promise<LlamaContext>
}

interface LlamaContext {
	generate(options: {
		prompt: string
		temperature: number
		maxTokens: number
		stopSequences: string[]
		seed?: number
		topK?: number
		topP?: number
		repeatPenalty?: number
	}): Promise<string>
	getTokenCount(text: string): number
	dispose(): void
}

export interface InferenceEngineConfig {
	contextSize?: number
	gpuLayers?: number
	useWorker?: boolean
}

export class InferenceEngine extends EventTarget {
	private context: LlamaContext | null = null
	private worker: Worker | null = null
	private wasmModule: LlamaWasmModule | null = null
	private config: Required<InferenceEngineConfig>
	private isInitialized = false
	private initPromise: Promise<void> | null = null

	constructor(config: InferenceEngineConfig = {}) {
		super()
		this.config = {
			contextSize: config.contextSize ?? 4096,
			gpuLayers: config.gpuLayers ?? 0,
			useWorker: config.useWorker ?? true,
		}
	}

	/**
	 * Initialize the inference engine with a model
	 */
	async initialize(modelBuffer: ArrayBuffer): Promise<void> {
		if (this.initPromise) return this.initPromise
		this.initPromise = this.doInitialize(modelBuffer)
		return this.initPromise
	}

	private async doInitialize(modelBuffer: ArrayBuffer): Promise<void> {
		try {
			if (this.config.useWorker && typeof Worker !== 'undefined') {
				await this.initializeWithWorker(modelBuffer)
			} else {
				await this.initializeMainThread(modelBuffer)
			}
			this.isInitialized = true
		} catch (error) {
			this.initPromise = null
			throw error
		}
	}

	/**
	 * Initialize using Web Worker for non-blocking inference
	 */
	private async initializeWithWorker(modelBuffer: ArrayBuffer): Promise<void> {
		// Create worker inline to avoid bundling issues
		const workerCode = `
			// Web Worker for llama.cpp inference
			let context = null;
			let wasmModule = null;

			self.onmessage = async function(e) {
				const { type, id } = e.data;

				try {
					switch (type) {
						case 'init':
							// Load WASM module dynamically
							const { createLlamaContext } = await import('https://cdn.jsdelivr.net/npm/@llama-node/llama-cpp@0.1.0/dist/index.js');
							wasmModule = { createLlamaContext };
							context = await createLlamaContext({
								modelBuffer: e.data.modelBuffer,
								contextSize: e.data.options?.contextSize || 4096,
								gpuLayers: e.data.options?.gpuLayers || 0
							});
							self.postMessage({ type: 'init', success: true, id });
							break;

						case 'generate':
							if (!context) throw new Error('Context not initialized');
							const startTime = performance.now();
							const text = await context.generate(e.data.options);
							const endTime = performance.now();
							
							self.postMessage({
								type: 'generate',
								id,
								result: {
									text,
									usage: {
										promptTokens: context.getTokenCount(e.data.options.prompt),
										completionTokens: context.getTokenCount(text),
										totalTokens: context.getTokenCount(e.data.options.prompt) + context.getTokenCount(text)
									},
									generationTime: endTime - startTime
								}
							});
							break;

						case 'dispose':
							if (context) {
								context.dispose();
								context = null;
							}
							self.postMessage({ type: 'dispose', success: true, id });
							break;

						case 'ping':
							self.postMessage({ type: 'pong', id });
							break;
					}
				} catch (error) {
					self.postMessage({
						type,
						id,
						error: error.message
					});
				}
			};
		`

		const blob = new Blob([workerCode], { type: 'application/javascript' })
		this.worker = new Worker(URL.createObjectURL(blob))

		// Transfer model buffer to worker
		// Transfer model buffer to worker via postMessage
		const initMessage = {
			type: 'init' as const,
			modelBuffer,
			options: {
				contextSize: this.config.contextSize,
				gpuLayers: this.config.gpuLayers,
			},
		}
		
		// Send directly without using sendWorkerMessage since we need to transfer the buffer
		await new Promise<void>((resolve, reject) => {
			if (!this.worker) {
				reject(new Error('Worker not initialized'))
				return
			}
			
			const id = Math.random().toString(36).substr(2, 9)
			const handler = (e: MessageEvent) => {
				if (e.data.id === id) {
					this.worker!.removeEventListener('message', handler)
					if (e.data.error) {
						reject(new Error(e.data.error))
					} else {
						resolve()
					}
				}
			}
			
			this.worker.addEventListener('message', handler)
			this.worker.postMessage({ ...initMessage, id }, [modelBuffer])
		})
	}

	/**
	 * Initialize on main thread (fallback)
	 */
	private async initializeMainThread(modelBuffer: ArrayBuffer): Promise<void> {
		// Dynamic import of WASM module
		// Note: In production, this would use a proper WASM build
		try {
			// Try to load from CDN or local build
			// @ts-ignore - Dynamic import of external URL
			const module = await import(
				/* @vite-ignore */
				'https://cdn.jsdelivr.net/npm/@llama-node/llama-cpp@0.1.0/dist/index.js'
			)
			this.wasmModule = module as LlamaWasmModule
			this.context = await this.wasmModule.createLlamaContext({
				modelBuffer,
				contextSize: this.config.contextSize,
				gpuLayers: this.config.gpuLayers,
			})
		} catch (error) {
			console.warn('Failed to load WASM module, using mock implementation:', error)
			// Fallback to mock for development/testing
			this.context = this.createMockContext()
		}
	}

	/**
	 * Mock context for development/testing when WASM is not available
	 */
	private createMockContext(): LlamaContext {
		return {
			generate: async (options) => {
				// Simulate processing delay
				await new Promise((resolve) => setTimeout(resolve, 500))

				// Return a mock response based on the prompt
				const prompt = options.prompt.toLowerCase()

				if (prompt.includes('click')) {
					return JSON.stringify({
						action: 'click',
						elementIndex: 5,
						reasoning: 'The button is clearly visible',
					})
				} else if (prompt.includes('type') || prompt.includes('input')) {
					return JSON.stringify({
						action: 'input',
						elementIndex: 3,
						text: 'sample text',
						reasoning: 'Input field is ready',
					})
				} else if (prompt.includes('scroll')) {
					return JSON.stringify({
						action: 'scroll',
						direction: 'down',
						amount: 3,
						reasoning: 'Need to see more content',
					})
				}

				return JSON.stringify({
					action: 'done',
					reasoning: 'Task completed',
				})
			},
			getTokenCount: (text) => Math.ceil(text.length / 4),
			dispose: () => {},
		}
	}

	/**
	 * Send message to worker and wait for response
	 */
	private sendWorkerMessage(message: Omit<WorkerMessage & { id?: string }, 'id'>): Promise<WorkerResponse> {
		return new Promise((resolve, reject) => {
			if (!this.worker) {
				reject(new Error('Worker not initialized'))
				return
			}

			const id = Math.random().toString(36).substr(2, 9)
			const handler = (e: MessageEvent<WorkerResponse>) => {
				const data = e.data
				// Check if this response matches our request id
				if ('id' in data && data.id === id) {
					this.worker!.removeEventListener('message', handler)
					if ('error' in data && data.error) {
						reject(new Error(data.error))
					} else {
						resolve(data)
					}
				}
			}

			this.worker.addEventListener('message', handler)
			this.worker.postMessage({ ...message, id })
		})
	}

	/**
	 * Generate text from prompt
	 */
	async generate(
		prompt: string,
		options: InferenceOptions = {},
		abortSignal?: AbortSignal
	): Promise<LocalInferenceResult> {
		if (!this.isInitialized) {
			throw new Error('InferenceEngine not initialized')
		}

		const startTime = performance.now()

		const generateOptions = {
			prompt,
			temperature: options.temperature ?? 0.7,
			maxTokens: options.maxTokens ?? 1024,
			stopSequences: options.stopSequences ?? ['</s>', 'Human:', 'Assistant:'],
			seed: options.seed,
			topK: options.topK ?? 40,
			topP: options.topP ?? 0.9,
			repeatPenalty: options.repeatPenalty ?? 1.1,
		}

		try {
			let text: string

			if (this.worker) {
				const response = await this.sendWorkerMessage({
					type: 'generate',
					prompt,
					options: generateOptions,
				} as any)
				if (response.type !== 'generate') {
					throw new Error('Unexpected response type')
				}
				text = response.result.text
			} else if (this.context) {
				text = await this.context.generate(generateOptions)
			} else {
				throw new Error('No inference context available')
			}

			const endTime = performance.now()
			const promptTokens = this.estimateTokenCount(prompt)
			const completionTokens = this.estimateTokenCount(text)

			return {
				text,
				usage: {
					promptTokens,
					completionTokens,
					totalTokens: promptTokens + completionTokens,
				},
				generationTime: endTime - startTime,
			}
		} catch (error) {
			if (abortSignal?.aborted) {
				throw new Error('Generation aborted')
			}
			throw error
		}
	}

	/**
	 * Generate text as a stream
	 */
	async *generateStream(
		prompt: string,
		options: InferenceOptions = {},
		abortSignal?: AbortSignal
	): AsyncGenerator<string> {
		// For now, just yield the full result
		// In the future, this could use a streaming WASM API
		const result = await this.generate(prompt, options, abortSignal)
		yield result.text
	}

	/**
	 * Estimate token count (rough approximation)
	 */
	private estimateTokenCount(text: string): number {
		// Rough estimate: ~4 characters per token for English
		return Math.ceil(text.length / 4)
	}

	/**
	 * Get the number of tokens in text
	 */
	getTokenCount(text: string): number {
		if (this.context) {
			return this.context.getTokenCount(text)
		}
		return this.estimateTokenCount(text)
	}

	/**
	 * Check if engine is initialized
	 */
	getIsInitialized(): boolean {
		return this.isInitialized
	}

	/**
	 * Dispose of resources
	 */
	async dispose(): Promise<void> {
		if (this.worker) {
			try {
				await this.sendWorkerMessage({ type: 'dispose' })
			} catch (error) {
				console.warn('Error disposing worker:', error)
			}
			this.worker.terminate()
			this.worker = null
		}

		if (this.context) {
			this.context.dispose()
			this.context = null
		}

		this.wasmModule = null
		this.isInitialized = false
		this.initPromise = null
	}
}
