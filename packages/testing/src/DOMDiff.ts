/**
 * DOM Diff - Detect and highlight DOM changes
 * Feature 7: Visual Diff & Change Detection (DOM portion)
 */

import type { FlatDomTree, InteractiveElementDomNode } from '@page-agent/page-controller'

import type { DOMDiffResult, ElementFingerprint } from './types'
import { generateElementFingerprint, normalizeText } from './utils'

export interface DOMDiffConfig {
	ignoreAttributes: string[]
	ignoreTextWhitespace: boolean
	trackMoves: boolean
}

export const defaultDOMDiffConfig: DOMDiffConfig = {
	ignoreAttributes: ['style', 'class', 'data-reactid', 'data-react-checksum'],
	ignoreTextWhitespace: true,
	trackMoves: true,
}

/**
 * DOM Diff - Compare two DOM states
 */
export class DOMDiff {
	private config: DOMDiffConfig

	constructor(config: Partial<DOMDiffConfig> = {}) {
		this.config = { ...defaultDOMDiffConfig, ...config }
	}

	/**
	 * Compare two DOM states and return differences
	 */
	compare(before: FlatDomTree, after: FlatDomTree): DOMDiffResult {
		const result: DOMDiffResult = {
			added: [],
			removed: [],
			modified: [],
			unchanged: [],
			moved: [],
		}

		// Build maps of interactive elements
		const beforeElements = this.buildElementMap(before)
		const afterElements = this.buildElementMap(after)

		// Find added elements (in after but not in before)
		for (const [index, afterNode] of afterElements.entries()) {
			if (!beforeElements.has(index)) {
				// Check if this element was moved from another index
				const movedFrom = this.findMovedElement(afterNode, beforeElements)
				if (movedFrom !== null && this.config.trackMoves) {
					result.moved.push({
						oldIndex: movedFrom,
						newIndex: index,
						fingerprint: generateElementFingerprint(afterNode.ref!, index),
					})
				} else {
					result.added.push({
						index,
						element: afterNode,
						fingerprint: generateElementFingerprint(afterNode.ref!, index),
					})
				}
			} else {
				// Element exists in both - check for modifications
				const beforeNode = beforeElements.get(index)!
				const changes = this.compareElements(beforeNode, afterNode)

				if (changes.length > 0) {
					result.modified.push({
						index,
						changes,
						fingerprint: generateElementFingerprint(afterNode.ref!, index),
					})
				} else {
					result.unchanged.push(index)
				}
			}
		}

		// Find removed elements (in before but not in after)
		for (const [index, beforeNode] of beforeElements.entries()) {
			if (!afterElements.has(index)) {
				// Check if element was moved (already tracked above)
				const wasMoved = result.moved.some((m) => m.oldIndex === index)
				if (!wasMoved) {
					result.removed.push({
						index,
						fingerprint: generateElementFingerprint(beforeNode.ref!, index),
					})
				}
			}
		}

		return result
	}

	/**
	 * Generate human-readable diff report
	 */
	generateReport(diff: DOMDiffResult): string {
		const lines: string[] = ['# DOM Changes Report', '']

		if (diff.added.length > 0) {
			lines.push(`## Added Elements (${diff.added.length})`)
			for (const item of diff.added) {
				lines.push(`- [${item.index}] ${item.fingerprint.tagName}: "${item.fingerprint.textContent}"`)
			}
			lines.push('')
		}

		if (diff.removed.length > 0) {
			lines.push(`## Removed Elements (${diff.removed.length})`)
			for (const item of diff.removed) {
				lines.push(`- [${item.index}] ${item.fingerprint.tagName}: "${item.fingerprint.textContent}"`)
			}
			lines.push('')
		}

		if (diff.modified.length > 0) {
			lines.push(`## Modified Elements (${diff.modified.length})`)
			for (const item of diff.modified) {
				lines.push(`- [${item.index}] ${item.fingerprint.tagName}`)
				for (const change of item.changes) {
					lines.push(`  - ${change.field}: "${change.old}" → "${change.new}"`)
				}
			}
			lines.push('')
		}

		if (diff.moved.length > 0) {
			lines.push(`## Moved Elements (${diff.moved.length})`)
			for (const item of diff.moved) {
				lines.push(`- [${item.oldIndex}] → [${item.newIndex}] ${item.fingerprint.tagName}`)
			}
			lines.push('')
		}

		lines.push(`## Summary`)
		lines.push(`- Unchanged: ${diff.unchanged.length}`)
		lines.push(`- Total changes: ${diff.added.length + diff.removed.length + diff.modified.length + diff.moved.length}`)

		return lines.join('\n')
	}

	/**
	 * Check if specific change occurred
	 */
	hasChange(
		diff: DOMDiffResult,
		predicate: (change: { type: string; index: number; data: unknown }) => boolean
	): boolean {
		// Check added
		for (const item of diff.added) {
			if (predicate({ type: 'added', index: item.index, data: item })) return true
		}

		// Check removed
		for (const item of diff.removed) {
			if (predicate({ type: 'removed', index: item.index, data: item })) return true
		}

		// Check modified
		for (const item of diff.modified) {
			if (predicate({ type: 'modified', index: item.index, data: item })) return true
		}

		// Check moved
		for (const item of diff.moved) {
			if (predicate({ type: 'moved', index: item.newIndex, data: item })) return true
		}

		return false
	}

