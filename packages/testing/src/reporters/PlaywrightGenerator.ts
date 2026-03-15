/**
 * Playwright Generator - Converts playbooks to Playwright test code
 */

import type { Playbook, PlaybookStep } from '../types'

export interface PlaywrightGeneratorConfig {
	useSelfHealing: boolean
	includeComments: boolean
	includeScreenshots: boolean
	includeAssertions: boolean
	typescript: boolean
}

export const defaultPlaywrightGeneratorConfig: PlaywrightGeneratorConfig = {
	useSelfHealing: true,
	includeComments: true,
	includeScreenshots: true,
	includeAssertions: true,
	typescript: true,
}

/**
 * Playwright Test Generator
 */
export class PlaywrightGenerator {
	private config: PlaywrightGeneratorConfig

	constructor(config: Partial<PlaywrightGeneratorConfig> = {}) {
		this.config = { ...defaultPlaywrightGeneratorConfig, ...config }
	}

	/**
	 * Convert playbook to Playwright test
	 */
	generateTest(playbook: Playbook, options?: Partial<PlaywrightGeneratorConfig>): string {
		const config = { ...this.config, ...options }
		const lines: string[] = []

		// Imports
		lines.push("import { test, expect } from '@playwright/test'")
		if (config.useSelfHealing) {
			lines.push("import { SelfHealingLocator } from './helpers/self-healing'")
		}
		lines.push('')

		// Test definition
		const testName = this.sanitizeTestName(playbook.name)
		lines.push(`test('${testName}', async ({ page }) => {`)
		lines.push(`  // Test: ${playbook.name}`)
		lines.push(`  // Generated from Page Agent playbook`)
		lines.push(`  // Original URL: ${playbook.url}`)
		lines.push('')

		// Navigate
		lines.push(`  await page.goto('${playbook.url}')`)
		lines.push('')

		// Generate steps
		for (let i = 0; i < playbook.steps.length; i++) {
			const step = playbook.steps[i]
			const stepCode = this.generateStepCode(step, i + 1, config)
			if (stepCode) {
				lines.push(stepCode)
			}
		}

		// Close test
		lines.push('})')
		lines.push('')

		return lines.join('\n')
	}

	/**
	 * Generate test suite from multiple playbooks
	 */
	generateTestSuite(
		playbooks: Playbook[],
		options?: Partial<PlaywrightGeneratorConfig>
	): string {
		const config = { ...this.config, ...options }
		const lines: string[] = []

		// Imports
		lines.push("import { test, expect } from '@playwright/test'")
		if (config.useSelfHealing) {
			lines.push("import { SelfHealingLocator } from './helpers/self-healing'")
		}
		lines.push('')

		// Test.describe block
		lines.push("test.describe('Page Agent Generated Tests', () => {")
		lines.push('')

		// Generate each test
		for (const playbook of playbooks) {
			const testCode = this.generateTest(playbook, options)
			// Indent the test code
			const indentedCode = testCode
				.split('\n')
				.map((line) => (line ? '  ' + line : line))
				.join('\n')
			lines.push(indentedCode)
		}

		lines.push('})')
		lines.push('')

		return lines.join('\n')
	}

	/**
	 * Generate code for a single step
	 */
	private generateStepCode(
		step: PlaybookStep,
		stepNum: number,
		config: PlaywrightGeneratorConfig
	): string | null {
		const lines: string[] = []

		if (config.includeComments) {
			lines.push(`  // Step ${stepNum}: ${step.type}`)
		}

		switch (step.type) {
			case 'click':
				lines.push(this.generateClickCode(step, config))
				break

			case 'input':
				lines.push(this.generateInputCode(step, config))
				break

			case 'scroll':
				lines.push(this.generateScrollCode(step))
				break

			case 'select':
				lines.push(this.generateSelectCode(step, config))
				break

			case 'wait':
				lines.push(this.generateWaitCode(step))
				break

			case 'assert':
				if (config.includeAssertions) {
					lines.push(this.generateAssertCode(step))
				}
				break

			case 'navigate':
				lines.push(`  await page.goto('${step.value}')`)
				break

			default:
				if (config.includeComments) {
					lines.push(`  // Unknown step type: ${step.type}`)
				}
		}

		// Add screenshot after action
		if (config.includeScreenshots && step.type !== 'wait' && step.type !== 'assert') {
			lines.push(`  await expect(page).toHaveScreenshot('step-${stepNum}-${step.type}.png')`)
		}

		lines.push('')

		return lines.join('\n')
	}

