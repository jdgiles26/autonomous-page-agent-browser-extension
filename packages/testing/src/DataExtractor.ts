/**
 * Data Extractor - Structured data extraction with schema validation
 * Feature 6: Structured Data Extraction
 */

import * as z from 'zod'

import type { FlatDomTree, InteractiveElementDomNode } from '@page-agent/page-controller'

import type { ExtractionField, ExtractionResult, ExtractionSchema } from './types'
import { normalizeText } from './utils'

export interface DataExtractorConfig {
	maxRetries: number
	confidenceThreshold: number
	autoPaginate: boolean
}

export const defaultDataExtractorConfig: DataExtractorConfig = {
	maxRetries: 3,
	confidenceThreshold: 0.7,
	autoPaginate: true,
}

/**
 * Data Extractor - Extract structured data from web pages
 */
export class DataExtractor {
	private config: DataExtractorConfig

	constructor(config: Partial<DataExtractorConfig> = {}) {
		this.config = { ...defaultDataExtractorConfig, ...config }
	}

	/**
	 * Extract data according to schema
	 */
	async extract<T = unknown>(
		schema: ExtractionSchema,
		flatTree: FlatDomTree
	): Promise<ExtractionResult<T>> {
		const startTime = Date.now()

		let data: T
		let confidence = 0
		const sourceElements: ExtractionResult['sourceElements'] = []

		switch (schema.type) {
			case 'object':
				const objectResult = this.extractObject(schema, flatTree)
				data = objectResult.data as T
				confidence = objectResult.confidence
				sourceElements.push(...objectResult.sourceElements)
				break

			case 'array':
				const arrayResult = this.extractArray(schema, flatTree)
				data = arrayResult.data as T
				confidence = arrayResult.confidence
				sourceElements.push(...arrayResult.sourceElements)
				break

			case 'table':
				const tableResult = this.extractTable(schema, flatTree)
				data = tableResult.data as T
				confidence = tableResult.confidence
				sourceElements.push(...tableResult.sourceElements)
				break

			default:
				throw new Error(`Unknown extraction type: ${schema.type}`)
		}

		return {
			data,
			confidence,
			sourceElements,
			extractionTime: Date.now() - startTime,
		}
	}

	/**
	 * Extract data with pagination
	 */
	async extractAllPages<T = unknown>(
		schema: ExtractionSchema,
		flatTree: FlatDomTree,
		onPage?: (page: number, data: T[]) => void
	): Promise<ExtractionResult<T[]>> {
		const allData: T[] = []
		const allSourceElements: ExtractionResult['sourceElements'] = []
		let currentPage = 1
		let hasMore = true
		let totalConfidence = 0

		while (hasMore && currentPage <= (schema.pagination?.maxPages || 10)) {
			const result = await this.extract<T>(schema, flatTree)

			// Handle different data types
			if (Array.isArray(result.data)) {
				allData.push(...result.data)
			} else {
				allData.push(result.data)
			}

			allSourceElements.push(...result.sourceElements)
			totalConfidence += result.confidence

			if (onPage) {
				onPage(currentPage, Array.isArray(result.data) ? result.data : [result.data])
			}

			// Check for next page
			if (schema.pagination) {
				// This would need actual page navigation logic
				// For now, assume no pagination
				hasMore = false
			} else {
				hasMore = false
			}

			currentPage++
		}

		return {
			data: allData,
			confidence: totalConfidence / currentPage,
			sourceElements: allSourceElements,
			paginationInfo: {
				currentPage: currentPage - 1,
				totalPages: currentPage - 1,
				hasMore: false,
			},
			extractionTime: 0,
		}
	}

	/**
	 * Extract single object
	 */
	private extractObject(
		schema: ExtractionSchema,
		flatTree: FlatDomTree
	): { data: Record<string, unknown>; confidence: number; sourceElements: ExtractionResult['sourceElements'] } {
		const data: Record<string, unknown> = {}
		const sourceElements: ExtractionResult['sourceElements'] = []
		let totalConfidence = 0
		let fieldCount = 0

		for (const field of schema.fields) {
			const result = this.extractField(field, flatTree)

			if (result.value !== undefined) {
				data[field.name] = result.value
				totalConfidence += result.confidence
				fieldCount++

				if (result.sourceIndex !== undefined) {
					sourceElements.push({
						index: result.sourceIndex,
						field: field.name,
						value: String(result.value),
					})
				}
			}
		}

		return {
			data,
			confidence: fieldCount > 0 ? totalConfidence / fieldCount : 0,
			sourceElements,
		}
	}

