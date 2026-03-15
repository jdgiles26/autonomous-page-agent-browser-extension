/**
 * ModelSelector UI Component
 * Provides a user interface for selecting, downloading, and managing local GGUF models
 */

import type { ModelManager } from '../ModelManager.js'
import type { ModelMetadata, PresetModel, DownloadProgress } from '../types.js'

export interface ModelSelectorConfig {
	modelManager: ModelManager
	container?: HTMLElement
	onModelSelect?: (model: ModelMetadata) => void
	onDownloadProgress?: (progress: DownloadProgress & { modelId: string }) => void
	onError?: (error: Error) => void
}

export class ModelSelector extends EventTarget {
	private config: ModelSelectorConfig
	private container: HTMLElement
	private currentDownload: string | null = null

	constructor(config: ModelSelectorConfig) {
		super()
		this.config = config
		this.container = config.container || this.createDefaultContainer()
		this.setupEventListeners()
	}

	private createDefaultContainer(): HTMLElement {
		const div = document.createElement('div')
		div.className = 'page-agent-model-selector'
		div.innerHTML = `
			<style>
				.page-agent-model-selector {
					font-family: system-ui, -apple-system, sans-serif;
					padding: 16px;
					background: #f5f5f5;
					border-radius: 8px;
					max-width: 600px;
				}
				.model-section {
					margin-bottom: 20px;
				}
				.model-section h3 {
					margin: 0 0 12px 0;
					font-size: 14px;
					text-transform: uppercase;
					color: #666;
				}
				.model-grid {
					display: grid;
					gap: 8px;
				}
				.model-card {
					background: white;
					padding: 12px;
					border-radius: 6px;
					border: 2px solid transparent;
					cursor: pointer;
					transition: all 0.2s;
				}
				.model-card:hover {
					border-color: #007acc;
				}
				.model-card.selected {
					border-color: #007acc;
					background: #e6f3ff;
				}
				.model-card.downloading {
					opacity: 0.7;
					pointer-events: none;
				}
				.model-name {
					font-weight: 600;
					margin-bottom: 4px;
				}
				.model-info {
					font-size: 12px;
					color: #666;
				}
				.model-description {
					font-size: 12px;
					color: #888;
					margin-top: 4px;
				}
				.progress-bar {
					width: 100%;
					height: 4px;
					background: #ddd;
					border-radius: 2px;
					margin-top: 8px;
					overflow: hidden;
				}
				.progress-fill {
					height: 100%;
					background: #007acc;
					transition: width 0.3s;
				}
				.file-input-wrapper {
					position: relative;
					overflow: hidden;
					display: inline-block;
				}
				.file-input-wrapper input[type=file] {
					position: absolute;
					left: 0;
					top: 0;
					opacity: 0;
					cursor: pointer;
					width: 100%;
					height: 100%;
				}
				.btn {
					padding: 8px 16px;
					background: #007acc;
					color: white;
					border: none;
					border-radius: 4px;
					cursor: pointer;
					font-size: 14px;
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
				.storage-info {
					font-size: 12px;
					color: #666;
					margin-top: 16px;
					padding-top: 16px;
					border-top: 1px solid #ddd;
				}
			</style>
			<div class="model-section">
				<h3>Download Models</h3>
				<div class="model-grid" id="preset-models"></div>
			</div>
			<div class="model-section">
				<h3>Cached Models</h3>
				<div class="model-grid" id="cached-models"></div>
			</div>
			<div class="model-section">
				<h3>Upload Model</h3>
				<div class="file-input-wrapper">
					<button class="btn">Choose GGUF File</button>
					<input type="file" id="file-input" accept=".gguf" />
				</div>
			</div>
			<div class="storage-info" id="storage-info"></div>
		`
		return div
	}

	private setupEventListeners(): void {
		const fileInput = this.container.querySelector('#file-input') as HTMLInputElement
		if (fileInput) {
			fileInput.addEventListener('change', (e) => this.handleFileSelect(e))
		}

		// Listen to model manager events
		this.config.modelManager.addEventListener('download-progress', (e) => {
			const progress = (e as CustomEvent<DownloadProgress & { modelId: string }>).detail
			this.updateDownloadProgress(progress)
			this.config.onDownloadProgress?.(progress)
		})

		this.config.modelManager.addEventListener('download-complete', () => {
			this.currentDownload = null
			this.render()
		})

		this.config.modelManager.addEventListener('download-error', (e) => {
			const { error } = (e as CustomEvent<{ modelId: string; error: Error }>).detail
			this.currentDownload = null
			this.config.onError?.(error)
			this.render()
		})
	}

	/**
	 * Render the model selector
	 */
	async render(): Promise<void> {
		await this.renderPresetModels()
		await this.renderCachedModels()
		await this.renderStorageInfo()
	}

	/**
	 * Render preset models section
	 */
	private async renderPresetModels(): Promise<void> {
		const container = this.container.querySelector('#preset-models')
		if (!container) return

		const presets = this.config.modelManager.getPresetModels()
		const cachedIds = new Set(
			(await this.config.modelManager.getCachedModels()).map((m) => m.id)
		)

		container.innerHTML = presets
			.map((preset) => {
				const isCached = cachedIds.has(preset.id)
				const isDownloading = this.currentDownload === preset.id

				return `
					<div class="model-card ${isDownloading ? 'downloading' : ''}" 
						data-model-id="${preset.id}"
						${isCached ? 'data-cached="true"' : ''}>
						<div class="model-name">${preset.name}</div>
						<div class="model-info">
							${preset.parameters} • ${preset.quantization} • ${preset.size}
						</div>
						<div class="model-description">${preset.description}</div>
						${isDownloading ? `<div class="progress-bar"><div class="progress-fill" id="progress-${preset.id}" style="width: 0%"></div></div>` : ''}
						${isCached ? '<div style="color: #28a745; font-size: 12px; margin-top: 4px;">✓ Cached</div>' : ''}
					</div>
				`
			})
			.join('')

		// Add click handlers
		container.querySelectorAll('.model-card').forEach((card) => {
			card.addEventListener('click', () => {
				const modelId = card.getAttribute('data-model-id')
				const isCached = card.getAttribute('data-cached') === 'true'
				if (modelId) {
					this.handleModelSelect(modelId, isCached)
				}
			})
		})
	}

