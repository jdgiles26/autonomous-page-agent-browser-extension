# @page-agent/local-llm

Local GGUF model inference with continuous learning for page-agent. Run AI models directly in the browser without API keys!

## Features

- 🏠 **Local Inference** - Run GGUF models directly in the browser using WebAssembly
- 📦 **Model Management** - Download, cache, and manage models with IndexedDB
- 🧠 **Continuous Learning** - Improves accuracy over time through feedback loops
- 🎛️ **Smart Parameters** - Automatically adjusts temperature and other parameters based on success rates
- 📊 **Learning Dashboard** - Visualize learning progress and patterns
- 🔄 **API Fallback** - Seamlessly fall back to API-based models when needed

## Installation

```bash
npm install @page-agent/local-llm
```

## Quick Start

### Using Preset Models

```typescript
import { PageAgent } from 'page-agent'
import { createLocalLLMClient } from '@page-agent/local-llm'

const agent = new PageAgent({
	llm: createLocalLLMClient({
		model: 'llama-3.2-3b-instruct-q4', // Downloads automatically
	}),
})

await agent.run('Click the login button')
```

### Using a Downloaded Model

```typescript
import { createLocalLLMClient } from '@page-agent/local-llm'

const agent = new PageAgent({
	llm: createLocalLLMClient({
		modelPath: 'indexeddb://my-model', // Use cached model
	}),
})
```

### Uploading Your Own Model

```typescript
import { ModelManager } from '@page-agent/local-llm'

const modelManager = new ModelManager()
await modelManager.initialize()

// From file input
const fileInput = document.getElementById('file-input')
fileInput.addEventListener('change', async (e) => {
	const file = e.target.files[0]
	const metadata = await modelManager.loadModelFromFile(file)
	console.log('Model loaded:', metadata.name)
})
```

## Preset Models

The following models are available for automatic download:

| Model | Size | Description |
|-------|------|-------------|
| `llama-3.2-1b-instruct-q4` | 800 MB | Fast, lightweight for simple tasks |
| `llama-3.2-3b-instruct-q4` | 1.9 GB | Balanced speed and quality |
| `qwen2.5-3b-instruct-q4` | 1.9 GB | Excellent instruction following |
| `phi-4-mini-instruct-q4` | 2.4 GB | Great reasoning for UI tasks |
| `gemma-2-2b-it-q4` | 1.6 GB | Good for concise responses |

## Learning System

The learning system automatically improves accuracy over time:

```typescript
import { LearningEngine, FeedbackLoop } from '@page-agent/local-llm'

// Get learning statistics
const stats = await learningEngine.getStats()
console.log(`Accuracy: ${stats.accuracy * 100}%`)

// Export learning data for backup
const data = await learningEngine.exportLearningData()
localStorage.setItem('learning-data', data)

// Import learning data
await learningEngine.importLearningData(localStorage.getItem('learning-data'))
```

## UI Components

### Model Selector

```typescript
import { ModelSelector } from '@page-agent/local-llm'

const selector = new ModelSelector({
	modelManager,
	onModelSelect: (model) => console.log('Selected:', model.name),
	onDownloadProgress: (progress) => console.log(`${progress.percentage}%`),
})

selector.mount(document.getElementById('model-selector'))
```

### Learning Dashboard

```typescript
import { LearningDashboard } from '@page-agent/local-llm'

const dashboard = new LearningDashboard({
	learningEngine,
})

dashboard.mount(document.getElementById('dashboard'))
dashboard.startAutoRefresh(5000) // Update every 5 seconds
```

## Configuration

```typescript
interface LocalLLMConfig {
	// Model selection
	model?: string // Preset model ID
	modelPath?: string // Path to GGUF file
	modelUrl?: string // URL to download
	modelId?: string // Unique identifier

	// Inference settings
	contextSize?: number // Default: 4096
	gpuLayers?: number // Default: 0 (CPU only)
	temperature?: number // Default: 0.7

	// Learning settings
	learningEnabled?: boolean // Default: true
	maxLearningExamples?: number // Default: 10000

	// Fallback
	fallbackConfig?: LLMConfig // API fallback
}
```

## Browser Support

Requires:
- IndexedDB
- Web Workers
- WebAssembly

All modern browsers (Chrome, Firefox, Safari, Edge) are supported.

## Storage Requirements

Models are stored in IndexedDB. Ensure you have enough storage:

```typescript
import { getStorageEstimate } from '@page-agent/local-llm'

const estimate = await getStorageEstimate()
console.log(`Available: ${estimate.remaining / 1024 / 1024} MB`)
```

## License

MIT