	/**
	 * Extract array of objects
	 */
	private extractArray(
		schema: ExtractionSchema,
		flatTree: FlatDomTree
	): { data: Record<string, unknown>[]; confidence: number; sourceElements: ExtractionResult['sourceElements'] } {
		// Find repeating patterns in the DOM
		const containers = this.findListContainers(flatTree)

		if (containers.length === 0) {
			return { data: [], confidence: 0, sourceElements: [] }
		}

		const data: Record<string, unknown>[] = []
		const sourceElements: ExtractionResult['sourceElements'] = []
		let totalConfidence = 0

		// Use the most likely container
		const container = containers[0]

		// Find child elements that match the schema
		const items = this.findArrayItems(container, schema, flatTree)

		for (let i = 0; i < items.length; i++) {
			const item = items[i]
			const itemData: Record<string, unknown> = {}
			let itemConfidence = 0

			for (const field of schema.fields) {
				const value = this.extractValueFromElement(item, field)
				if (value !== undefined) {
					itemData[field.name] = value
					itemConfidence += 0.8 // Base confidence for found value

					if (item.highlightIndex !== undefined) {
						sourceElements.push({
							index: item.highlightIndex,
							field: `${i}.${field.name}`,
							value: String(value),
						})
					}
				}
			}

			if (Object.keys(itemData).length > 0) {
				data.push(itemData)
				totalConfidence += itemConfidence / schema.fields.length
			}
		}

		return {
			data,
			confidence: data.length > 0 ? totalConfidence / data.length : 0,
			sourceElements,
		}
	}

	/**
	 * Extract table data
	 */
	private extractTable(
		schema: ExtractionSchema,
		flatTree: FlatDomTree
	): { data: Record<string, unknown>[]; confidence: number; sourceElements: ExtractionResult['sourceElements'] } {
		// Find table elements
		const tables: InteractiveElementDomNode[] = []

		for (const node of Object.values(flatTree.map)) {
			if (node.ref?.tagName.toLowerCase() === 'table') {
				tables.push(node as InteractiveElementDomNode)
			}
		}

		if (tables.length === 0) {
			return { data: [], confidence: 0, sourceElements: [] }
		}

		const data: Record<string, unknown>[] = []
		const sourceElements: ExtractionResult['sourceElements'] = []

		// Extract from first table
		const table = tables[0]
		const rows = table.ref?.querySelectorAll('tr') || []

		// Assume first row is header
		let headers: string[] = []
		const headerRow = rows[0]
		if (headerRow) {
			headers = Array.from(headerRow.querySelectorAll('th, td')).map((cell) =>
				normalizeText(cell.textContent || '')
			)
		}

		// Map schema fields to columns
		const fieldToColumn = new Map<string, number>()
		for (const field of schema.fields) {
			const columnIndex = headers.findIndex((h) =>
				h.toLowerCase().includes(field.name.toLowerCase())
			)
			if (columnIndex >= 0) {
				fieldToColumn.set(field.name, columnIndex)
			}
		}

		// Extract data rows
		for (let i = 1; i < rows.length; i++) {
			const row = rows[i]
			const cells = row.querySelectorAll('td')
			const rowData: Record<string, unknown> = {}

			for (const field of schema.fields) {
				const columnIndex = fieldToColumn.get(field.name)
				if (columnIndex !== undefined && cells[columnIndex]) {
					const value = this.parseValue(
						normalizeText(cells[columnIndex].textContent || ''),
						field.type
					)
					rowData[field.name] = value
				}
			}

			if (Object.keys(rowData).length > 0) {
				data.push(rowData)
			}
		}

		return {
			data,
			confidence: data.length > 0 ? 0.8 : 0,
			sourceElements,
		}
	}

