/**
 * ModelManager - Handles GGUF model discovery, download, caching, and loading
 */

import { ModelStorage } from './storage/ModelStorage.js'
import type {
	ModelMetadata,
	PresetModel,
	DownloadProgress,
	LocalLLMConfig,
} from './types.js'

/**
 * Preset models available for download
 * These are curated models that work well for UI automation tasks
 */
export const PRESET_MODELS: PresetModel[] = [
	{
		id: 'llama-3.2-1b-instruct-q4',
		name: 'Llama 3.2 1B Instruct (Q4)',
		url: 'https://huggingface.co/bartowski/Llama-3.2-1B-Instruct-GGUF/resolve/main/Llama-3.2-1B-Instruct-Q4_K_M.gguf',
		size: '800 MB',
		description: 'Fast, lightweight model good for simple tasks',
		contextSize: 8192,
		parameters: '1B',
		quantization: 'Q4_K_M',
	},
	{
		id: 'llama-3.2-3b-instruct-q4',
		name: 'Llama 3.2 3B Instruct (Q4)',
		url: 'https://huggingface.co/bartowski/Llama-3.2-3B-Instruct-GGUF/resolve/main/Llama-3.2-3B-Instruct-Q4_K_M.gguf',
		size: '1.9 GB',
		description: 'Balanced speed and quality for most tasks',
		contextSize: 8192,
		parameters: '3B',
		quantization: 'Q4_K_M',
	},
	{
		id: 'qwen2.5-3b-instruct-q4',
		name: 'Qwen 2.5 3B Instruct (Q4)',
		url: 'https://huggingface.co/bartowski/Qwen2.5-3B-Instruct-GGUF/resolve/main/Qwen2.5-3B-Instruct-Q4_K_M.gguf',
		size: '1.9 GB',
		description: 'Excellent for instruction following and tool use',
		contextSize: 8192,
		parameters: '3B',
		quantization: 'Q4_K_M',
	},
	{
		id: 'phi-4-mini-instruct-q4',
		name: 'Phi-4 Mini Instruct (Q4)',
		url: 'https://huggingface.co/bartowski/Phi-4-mini-instruct-GGUF/resolve/main/Phi-4-mini-instruct-Q4_K_M.gguf',
		size: '2.4 GB',
		description: 'Microsoft Phi-4, great reasoning for UI tasks',
		contextSize: 8192,
		parameters: '3.8B',
		quantization: 'Q4_K_M',
	},
	{
		id: 'gemma-2-2b-it-q4',
		name: 'Gemma 2 2B IT (Q4)',
		url: 'https://huggingface.co/bartowski/gemma-2-2b-it-GGUF/resolve/main/gemma-2-2b-it-Q4_K_M.gguf',
		size: '1.6 GB',
		description: 'Google Gemma 2, good for concise responses',
		contextSize: 8192,
		parameters: '2B',
		quantization: 'Q4_K_M',
	},
]

export interface ModelManagerEvents {
	'model-loaded': ModelMetadata
	'model-unloaded': void
	'download-progress': DownloadProgress & { modelId: string }
	'download-complete': { modelId: string; metadata: ModelMetadata }
	'download-error': { modelId: string; error: Error }
	'storage-error': Error
}

export class ModelManager extends EventTarget {
	private storage: ModelStorage
	private currentModel: ModelMetadata | null = null
	private downloadAbortController: AbortController | null = null
	private isInitialized = false

	constructor() {
		super()
		this.storage = new ModelStorage()
	}

	/**
	 * Initialize the model manager
	 */
	async initialize(): Promise<void> {
		if (this.isInitialized) return
		await this.storage.initialize()
		this.isInitialized = true
	}

	/**
	 * Get preset models list
	 */
	getPresetModels(): PresetModel[] {
		return PRESET_MODELS
	}

	/**
	 * Get a specific preset model by ID
	 */
	getPresetModel(id: string): PresetModel | undefined {
		return PRESET_MODELS.find((m) => m.id === id)
	}