	/**
	 * Render cached models section
	 */
	private async renderCachedModels(): Promise<void> {
		const container = this.container.querySelector('#cached-models')
		if (!container) return

		const cached = await this.config.modelManager.getCachedModels()

		if (cached.length === 0) {
			container.innerHTML = '<div style="color: #888; font-size: 12px;">No cached models</div>'
			return
		}

		const loadedModel = this.config.modelManager.getLoadedModel()

		container.innerHTML = cached
			.map((model) => {
				const isLoaded = loadedModel?.id === model.id
				const sizeMB = (model.size / 1024 / 1024).toFixed(1)

				return `
					<div class="model-card ${isLoaded ? 'selected' : ''}" data-model-id="${model.id}">
						<div class="model-name">${model.name}</div>
						<div class="model-info">
							${sizeMB} MB • Used ${model.useCount} times
						</div>
						${isLoaded ? '<div style="color: #007acc; font-size: 12px; margin-top: 4px;">● Currently loaded</div>' : ''}
						<button class="btn btn-secondary" style="margin-top: 8px; font-size: 12px; padding: 4px 8px;" 
							onclick="event.stopPropagation(); this.dispatchEvent(new CustomEvent('delete-model', {bubbles: true, detail: '${model.id}'}))">
							Delete
						</button>
					</div>
				`
			})
			.join('')

		// Add click handlers
		container.querySelectorAll('.model-card').forEach((card) => {
			card.addEventListener('click', () => {
				const modelId = card.getAttribute('data-model-id')
				if (modelId) {
					this.selectCachedModel(modelId)
				}
			})
		})

		// Add delete handlers
		container.addEventListener('delete-model', (e) => {
			const modelId = (e as CustomEvent).detail
			this.deleteModel(modelId)
		})
	}

	/**
	 * Render storage information
	 */
	private async renderStorageInfo(): Promise<void> {
		const container = this.container.querySelector('#storage-info')
		if (!container) return

		const quota = await this.config.modelManager.getStorageQuota()
		const used = await this.config.modelManager.getTotalStorageUsed()

		const usedMB = (used / 1024 / 1024).toFixed(1)
		const totalMB = quota.total ? (quota.total / 1024 / 1024).toFixed(1) : '?'
		const percent = quota.total ? ((used / quota.total) * 100).toFixed(1) : '0'

		container.innerHTML = `
			<div>Storage used: ${usedMB} MB / ${totalMB} MB (${percent}%)</div>
		`
	}

	/**
	 * Handle model selection (download or load)
	 */
	private async handleModelSelect(modelId: string, isCached: boolean): Promise<void> {
		if (isCached) {
			await this.selectCachedModel(modelId)
		} else {
			await this.downloadModel(modelId)
		}
	}

	/**
	 * Download a preset model
	 */
	private async downloadModel(modelId: string): Promise<void> {
		try {
			this.currentDownload = modelId
			this.render()

			const metadata = await this.config.modelManager.downloadPresetModel(modelId)
			this.config.onModelSelect?.(metadata)
		} catch (error) {
			this.currentDownload = null
			this.config.onError?.(error instanceof Error ? error : new Error(String(error)))
			this.render()
		}
	}

	/**
	 * Select a cached model
	 */
	private async selectCachedModel(modelId: string): Promise<void> {
		try {
			const metadata = await this.config.modelManager.loadModel(modelId)
			this.config.onModelSelect?.(metadata)
			this.render()
		} catch (error) {
			this.config.onError?.(error instanceof Error ? error : new Error(String(error)))
		}
	}

	/**
	 * Handle file upload
	 */
	private async handleFileSelect(event: Event): Promise<void> {
		const input = event.target as HTMLInputElement
		const file = input.files?.[0]
		if (!file) return

		try {
			const metadata = await this.config.modelManager.loadModelFromFile(file)
			this.config.onModelSelect?.(metadata)
			this.render()
		} catch (error) {
			this.config.onError?.(error instanceof Error ? error : new Error(String(error)))
		}

		// Reset input
		input.value = ''
	}

	/**
	 * Update download progress UI
	 */
	private updateDownloadProgress(progress: DownloadProgress & { modelId: string }): void {
		const progressBar = this.container.querySelector(`#progress-${progress.modelId}`)
		if (progressBar) {
			progressBar.setAttribute('style', `width: ${progress.percentage}%`)
		}
	}

	/**
	 * Delete a cached model
	 */
	private async deleteModel(modelId: string): Promise<void> {
		if (!confirm(`Delete model "${modelId}"?`)) return

		try {
			await this.config.modelManager.deleteModel(modelId)
			this.render()
		} catch (error) {
			this.config.onError?.(error instanceof Error ? error : new Error(String(error)))
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
		this.render()
	}

	/**
	 * Unmount from parent
	 */
	unmount(): void {
		this.container.remove()
	}
}