	/**
	 * Extract a single field
	 */
	private extractField(
		field: ExtractionField,
		flatTree: FlatDomTree
	): { value: unknown; confidence: number; sourceIndex?: number } {
		// If selector is provided, use it
		if (field.selector) {
			const index = parseInt(field.selector, 10)
			if (!isNaN(index)) {
				const node = this.findNodeByIndex(index, flatTree)
				if (node?.ref) {
					const value = this.parseValue(
						normalizeText(node.ref.textContent || ''),
						field.type
					)
					return { value, confidence: 0.9, sourceIndex: index }
				}
			}
		}

		// Otherwise, search by description
		const searchTerms = field.description.toLowerCase().split(' ')

		for (const node of Object.values(flatTree.map)) {
			if (!node.ref) continue

			const text = normalizeText(node.ref.textContent || '')
			const ariaLabel = node.ref.getAttribute('aria-label')?.toLowerCase() || ''
			const placeholder = (node.ref as HTMLInputElement).placeholder?.toLowerCase() || ''

			// Check for matches
			const matchScore = this.calculateMatchScore(searchTerms, [text, ariaLabel, placeholder])

			if (matchScore > 0.5) {
				const value = this.parseValue(text, field.type)
				return {
					value,
					confidence: matchScore,
					sourceIndex: node.highlightIndex,
				}
			}
		}

		return { value: undefined, confidence: 0 }
	}

	/**
	 * Parse value according to type
	 */
	private parseValue(value: string, type: ExtractionField['type']): unknown {
		switch (type) {
			case 'number':
				const num = parseFloat(value.replace(/[^0-9.-]/g, ''))
				return isNaN(num) ? undefined : num

			case 'boolean':
				return ['true', 'yes', '1', 'on'].includes(value.toLowerCase())

			case 'url':
				try {
					return new URL(value).href
				} catch {
					return value
				}

			case 'email':
				return value.includes('@') ? value : undefined

			case 'date':
				const date = new Date(value)
				return isNaN(date.getTime()) ? value : date.toISOString()

			case 'string':
			default:
				return value
		}
	}

	/**
	 * Find list containers in DOM
	 */
	private findListContainers(flatTree: FlatDomTree): InteractiveElementDomNode[] {
		const containers: InteractiveElementDomNode[] = []

		for (const node of Object.values(flatTree.map)) {
			if (!node.ref) continue

			const tagName = node.ref.tagName.toLowerCase()
			const role = node.ref.getAttribute('role')

			// Common list containers
			if (
				tagName === 'ul' ||
				tagName === 'ol' ||
				tagName === 'tbody' ||
				role === 'list' ||
				role === 'listbox' ||
				node.ref.className.toLowerCase().includes('list') ||
				node.ref.className.toLowerCase().includes('items')
			) {
				containers.push(node as InteractiveElementDomNode)
			}
		}

		return containers
	}

	/**
	 * Find array items within a container
	 */
	private findArrayItems(
		container: InteractiveElementDomNode,
		schema: ExtractionSchema,
		flatTree: FlatDomTree
	): InteractiveElementDomNode[] {
		const items: InteractiveElementDomNode[] = []

		if (!container.ref) return items

		// Find direct children that could be items
		const children = container.ref.children
		for (let i = 0; i < children.length; i++) {
			const child = children[i]
			const tagName = child.tagName.toLowerCase()

			// Common item tags
			if (tagName === 'li' || tagName === 'tr' || tagName === 'div' || tagName === 'article') {
				// Find corresponding node in flat tree
				for (const node of Object.values(flatTree.map)) {
					if (node.ref === child) {
						items.push(node as InteractiveElementDomNode)
						break
					}
				}
			}
		}

		return items
	}

