/**
 * IndexedDB storage for GGUF model files
 * Handles chunked storage for large files (>100MB)
 */

import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { ModelMetadata, StorageQuota, DownloadProgress } from '../types.js'

interface ModelDBSchema extends DBSchema {
	models: {
		key: string
		value: ModelMetadata
	}
	chunks: {
		key: [string, number] // [modelId, chunkIndex]
		value: ArrayBuffer
	}
}

const DB_NAME = 'PageAgentLocalLLM'
const DB_VERSION = 1
const CHUNK_SIZE = 10 * 1024 * 1024 // 10MB chunks

export class ModelStorage extends EventTarget {
	private db: IDBPDatabase<ModelDBSchema> | null = null
	private initPromise: Promise<void> | null = null

	/**
	 * Initialize the IndexedDB database
	 */
	async initialize(): Promise<void> {
		if (this.initPromise) return this.initPromise

		this.initPromise = this.doInitialize()
		return this.initPromise
	}

	private async doInitialize(): Promise<void> {
		this.db = await openDB<ModelDBSchema>(DB_NAME, DB_VERSION, {
			upgrade(db) {
				if (!db.objectStoreNames.contains('models')) {
					db.createObjectStore('models', { keyPath: 'id' })
				}
				if (!db.objectStoreNames.contains('chunks')) {
					db.createObjectStore('chunks', { keyPath: 'id' })
				}
			},
		})
	}

	/**
	 * Ensure database is initialized
	 */
	private async ensureDb(): Promise<IDBPDatabase<ModelDBSchema>> {
		if (!this.db) {
			await this.initialize()
		}
		if (!this.db) {
			throw new Error('Failed to initialize ModelStorage database')
		}
		return this.db
	}

	/**
	 * Store a complete model (for smaller models < 100MB)
	 */
	async storeModel(metadata: ModelMetadata, blob: Blob): Promise<void> {
		const db = await this.ensureDb()

		// Store metadata
		await db.put('models', {
			...metadata,
			downloadedAt: Date.now(),
			lastUsedAt: Date.now(),
		})

		// Store as single chunk
		const arrayBuffer = await blob.arrayBuffer()
		await db.put('chunks', arrayBuffer, [metadata.id, 0])
	}

	/**
	 * Store a model in chunks (for larger models)
	 */
	async storeModelChunked(
		metadata: ModelMetadata,
		stream: ReadableStream<Uint8Array>,
		onProgress?: (progress: DownloadProgress) => void
	): Promise<void> {
		const db = await this.ensureDb()

		// Store metadata first
		await db.put('models', {
			...metadata,
			downloadedAt: Date.now(),
			lastUsedAt: Date.now(),
		})

		// Read stream and store in chunks
		const reader = stream.getReader()
		let chunkIndex = 0
		let totalBytes = 0
		let currentChunk = new Uint8Array(CHUNK_SIZE)
		let currentOffset = 0

		try {
			while (true) {
				const { done, value } = await reader.read()

				if (done) break

				let offset = 0
				while (offset < value.length) {
					const remaining = CHUNK_SIZE - currentOffset
					const toCopy = Math.min(remaining, value.length - offset)

					currentChunk.set(value.subarray(offset, offset + toCopy), currentOffset)
					currentOffset += toCopy
					offset += toCopy

					if (currentOffset === CHUNK_SIZE) {
						// Store full chunk
						await db.put('chunks', currentChunk.buffer.slice(0), [metadata.id, chunkIndex])
						chunkIndex++
						totalBytes += CHUNK_SIZE
						currentOffset = 0
						currentChunk = new Uint8Array(CHUNK_SIZE)

						if (onProgress) {
							onProgress({
								loaded: totalBytes,
								total: metadata.size,
								percentage: Math.min((totalBytes / metadata.size) * 100, 99),
							})
						}
					}
				}
			}

			// Store final partial chunk if any
			if (currentOffset > 0) {
				await db.put(
					'chunks',
					currentChunk.buffer.slice(0, currentOffset),
					[metadata.id, chunkIndex]
				)
				totalBytes += currentOffset
			}

			if (onProgress) {
				onProgress({
					loaded: totalBytes,
					total: metadata.size,
					percentage: 100,
				})
			}
		} catch (error) {
			// Clean up on failure
			await this.deleteModel(metadata.id)
			throw error
		} finally {
			reader.releaseLock()
		}
	}

