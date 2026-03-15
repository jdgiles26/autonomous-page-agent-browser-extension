/**
 * Copyright (C) 2025 Alibaba Group Holding Limited
 * All rights reserved.
 */
import { type AgentConfig, PageAgentCore } from '@page-agent/core'
import { PageController, type PageControllerConfig } from '@page-agent/page-controller'
import { Panel, type PanelConfig } from '@page-agent/ui'

export * from '@page-agent/core'

export type PageAgentConfig = AgentConfig & PageControllerConfig & PanelConfig

export class PageAgent extends PageAgentCore {
	panel: Panel

	constructor(config: PageAgentConfig) {
		const pageController = new PageController({
			...config,
			enableMask: config.enableMask ?? true,
		})

		// Wire up demo mode recording callback
		const panelConfig: PanelConfig = {
			language: config.language,
			enableDemoMode: config.enableDemoMode,
			promptForNextTask: config.promptForNextTask,
		}

		super({
			...config,
			pageController,
			onDemoStep: config.enableDemoMode
				? (toolName, input) => {
						// This will be called after the panel is created
						// We'll set up the actual callback below
				  }
				: undefined,
		})

		this.panel = new Panel(this, panelConfig)

		// Now wire up the actual demo step callback to the panel
		if (config.enableDemoMode) {
			this.config.onDemoStep = (toolName: string, input: Record<string, unknown>) => {
				this.panel.recordDemoStep(toolName, input)
			}
		}
	}
}