	/**
	 * Check if an element with specific text was added
	 */
	hasTextAdded(diff: DOMDiffResult, text: string): boolean {
		const normalized = normalizeText(text)
		return diff.added.some((item) =>
			normalizeText(item.fingerprint.textContent).includes(normalized)
		)
	}

	/**
	 * Check if an element with specific text was removed
	 */
	hasTextRemoved(diff: DOMDiffResult, text: string): boolean {
		const normalized = normalizeText(text)
		return diff.removed.some((item) =>
			normalizeText(item.fingerprint.textContent).includes(normalized)
		)
	}

	/**
	 * Get all changes as a flat list
	 */
	getAllChanges(
		diff: DOMDiffResult
	): Array<{
		type: 'added' | 'removed' | 'modified' | 'moved'
		index: number
		data: unknown
	}> {
		const changes: Array<{ type: 'added' | 'removed' | 'modified' | 'moved'; index: number; data: unknown }> =
			[]

		for (const item of diff.added) {
			changes.push({ type: 'added', index: item.index, data: item })
		}
		for (const item of diff.removed) {
			changes.push({ type: 'removed', index: item.index, data: item })
		}
		for (const item of diff.modified) {
			changes.push({ type: 'modified', index: item.index, data: item })
		}
		for (const item of diff.moved) {
			changes.push({ type: 'moved', index: item.newIndex, data: item })
		}

		return changes.sort((a, b) => a.index - b.index)
	}

	/**
	 * Build map of interactive elements from flat tree
	 */
	private buildElementMap(flatTree: FlatDomTree): Map<number, InteractiveElementDomNode> {
		const map = new Map<number, InteractiveElementDomNode>()

		for (const node of Object.values(flatTree.map)) {
			if (node.isInteractive && typeof node.highlightIndex === 'number') {
				map.set(node.highlightIndex, node as InteractiveElementDomNode)
			}
		}

		return map
	}

	/**
	 * Find if an element was moved from another index
	 */
	private findMovedElement(
		afterNode: InteractiveElementDomNode,
		beforeElements: Map<number, InteractiveElementDomNode>
	): number | null {
		const afterFingerprint = generateElementFingerprint(afterNode.ref!, afterNode.highlightIndex)

		for (const [index, beforeNode] of beforeElements.entries()) {
			if (!beforeNode.ref) continue

			const beforeFingerprint = generateElementFingerprint(beforeNode.ref, index)

			// High similarity indicates same element
			if (this.fingerprintsSimilar(beforeFingerprint, afterFingerprint)) {
				return index
			}
		}

		return null
	}

	/**
	 * Check if two fingerprints are similar enough to be the same element
	 */
	private fingerprintsSimilar(a: ElementFingerprint, b: ElementFingerprint): boolean {
		// Must have same tag
		if (a.tagName !== b.tagName) return false

		// Check text content
		if (a.textHash && b.textHash && a.textHash === b.textHash) return true

		// Check test IDs
		if (a.testId && b.testId && a.testId === b.testId) return true
		if (a.dataCy && b.dataCy && a.dataCy === b.dataCy) return true

		// Check aria-label
		if (a.ariaLabel && b.ariaLabel && a.ariaLabel === b.ariaLabel) return true

		// Multiple attribute matches
		let attrMatches = 0
		for (const [key, value] of Object.entries(a.attributes)) {
			if (b.attributes[key] === value) attrMatches++
		}

		return attrMatches >= 2
	}

	/**
	 * Compare two elements and return list of changes
	 */
	private compareElements(
		before: InteractiveElementDomNode,
		after: InteractiveElementDomNode
	): Array<{ field: string; old: unknown; new: unknown }> {
		const changes: Array<{ field: string; old: unknown; new: unknown }> = []

		if (!before.ref || !after.ref) return changes

		// Compare text content
		const beforeText = normalizeText(before.ref.textContent || '')
		const afterText = normalizeText(after.ref.textContent || '')
		if (beforeText !== afterText) {
			changes.push({ field: 'textContent', old: beforeText, new: afterText })
		}

		// Compare attributes
		const beforeAttrs = this.getFilteredAttributes(before.ref)
		const afterAttrs = this.getFilteredAttributes(after.ref)

		for (const key of new Set([...Object.keys(beforeAttrs), ...Object.keys(afterAttrs)])) {
			if (beforeAttrs[key] !== afterAttrs[key]) {
				changes.push({
					field: `attribute:${key}`,
					old: beforeAttrs[key],
					new: afterAttrs[key],
				})
			}
		}

		// Compare visibility
		const beforeVisible = this.isVisible(before.ref)
		const afterVisible = this.isVisible(after.ref)
		if (beforeVisible !== afterVisible) {
			changes.push({ field: 'visibility', old: beforeVisible, new: afterVisible })
		}

		// Compare enabled state
		const beforeEnabled = !(before.ref as any).disabled
		const afterEnabled = !(after.ref as any).disabled
		if (beforeEnabled !== afterEnabled) {
			changes.push({ field: 'enabled', old: beforeEnabled, new: afterEnabled })
		}

		return changes
	}

	/**
	 * Get filtered attributes (excluding ignored ones)
	 */
	private getFilteredAttributes(element: HTMLElement): Record<string, string> {
		const attrs: Record<string, string> = {}

		for (const attr of element.attributes) {
			if (!this.config.ignoreAttributes.includes(attr.name)) {
				attrs[attr.name] = attr.value
			}
		}

		return attrs
	}

	/**
	 * Check if element is visible
	 */
	private isVisible(element: HTMLElement): boolean {
		const style = window.getComputedStyle(element)
		return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0'
	}
}
