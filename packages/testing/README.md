# @page-agent/testing

Intelligent testing framework for Page Agent - autonomous UI/GUI web testing with Playwright test generation and AI-friendly reporting.

## Features

### 1. Visual Playbook Recorder & Replay
Record user interactions as reusable playbooks that can be replayed or converted to agent instructions.

```typescript
import { PlaybookRecorder } from '@page-agent/testing'

const recorder = new PlaybookRecorder(pageController)
recorder.startRecording('Login Flow')
// ... user interactions ...
const playbook = recorder.stopRecording()
```

### 2. Semantic Element Search
Natural language element targeting with embeddings for resilient automation.

```typescript
import { ElementEmbeddings } from '@page-agent/testing'

const embeddings = new ElementEmbeddings()
await embeddings.initialize()

const result = await embeddings.findElement(
  'the blue submit button in the header',
  flatTree
)
```

### 3. Adaptive Wait Strategy
Intelligent waiting using MutationObserver and network monitoring.

```typescript
import { AdaptiveWait } from '@page-agent/testing'

const adaptiveWait = new AdaptiveWait()
adaptiveWait.initialize()

await adaptiveWait.waitForElement('.modal', 10000)
await adaptiveWait.waitForNetworkIdle()
await adaptiveWait.smartWait('click')
```

### 4. Self-Healing Selectors
Element fingerprinting for resilient targeting when DOM changes.

```typescript
import { SelfHealingSelector } from '@page-agent/testing'

const healing = new SelfHealingSelector()
healing.cacheFingerprint(index, flatTree)

// When element not found, automatically heal
const healed = await healing.healSelector(failedIndex, flatTree)
```

### 5. Context-Aware Smart Suggestions
Proactive task suggestions based on page pattern detection.

```typescript
import { SmartSuggestions } from '@page-agent/testing'

const suggestions = new SmartSuggestions()
const patterns = await suggestions.analyzePage(flatTree, url)
const tasks = suggestions.generateSuggestions(patterns)
```

### 6. Structured Data Extraction
Schema-validated data extraction with pagination support.

```typescript
import { DataExtractor } from '@page-agent/testing'

const extractor = new DataExtractor()
const result = await extractor.extract({
  type: 'table',
  fields: [
    { name: 'name', type: 'string', description: 'Product name' },
    { name: 'price', type: 'number', description: 'Product price' }
  ]
}, flatTree)
```

### 7. Visual Diff & Change Detection
Before/after comparison with visual highlighting.

```typescript
import { VisualDiff, DOMDiff } from '@page-agent/testing'

const visualDiff = new VisualDiff()
const domDiff = new DOMDiff()

const result = await visualDiff.compare(beforeImage, afterImage)
const changes = domDiff.compare(beforeTree, afterTree)
```

## Autonomous Tester

The main testing engine that combines all features:

```typescript
import { AutonomousTester } from '@page-agent/testing'

const tester = new AutonomousTester({
  pageAgent,
  testConfig: {
    targetUrl: 'https://example.com',
    testType: 'exploratory',
    depth: 'shallow',
    maxDuration: 60000,
    generatePlaywright: true,
    generateReport: true
  }
})

tester.addEventListener('test:complete', (e) => {
  console.log('Test completed:', e.detail.result)
})

const result = await tester.run()
```

## AI-Friendly Reports

Generate reports optimized for AI coding assistants:

```typescript
import { AIReportGenerator } from '@page-agent/testing'

const generator = new AIReportGenerator()
const aiReport = generator.generate(testResult)

// Markdown for AI consumption
const markdown = generator.generateMarkdown(aiReport)

// JSON for programmatic access
const json = generator.generateJSON(aiReport)

// Prompt for AI assistant
const prompt = generator.generateAIPrompt(aiReport, findingId)
```

## Playwright Test Generation

Convert playbooks to Playwright tests:

```typescript
import { PlaywrightGenerator } from '@page-agent/testing'

const generator = new PlaywrightGenerator()
const testCode = generator.generateTest(playbook)
const testSuite = generator.generateTestSuite(playbooks)

// Generate self-healing helper
const helperCode = generator.generateSelfHealingHelper()
```

## Testing Panel UI

Interactive UI for running tests:

```typescript
import { TestingPanel } from '@page-agent/testing'

const panel = new TestingPanel({ pageAgent, autoRun: true })
panel.show()
```

## Demo Mode

Auto-run tests with keyboard shortcut (Ctrl+Shift+T):

```typescript
import { initDemoMode, runDemoTest } from '@page-agent/testing'

// Auto-initialize
initDemoMode(pageAgent)

// Or manual run
const result = await runDemoTest({
  pageAgent,
  autoRun: true,
  showPanel: true,
  onComplete: (result) => {
    console.log('Tests completed:', result)
  }
})
```

## License

MIT