	/**
	 * Check if a model is cached locally
	 */
	async isModelCached(modelId: string): Promise<boolean> {
		await this.initialize()
		return this.storage.hasModel(modelId)
	}

	/**
	 * Get list of cached models
	 */
	async getCachedModels(): Promise<ModelMetadata[]> {
		await this.initialize()
		return this.storage.listModels()
	}

	/**
	 * Download a model from URL
	 */
	async downloadModel(
		url: string,
		modelId: string,
		metadata?: Partial<ModelMetadata>
	): Promise<ModelMetadata> {
		await this.initialize()

		// Check if already cached
		if (await this.storage.hasModel(modelId)) {
			const existing = await this.storage.getModel(modelId)
			if (existing) {
				return existing.metadata
			}
		}

		// Cancel any existing download
		if (this.downloadAbortController) {
			this.downloadAbortController.abort()
		}
		this.downloadAbortController = new AbortController()

		try {
			const response = await fetch(url, {
				signal: this.downloadAbortController.signal,
			})

			if (!response.ok) {
				throw new Error(`Failed to download model: ${response.status} ${response.statusText}`)
			}

			const contentLength = parseInt(response.headers.get('content-length') || '0')
			const preset = this.getPresetModel(modelId)

			const modelMetadata: ModelMetadata = {
				id: modelId,
				name: metadata?.name || preset?.name || modelId,
				size: contentLength || metadata?.size || 0,
				contextSize: metadata?.contextSize || preset?.contextSize || 4096,
				parameters: metadata?.parameters || preset?.parameters,
				quantization: metadata?.quantization || preset?.quantization,
				downloadedAt: Date.now(),
				lastUsedAt: Date.now(),
				useCount: 0,
				sha256: metadata?.sha256,
			}

			if (!response.body) {
				throw new Error('Response body is null')
			}

			// Store with progress tracking
			await this.storage.storeModelChunked(
				modelMetadata,
				response.body,
				(progress) => {
					this.dispatchEvent(
						new CustomEvent('download-progress', {
							detail: { ...progress, modelId },
						})
					)
				}
			)

			this.dispatchEvent(
				new CustomEvent('download-complete', {
					detail: { modelId, metadata: modelMetadata },
				})
			)

			return modelMetadata
		} catch (error) {
			this.dispatchEvent(
				new CustomEvent('download-error', {
					detail: { modelId, error: error instanceof Error ? error : new Error(String(error)) },
				})
			)
			throw error
		} finally {
			this.downloadAbortController = null
		}
	}

	/**
	 * Download a preset model by ID
	 */
	async downloadPresetModel(modelId: string): Promise<ModelMetadata> {
		const preset = this.getPresetModel(modelId)
		if (!preset) {
			throw new Error(`Unknown preset model: ${modelId}`)
		}

		return this.downloadModel(preset.url, modelId, {
			name: preset.name,
			size: this.parseSize(preset.size),
			contextSize: preset.contextSize,
			parameters: preset.parameters,
			quantization: preset.quantization,
		})
	}

	/**
	 * Parse human-readable size to bytes
	 */
	private parseSize(sizeStr: string): number {
		const units: Record<string, number> = {
			B: 1,
			KB: 1024,
			MB: 1024 * 1024,
			GB: 1024 * 1024 * 1024,
		}
		const match = sizeStr.match(/^(\d+(?:\.\d+)?)\s*(B|KB|MB|GB)$/i)
		if (!match) return 0
		const [, num, unit] = match
		return parseFloat(num) * (units[unit.toUpperCase()] || 1)
	}

	/**
	 * Cancel current download
	 */
	cancelDownload(): void {
		if (this.downloadAbortController) {
			this.downloadAbortController.abort()
			this.downloadAbortController = null
		}
	}