	/**
	 * Generate click code
	 */
	private generateClickCode(step: PlaybookStep, config: PlaywrightGeneratorConfig): string {
		const index = step.target?.index
		if (index === undefined) return '  // Missing target index'

		if (config.useSelfHealing && step.target?.fingerprint) {
			const fp = step.target.fingerprint
			return `  // Self-healing: originally index ${index}
  const element${index} = new SelfHealingLocator(page, {
    fingerprint: {
      tagName: '${fp.tagName}',
      textContent: '${fp.textContent?.replace(/'/g, "\\'")}',
      testId: '${fp.testId || ''}'
    },
    fallbackSelectors: ['[data-testid="${fp.testId}"]', '${fp.tagName}:has-text("${fp.textContent?.substring(0, 20)}")']
  })
  await element${index}.click()`
		}

		return `  await page.locator('[data-page-agent-index="${index}"]').click()`
	}

	/**
	 * Generate input code
	 */
	private generateInputCode(step: PlaybookStep, config: PlaywrightGeneratorConfig): string {
		const index = step.target?.index
		if (index === undefined) return '  // Missing target index'

		const value = step.value || ''

		if (config.useSelfHealing && step.target?.fingerprint) {
			const fp = step.target.fingerprint
			return `  // Self-healing: originally index ${index}
  const input${index} = new SelfHealingLocator(page, {
    fingerprint: {
      tagName: '${fp.tagName}',
      inputType: '${fp.inputType || 'text'}',
      placeholder: '${fp.attributes?.placeholder || ''}'
    },
    fallbackSelectors: ['input[type="${fp.inputType || 'text'}"]', 'input[placeholder*="${fp.attributes?.placeholder?.substring(0, 10)}"]']
  })
  await input${index}.fill('${value.replace(/'/g, "\\'")}')`
		}

		return `  await page.locator('[data-page-agent-index="${index}"]').fill('${value.replace(/'/g, "\\'")}')`
	}

	/**
	 * Generate scroll code
	 */
	private generateScrollCode(step: PlaybookStep): string {
		const [direction, amount] = (step.value || ':').split(':')
		const pixels = parseInt(amount) || 500

		switch (direction) {
			case 'down':
				return `  await page.mouse.wheel(0, ${pixels})`
			case 'up':
				return `  await page.mouse.wheel(0, -${pixels})`
			case 'right':
				return `  await page.mouse.wheel(${pixels}, 0)`
			case 'left':
				return `  await page.mouse.wheel(-${pixels}, 0)`
			default:
				return `  await page.mouse.wheel(0, ${pixels})`
		}
	}

	/**
	 * Generate select code
	 */
	private generateSelectCode(step: PlaybookStep, config: PlaywrightGeneratorConfig): string {
		const index = step.target?.index
		if (index === undefined) return '  // Missing target index'

		const option = step.value || ''

		if (config.useSelfHealing) {
			return `  // Self-healing: originally index ${index}
  const select${index} = new SelfHealingLocator(page, {
    fallbackSelectors: ['select']
  })
  await select${index}.selectOption('${option.replace(/'/g, "\\'")}')`
		}

		return `  await page.locator('[data-page-agent-index="${index}"]').selectOption('${option.replace(/'/g, "\\'")}')`
	}

	/**
	 * Generate wait code
	 */
	private generateWaitCode(step: PlaybookStep): string {
		const seconds = parseInt(step.value || '1')
		const ms = seconds * 1000

		return `  await page.waitForTimeout(${ms})`
	}

