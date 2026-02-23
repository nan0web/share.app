import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import FS from '@nan0web/db-fs'
import { DocsParser, DatasetParser } from '@nan0web/test'

const fs = new FS()
let pkg

before(async () => {
	const doc = await fs.loadDocument('package.json', {})
	pkg = doc || {}
})

function testRender() {
	/**
	 * @docs
	 * # @nan0web/share.app
	 *
	 * > **Sovereign Social Distribution Layer** — Rules Engine for automatic content distribution across social platforms.
	 *
	 * Configure your rules once. Then `share.app` publishes new content to the right platforms with the right delay — automatically.
	 *
	 * ---
	 *
	 * ## Installation
	 *
	 * ```bash
	 * npm install @nan0web/share.app
	 * ```
	 *
	 * ---
	 *
	 * ## Quick Start
	 *
	 * ```js
	 * import { DummyAdapter, evaluateRules, executeTasks } from '@nan0web/share.app'
	 *
	 * const adapters = new Map([['dummy', new DummyAdapter({ account: 'me' })]])
	 *
	 * const rules = [
	 *   { name: 'All public posts', if: { tags: ['public'] }, publish: [{ adapter: 'dummy', delay: 0 }] },
	 * ]
	 *
	 * const content = { text: 'Hello Sovereign World!', tags: ['public'], type: 'post', lang: 'uk' }
	 *
	 * const tasks = evaluateRules(content, rules, adapters)
	 * const results = await executeTasks(tasks)
	 * // → [{ id: 'dummy-post-...', url: 'https://dummy.nan0web.app/posts/...' }]
	 * ```
	 */
	/** @docs */
	it('quick-start', async () => {
		const { DummyAdapter, evaluateRules, executeTasks } = await import('./index.js')
		const adapters = new Map([['dummy', new DummyAdapter({ account: 'me' })]])
		const rules = [
			{ name: 'All', if: { tags: ['public'] }, publish: [{ adapter: 'dummy', delay: 0 }] },
		]
		const content = { text: 'Hello Sovereign World!', tags: ['public'], type: 'post', lang: 'uk' }
		const tasks = evaluateRules(content, rules, adapters)
		const results = await executeTasks(tasks)
		assert.equal(results.length, 1)
		assert.ok(results[0].id)
	})

	/**
	 * @docs
	 *
	 * ---
	 *
	 * ## Architecture
	 *
	 * ```
	 * Content (post / article / announcement)
	 *     │
	 *     ▼
	 * Rules Engine (evaluateRules)
	 *     │  matches conditions (tags, type, lang, hasMedia)
	 *     │  parses delay (0, '30m', '2h', '1d 09:00', 'Mon 10:00')
	 *     ▼
	 * Tasks [ { adapter, content, delayMs } ]
	 *     │
	 *     ▼
	 * executeTasks → adapter.verify() gate
	 *              → immediate tasks run now
	 *              → delayed tasks via setTimeout (dev) / Queue (prod)
	 *     │
	 *     ▼
	 * SocialAdapter.publish(content) → { id, url }
	 * SocialAdapter.update(id, content) → { id, url }
	 * SocialAdapter.delete(id) → true
	 * ```
	 *
	 * ---
	 *
	 * ## Core Modules
	 *
	 * ### `SocialAdapter` — Base Protocol
	 *
	 * ```js
	 * import { SocialAdapter, createLimits } from '@nan0web/share.app'
	 *
	 * class MyAdapter extends SocialAdapter {
	 *   get id() { return 'my-platform' }
	 *   get capabilities() { return ['media', 'delete', 'reply', 'edit'] }
	 *   get limits() { return createLimits({ maxLength: 500 }) }
	 *
	 *   async verify() { return true }
	 *   async publish(content) { return { id, url } }
	 *   async update(postId, content) { return { id, url } }
	 *   async delete(postId) { return true }
	 *   async syncFeedback(postId) { return [feedback] }
	 *   async reply(target, text) { return { id } }
	 * }
	 * ```
	 *
	 * ### `RulesEngine` — Delay Parser
	 *
	 * ```js
	 * import { parseDelay } from '@nan0web/share.app'
	 *
	 * parseDelay('30m')        // → 1_800_000ms
	 * parseDelay('2h')         // → 7_200_000ms
	 * parseDelay('1d 09:00')   // → ms until tomorrow 09:00
	 * parseDelay('Mon 10:00')  // → ms until next Monday 10:00
	 * ```
	 */
	/** @docs */
	it('rules-engine', async () => {
		const { parseDelay } = await import('./core/RulesEngine.js')
		assert.equal(parseDelay('30m'), 1800000)
		assert.equal(parseDelay('2h'), 7200000)
	})

	/**
	 * @docs
	 *
	 * ### `Models` — Self-Describing Schemas
	 *
	 * ```js
	 * import { SocialAdapterConfig, TelegramAdapterConfig } from '@nan0web/share.app'
	 *
	 * const config = new TelegramAdapterConfig({ botToken: 'abc', chatId: '@ch' })
	 * config instanceof SocialAdapterConfig // true
	 * config.toJSON() // { botToken, chatId, parseMode, disableNotification, ... }
	 *
	 * // Auto-documentation via static field descriptors:
	 * TelegramAdapterConfig.botToken.help    // 'Telegram Bot API token from @BotFather.'
	 * TelegramAdapterConfig.parseMode.default // 'HTML'
	 * ```
	 *
	 * ### `Model.describe()` — Auto-Documentation (v1.1.0)
	 *
	 * ```js
	 * import { TelegramAdapterConfig } from '@nan0web/share.app'
	 *
	 * const docs = TelegramAdapterConfig.describe()
	 * // → [
	 * //   { field: 'botToken', help: 'Telegram Bot API token...', default: '' },
	 * //   { field: 'chatId', help: 'Target chat ID...', default: '' },
	 * //   { field: 'parseMode', help: '...', default: 'HTML' },
	 * //   ...
	 * // ]
	 * ```
	 */
	/** @docs */
	it('models', async () => {
		const { SocialAdapterConfig } = await import('./core/Models.js')
		const { TelegramAdapterConfig } = await import('./adapters/TelegramAdapter.js')
		const config = new TelegramAdapterConfig({ botToken: 'abc', chatId: '@ch' })
		assert.ok(config instanceof SocialAdapterConfig)
		assert.ok(TelegramAdapterConfig.botToken.help)
		const docs = TelegramAdapterConfig.describe()
		assert.ok(Array.isArray(docs))
		assert.ok(docs.length > 0)
	})

	/**
	 * @docs
	 *
	 * ---
	 *
	 * ## Content Validation (v1.1.0)
	 *
	 * ```js
	 * import { SocialAdapterContent } from '@nan0web/share.app'
	 *
	 * const result = SocialAdapterContent.validate({ text: 'Hello!', type: 'post' })
	 * // → { valid: true, errors: [] }
	 *
	 * const invalid = SocialAdapterContent.validate({})
	 * // → { valid: false, errors: ['Content must have text or media'] }
	 * ```
	 *
	 * ---
	 *
	 * ## Full Lifecycle: Publish → Update → Delete
	 *
	 * ```js
	 * import { DummyAdapter } from '@nan0web/share.app'
	 *
	 * const adapter = new DummyAdapter({ account: 'me' })
	 * await adapter.verify()
	 *
	 * // 1. Publish
	 * const post = await adapter.publish({ text: 'First version', type: 'post' })
	 * // → { id: 'dummy-post-...', url: 'https://dummy.nan0web.app/posts/...' }
	 *
	 * // 2. Update (v1.1.0)
	 * const updated = await adapter.update(post.id, { text: 'Updated version' })
	 * // → { id: 'dummy-post-...', url: '...' }
	 *
	 * // 3. Delete
	 * const deleted = await adapter.delete(post.id)
	 * // → true
	 * ```
	 *
	 * ---
	 *
	 * ## Available Adapters
	 *
	 * | Adapter           | Platform                   | Status    |
	 * | ----------------- | -------------------------- | --------- |
	 * | `DummyAdapter`    | In-memory (test/reference) | ✅ v1.0.0 |
	 * | `TelegramAdapter` | Telegram Bot API           | ✅ v1.0.0 |
	 *
	 * Planned: `@nan0web/share-rss` (RSS Feed), `@nan0web/share-x` (X/Twitter API).
	 *
	 * ---
	 *
	 * ## Capabilities Token Reference
	 *
	 * | Token                                    | Meaning                               |
	 * | ---------------------------------------- | ------------------------------------- |
	 * | `media`                                  | Platform accepts photo/video/document |
	 * | `edit`                                   | Platform supports editing posts       |
	 * | `delete`                                 | Platform allows deleting posts        |
	 * | `reply`                                  | Platform supports native replies      |
	 * | `threads`                                | Platform supports threaded posts      |
	 * | `photo` / `video` / `document` / `audio` | Specific media types                  |
	 *
	 * ```js
	 * adapter.can('media')  // true / false
	 * adapter.can('edit')   // true / false
	 * adapter.can('delete') // true / false
	 * ```
	 *
	 * ---
	 *
	 * ## Tests
	 *
	 * ```bash
	 * npm test                 # unit tests (120 specs)
	 * npm run test:docs        # documentation tests
	 * npm run test:integration # E2E integration scenarios
	 * npm run test:all         # full pipeline: test → docs → integration → knip
	 * ```
	 *
	 * ---
	 *
	 * ## Contributing
	 *
	 * 1. Fork the repository
	 * 2. Create a feature branch (`git checkout -b feature/my-adapter`)
	 * 3. Write tests first (TDD) — see `src/test/` for patterns
	 * 4. Implement your adapter extending `SocialAdapter`
	 * 5. Ensure `npm run test:all` passes (all tests + knip)
	 * 6. Submit a Pull Request
	 *
	 * ---
	 *
	 * ## License
	 *
	 * ISC © [nan•web](https://github.com/nan0web)
	 *
	 * ---
	 *
	 * *Part of the [nan•web](https://github.com/nan0web) Sovereign Digital State ecosystem.*
	 */
	/** @docs */
	it('ecosystem', async () => {
		assert.ok(fs)
		assert.ok(pkg.name, '@nan0web/share.app')
	})
}

describe('README.md testing', testRender)

describe('Rendering README.md', async () => {
	let text = ''
	const format = new Intl.NumberFormat('en-US').format
	const parser = new DocsParser()
	const source = await fs.loadDocument('src/README.md.js', '')
	text = String(parser.decode(source))

	await fs.saveDocument('README.md', text)
	const dataset = DatasetParser.parse(text, pkg.name)
	await fs.saveDocument('.datasets/README.dataset.jsonl', dataset)

	it(`document is rendered in README.md [${format(Buffer.byteLength(text))}b]`, async () => {
		const doc = await fs.loadDocument('README.md')
		assert.ok(doc.includes('## Architecture'))
		assert.ok(doc.includes('## Installation'))
		assert.ok(doc.includes('## Full Lifecycle'))
		assert.ok(doc.includes('## Content Validation'))
		assert.ok(doc.includes('## Contributing'))
		assert.ok(doc.includes('## License'))
		assert.ok(!doc.includes('await import('), 'No test code leaked into README')
		assert.ok(!doc.includes('*\\/'), 'No escaped comment closers in README')
	})
})