	/**
	 * Extract value from element based on field type
	 */
	private extractValueFromElement(
		element: InteractiveElementDomNode,
		field: ExtractionField
	): unknown {
		if (!element.ref) return undefined

		// Try to find child element matching field
		const searchTerms = field.description.toLowerCase().split(' ')

		// Check the element itself
		const text = normalizeText(element.ref.textContent || '')
		if (this.calculateMatchScore(searchTerms, [text]) > 0.3) {
			return this.parseValue(text, field.type)
		}

		// Check children
		const children = element.ref.querySelectorAll('*')
		for (const child of children) {
			const childText = normalizeText(child.textContent || '')
			const ariaLabel = child.getAttribute('aria-label')?.toLowerCase() || ''

			if (this.calculateMatchScore(searchTerms, [childText, ariaLabel]) > 0.5) {
				return this.parseValue(childText, field.type)
			}
		}

		return undefined
	}

	/**
	 * Calculate match score between search terms and texts
	 */
	private calculateMatchScore(terms: string[], texts: string[]): number {
		let matches = 0
		for (const term of terms) {
			for (const text of texts) {
				if (text.includes(term)) {
					matches++
					break
				}
			}
		}
		return matches / terms.length
	}

	/**
	 * Find node by index
	 */
	private findNodeByIndex(index: number, flatTree: FlatDomTree): InteractiveElementDomNode | null {
		for (const node of Object.values(flatTree.map)) {
			if (node.isInteractive && node.highlightIndex === index) {
				return node as InteractiveElementDomNode
			}
		}
		return null
	}

	/**
	 * Auto-detect schema from sample data
	 */
	autoDetectSchema(sample: unknown[]): ExtractionSchema {
		if (sample.length === 0) {
			return { type: 'array', fields: [] }
		}

		const firstItem = sample[0]
		if (typeof firstItem !== 'object' || firstItem === null) {
			return { type: 'array', fields: [] }
		}

		const fields: ExtractionField[] = []

		for (const [key, value] of Object.entries(firstItem)) {
			const type = this.inferType(value)
			fields.push({
				name: key,
				description: key,
				type,
				required: sample.every((item) => (item as Record<string, unknown>)?.[key] !== undefined),
			})
		}

		return { type: 'array', fields }
	}

	/**
	 * Infer type from value
	 */
	private inferType(value: unknown): ExtractionField['type'] {
		if (typeof value === 'number') return 'number'
		if (typeof value === 'boolean') return 'boolean'
		if (typeof value === 'string') {
			if (value.includes('@')) return 'email'
			if (value.startsWith('http')) return 'url'
			if (!isNaN(Date.parse(value))) return 'date'
			return 'string'
		}
		return 'string'
	}

	/**
	 * Export to JSON
	 */
	toJSON<T>(result: ExtractionResult<T>): string {
		return JSON.stringify(result.data, null, 2)
	}

	/**
	 * Export to CSV
	 */
	toCSV<T>(result: ExtractionResult<T>): string {
		const data = Array.isArray(result.data) ? result.data : [result.data]

		if (data.length === 0) return ''

		// Get headers from first item
		const firstItem = data[0] as Record<string, unknown>
		const headers = Object.keys(firstItem)

		// Create CSV
		const lines: string[] = [headers.join(',')]

		for (const item of data) {
			const values = headers.map((h) => {
				const value = (item as Record<string, unknown>)[h]
				const str = String(value ?? '')
				// Escape quotes and wrap in quotes if needed
				if (str.includes(',') || str.includes('"') || str.includes('\n')) {
					return `"${str.replace(/"/g, '""')}"`
				}
				return str
			})
			lines.push(values.join(','))
		}

		return lines.join('\n')
	}

	/**
	 * Export to Markdown table
	 */
	toMarkdown<T>(result: ExtractionResult<T>): string {
		const data = Array.isArray(result.data) ? result.data : [result.data]

		if (data.length === 0) return ''

		// Get headers from first item
		const firstItem = data[0] as Record<string, unknown>
		const headers = Object.keys(firstItem)

		// Create markdown table
		const lines: string[] = []

		// Header row
		lines.push('| ' + headers.join(' | ') + ' |')

		// Separator
		lines.push('| ' + headers.map(() => '---').join(' | ') + ' |')

		// Data rows
		for (const item of data) {
			const values = headers.map((h) => String((item as Record<string, unknown>)[h] ?? ''))
			lines.push('| ' + values.join(' | ') + ' |')
		}

		return lines.join('\n')
	}
}