	/**
	 * Load a model for use
	 */
	async loadModel(modelId: string): Promise<ModelMetadata> {
		await this.initialize()

		// Check if already loaded
		if (this.currentModel?.id === modelId) {
			return this.currentModel
		}

		// Get from storage
		const model = await this.storage.getModel(modelId)
		if (!model) {
			// Try to download if it's a preset
			const preset = this.getPresetModel(modelId)
			if (preset) {
				const metadata = await this.downloadPresetModel(modelId)
				this.currentModel = metadata
				this.dispatchEvent(new CustomEvent('model-loaded', { detail: metadata }))
				return metadata
			}
			throw new Error(`Model not found: ${modelId}`)
		}

		this.currentModel = model.metadata
		this.dispatchEvent(new CustomEvent('model-loaded', { detail: model.metadata }))
		return model.metadata
	}

	/**
	 * Load model from user-provided file
	 */
	async loadModelFromFile(file: File, modelId?: string): Promise<ModelMetadata> {
		await this.initialize()

		const id = modelId || `user-${file.name}-${Date.now()}`

		const metadata: ModelMetadata = {
			id,
			name: file.name,
			size: file.size,
			contextSize: 4096, // Default, can be updated after loading
			parameters: this.inferParameters(file.name),
			quantization: this.inferQuantization(file.name),
			downloadedAt: Date.now(),
			lastUsedAt: Date.now(),
			useCount: 0,
		}

		await this.storage.storeModel(metadata, file)
		this.currentModel = metadata
		this.dispatchEvent(new CustomEvent('model-loaded', { detail: metadata }))
		return metadata
	}

	/**
	 * Infer parameter count from filename
	 */
	private inferParameters(filename: string): string | undefined {
		const match = filename.match(/(\d+\.?\d*)[Bb]/)
		return match ? match[1] + 'B' : undefined
	}

	/**
	 * Infer quantization from filename
	 */
	private inferQuantization(filename: string): string | undefined {
		const quantPatterns = ['Q4_K_M', 'Q5_K_M', 'Q6_K', 'Q8_0', 'Q4_0', 'Q5_0', 'FP16']
		for (const quant of quantPatterns) {
			if (filename.includes(quant)) return quant
		}
		return undefined
	}

	/**
	 * Get the currently loaded model
	 */
	getLoadedModel(): ModelMetadata | null {
		return this.currentModel
	}

	/**
	 * Unload the current model
	 */
	unloadModel(): void {
		if (this.currentModel) {
			this.currentModel = null
			this.dispatchEvent(new CustomEvent('model-unloaded'))
		}
	}

	/**
	 * Get model data as Blob
	 */
	async getModelBlob(modelId: string): Promise<Blob | null> {
		await this.initialize()
		const model = await this.storage.getModel(modelId)
		return model?.blob || null
	}

	/**
	 * Get model data as ReadableStream
	 */
	async getModelStream(modelId: string): Promise<ReadableStream<Uint8Array> | null> {
		await this.initialize()
		return this.storage.getModelStream(modelId)
	}

	/**
	 * Delete a cached model
	 */
	async deleteModel(modelId: string): Promise<void> {
		await this.initialize()

		if (this.currentModel?.id === modelId) {
			this.unloadModel()
		}

		await this.storage.deleteModel(modelId)
	}

	/**
	 * Get storage quota information
	 */
	async getStorageQuota(): Promise<{ used: number; total: number }> {
		await this.initialize()
		return this.storage.getStorageQuota()
	}

	/**
	 * Get total storage used by models
	 */
	async getTotalStorageUsed(): Promise<number> {
		await this.initialize()
		return this.storage.getTotalStorageUsed()
	}

	/**
	 * Clean up old models
	 */
	async cleanupOldModels(maxAgeDays: number): Promise<number> {
		await this.initialize()
		return this.storage.cleanupOldModels(maxAgeDays * 24 * 60 * 60 * 1000)
	}

	/**
	 * Estimate if there's enough storage for a model
	 */
	async hasEnoughStorage(requiredBytes: number): Promise<boolean> {
		const quota = await this.getStorageQuota()
		if (quota.total === 0) return true // Can't determine, assume yes
		return quota.total - quota.used >= requiredBytes
	}
}