	/**
	 * Retrieve a model as a Blob
	 */
	async getModel(modelId: string): Promise<{ metadata: ModelMetadata; blob: Blob } | null> {
		const db = await this.ensureDb()

		const metadata = await db.get('models', modelId)
		if (!metadata) return null

		// Update last used
		metadata.lastUsedAt = Date.now()
		metadata.useCount++
		await db.put('models', metadata)

		// Collect all chunks
		const chunks: ArrayBuffer[] = []
		let chunkIndex = 0

		while (true) {
			const chunk = await db.get('chunks', [modelId, chunkIndex])
			if (!chunk) break
			chunks.push(chunk)
			chunkIndex++
		}

		if (chunks.length === 0) return null

		// Combine chunks into blob
		const blob = new Blob(chunks, { type: 'application/octet-stream' })
		return { metadata, blob }
	}

	/**
	 * Get a ReadableStream for a model (for streaming to Web Worker)
	 */
	async getModelStream(modelId: string): Promise<ReadableStream<Uint8Array> | null> {
		const db = await this.ensureDb()

		const metadata = await db.get('models', modelId)
		if (!metadata) return null

		// Update last used
		metadata.lastUsedAt = Date.now()
		metadata.useCount++
		await db.put('models', metadata)

		// Create a stream that reads chunks on demand
		let chunkIndex = 0
		return new ReadableStream({
			pull: async (controller) => {
				const chunk = await db.get('chunks', [modelId, chunkIndex])
				if (!chunk) {
					controller.close()
					return
				}
				controller.enqueue(new Uint8Array(chunk))
				chunkIndex++
			},
		})
	}

	/**
	 * Delete a model from storage
	 */
	async deleteModel(modelId: string): Promise<void> {
		const db = await this.ensureDb()

		// Delete metadata
		await db.delete('models', modelId)

		// Delete all chunks
		let chunkIndex = 0
		while (true) {
			const chunk = await db.get('chunks', [modelId, chunkIndex])
			if (!chunk) break
			await db.delete('chunks', [modelId, chunkIndex])
			chunkIndex++
		}
	}

	/**
	 * List all stored models
	 */
	async listModels(): Promise<ModelMetadata[]> {
		const db = await this.ensureDb()
		return db.getAll('models')
	}

	/**
	 * Check if a model exists
	 */
	async hasModel(modelId: string): Promise<boolean> {
		const db = await this.ensureDb()
		const metadata = await db.get('models', modelId)
		return metadata !== undefined
	}

	/**
	 * Get storage quota information
	 */
	async getStorageQuota(): Promise<StorageQuota> {
		if ('storage' in navigator && 'estimate' in navigator.storage) {
			const estimate = await navigator.storage.estimate()
			return {
				used: estimate.usage || 0,
				total: estimate.quota || 0,
			}
		}
		return { used: 0, total: 0 }
	}

	/**
	 * Get total size of all stored models
	 */
	async getTotalStorageUsed(): Promise<number> {
		const models = await this.listModels()
		return models.reduce((total, model) => total + model.size, 0)
	}

	/**
	 * Clean up old models based on last used time
	 */
	async cleanupOldModels(maxAgeMs: number): Promise<number> {
		const models = await this.listModels()
		const now = Date.now()
		let deletedCount = 0

		for (const model of models) {
			if (now - model.lastUsedAt > maxAgeMs) {
				await this.deleteModel(model.id)
				deletedCount++
			}
		}

		return deletedCount
	}

	/**
	 * Clear all stored models
	 */
	async clearAll(): Promise<void> {
		const db = await this.ensureDb()
		await db.clear('models')
		await db.clear('chunks')
	}
}