	/**
	 * Generate assert code
	 */
	private generateAssertCode(step: PlaybookStep): string {
		const condition = step.value || ''

		// Try to parse common assertions
		if (condition.includes('visible')) {
			return `  await expect(page.locator('body')).toBeVisible()`
		}
		if (condition.includes('text')) {
			const match = condition.match(/text["']?\s*[:=]\s*["']?([^"']+)/)
			if (match) {
				return `  await expect(page.locator('body')).toContainText('${match[1]}')`
			}
		}

		return `  // Assertion: ${condition}`
	}

	/**
	 * Generate self-healing helper class
	 */
	generateSelfHealingHelper(): string {
		return `/**
 * Self-Healing Locator Helper for Playwright
 * Generated by Page Agent Testing Framework
 */

import { Page, Locator } from '@playwright/test'

export interface ElementFingerprint {
  tagName?: string
  textContent?: string
  testId?: string
  inputType?: string
  placeholder?: string
  ariaLabel?: string
}

export interface SelfHealingConfig {
  fingerprint: ElementFingerprint
  fallbackSelectors?: string[]
  timeout?: number
}

export class SelfHealingLocator {
  private page: Page
  private config: SelfHealingConfig
  private resolvedLocator: Locator | null = null

  constructor(page: Page, config: SelfHealingConfig) {
    this.page = page
    this.config = config
  }

  /**
   * Resolve the locator using multiple strategies
   */
  async resolve(): Promise<Locator> {
    if (this.resolvedLocator) {
      return this.resolvedLocator
    }

    // Try fallback selectors first
    if (this.config.fallbackSelectors) {
      for (const selector of this.config.fallbackSelectors) {
        try {
          const locator = this.page.locator(selector).first()
          if (await locator.isVisible({ timeout: 1000 }).catch(() => false)) {
            this.resolvedLocator = locator
            return locator
          }
        } catch {
          // Continue to next selector
        }
      }
    }

    // Try fingerprint-based matching
    const { fingerprint } = this.config
    
    if (fingerprint.testId) {
      const locator = this.page.locator(\`[data-testid="\${fingerprint.testId}"]\`).first()
      if (await locator.isVisible({ timeout: 1000 }).catch(() => false)) {
        this.resolvedLocator = locator
        return locator
      }
    }

    if (fingerprint.textContent) {
      const locator = this.page.locator(\`\${fingerprint.tagName || '*'}:has-text("\${fingerprint.textContent.substring(0, 30)}")\`).first()
      if (await locator.isVisible({ timeout: 1000 }).catch(() => false)) {
        this.resolvedLocator = locator
        return locator
      }
    }

    if (fingerprint.ariaLabel) {
      const locator = this.page.locator(\`[aria-label="\${fingerprint.ariaLabel}"]\`).first()
      if (await locator.isVisible({ timeout: 1000 }).catch(() => false)) {
        this.resolvedLocator = locator
        return locator
      }
    }

    throw new Error(\`Could not resolve element with fingerprint: \${JSON.stringify(fingerprint)}\`)
  }

  /**
   * Click the element
   */
  async click(): Promise<void> {
    const locator = await this.resolve()
    await locator.click()
  }

  /**
   * Fill the element
   */
  async fill(value: string): Promise<void> {
    const locator = await this.resolve()
    await locator.fill(value)
  }

  /**
   * Select option
   */
  async selectOption(value: string): Promise<void> {
    const locator = await this.resolve()
    await locator.selectOption(value)
  }

  /**
   * Check if element is visible
   */
  async isVisible(): Promise<boolean> {
    try {
      const locator = await this.resolve()
      return await locator.isVisible()
    } catch {
      return false
    }
  }
}
`
	}

	/**
	 * Sanitize test name for use in code
	 */
	private sanitizeTestName(name: string): string {
		return name
			.replace(/[^a-zA-Z0-9\s]/g, '')
			.replace(/\s+/g, ' ')
			.trim()
	}

	/**
	 * Generate configuration file
	 */
	generateConfig(): string {
		return `/**
 * Playwright Configuration
 * Generated by Page Agent Testing Framework
 */

import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],
})
`
	}
}
