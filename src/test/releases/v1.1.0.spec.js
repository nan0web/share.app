/**
 * v1.1.0 Contract Tests
 *
 * RED phase: all tests here must FAIL before implementation.
 * GREEN phase: implement until all pass.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { SocialAdapter, NotImplementedError } from '../../core/SocialAdapter.js'
import { DummyAdapter } from '../../core/DummyAdapter.js'
import { TelegramAdapter, TelegramAdapterConfig } from '../../adapters/TelegramAdapter.js'
import {
	Model,
	SocialAdapterConfig,
	SocialAdapterContent,
	SocialAdapterValidationError,
} from '../../core/Models.js'
import { evaluateRules, executeTasks } from '../../core/RulesEngine.js'

// ─── 1. update() Protocol ────────────────────────────────────

test('SocialAdapter - update() protocol', async (t) => {
	await t.test(
		'base class throws capability error for update() since no edit capability',
		async () => {
			const adapter = new SocialAdapter()
			// Base adapter has no 'edit' capability → capability error, not NotImplementedError
			await assert.rejects(
				() => adapter.update('post-1', { text: 'new' }),
				/does not support editing/,
			)
		},
	)

	await t.test('throws capability error when adapter does not support edit', async () => {
		class NoEditAdapter extends SocialAdapter {
			get id() {
				return 'no-edit'
			}
			get capabilities() {
				return []
			}
		}
		const adapter = new NoEditAdapter()
		await assert.rejects(
			() => adapter.update('post-1', { text: 'new' }),
			/does not support editing/,
		)
	})
})

test('DummyAdapter - update()', async (t) => {
	await t.test('has edit capability', () => {
		const dummy = new DummyAdapter()
		assert.ok(dummy.can('edit'))
	})

	await t.test('updates an existing post in-memory', async () => {
		const dummy = new DummyAdapter()
		const { id } = await dummy.publish({ text: 'Original text', tags: [] })

		const result = await dummy.update(id, { text: 'Updated text', tags: [] })
		assert.equal(result.id, id)

		const stored = dummy.posts.get(id)
		assert.equal(stored.text, 'Updated text')
	})

	await t.test('throws if post does not exist', async () => {
		const dummy = new DummyAdapter()
		await assert.rejects(() => dummy.update('nonexistent', { text: 'x' }), /Post not found/)
	})
})

test('TelegramAdapter - update()', async (t) => {
	await t.test('has edit capability', () => {
		const a = new TelegramAdapter({ botToken: 'tok', chatId: '@ch' })
		assert.ok(a.can('edit'))
	})

	await t.test('calls editMessageText for text posts', async () => {
		const adapter = new TelegramAdapter({ botToken: 'tok', chatId: '@ch' })
		const calls = []
		adapter._callApi = async (method, body) => {
			calls.push({ method, body })
			if (method === 'editMessageText') return { message_id: 42 }
		}
		const result = await adapter.update('42', { text: 'Edited' })
		assert.equal(result.id, '42')
		assert.equal(calls[0].method, 'editMessageText')
		assert.equal(calls[0].body.text, 'Edited')
		assert.equal(calls[0].body.message_id, 42)
	})

	await t.test('calls editMessageCaption for posts with photo', async () => {
		const adapter = new TelegramAdapter({ botToken: 'tok', chatId: '@ch' })
		const calls = []
		adapter._callApi = async (method, body) => {
			calls.push({ method, body })
			return { message_id: 43 }
		}
		await adapter.update('43', { photo: 'url', text: 'New caption' })
		assert.equal(calls[0].method, 'editMessageCaption')
		assert.equal(calls[0].body.caption, 'New caption')
	})
})

// ─── 2. verify() Gate in executeTasks ────────────────────────

test('executeTasks - verify() gate', async (t) => {
	await t.test('calls verify() before first publish for each adapter', async () => {
		const verifyCalls = []
		const dummy = new DummyAdapter()
		const originalVerify = dummy.verify.bind(dummy)
		dummy.verify = async () => {
			verifyCalls.push('verified')
			return originalVerify()
		}

		const tasks = [
			{ adapter: dummy, content: { text: 'Post 1', tags: [] }, delayMs: 0, ruleName: 'r' },
			{ adapter: dummy, content: { text: 'Post 2', tags: [] }, delayMs: 0, ruleName: 'r' },
		]

		await executeTasks(tasks, { verify: true })
		// verify() called only once for same adapter, not per task
		assert.equal(verifyCalls.length, 1)
	})

	await t.test('skips adapter tasks if verify() throws', async () => {
		const broken = new DummyAdapter({ rejectVerify: true })

		const tasks = [
			{ adapter: broken, content: { text: 'Post', tags: [] }, delayMs: 0, ruleName: 'r' },
		]

		const results = await executeTasks(tasks, { verify: true })
		// No results — adapter failed verification, tasks skipped
		assert.equal(results.length, 0)
		assert.equal(broken.posts.size, 0)
	})

	await t.test('publishes when verify() passes', async () => {
		const good = new DummyAdapter()
		const tasks = [
			{ adapter: good, content: { text: 'Hello', tags: [] }, delayMs: 0, ruleName: 'r' },
		]
		const results = await executeTasks(tasks, { verify: true })
		assert.equal(results.length, 1)
	})
})

// ─── 3. Content Validation ───────────────────────────────────

test('SocialAdapterContent - validate()', async (t) => {
	await t.test('is a static method on SocialAdapterContent', () => {
		assert.equal(typeof SocialAdapterContent.validate, 'function')
	})

	await t.test('returns { valid: true } for valid content', () => {
		const result = SocialAdapterContent.validate({ text: 'Hello', tags: ['public'] })
		assert.equal(result.valid, true)
		assert.deepEqual(result.errors, [])
	})

	await t.test('returns errors for empty content (no text, no media)', () => {
		const result = SocialAdapterContent.validate({ tags: [] })
		assert.equal(result.valid, false)
		assert.ok(result.errors.length > 0)
		assert.ok(result.errors.some((e) => e.includes('text')))
	})

	await t.test('accepts photo-only content (no text required)', () => {
		const result = SocialAdapterContent.validate({ photo: 'https://example.com/img.jpg' })
		assert.equal(result.valid, true)
	})
})

test('SocialAdapterValidationError', (t) => {
	assert.ok(SocialAdapterValidationError, 'should be exported from Models.js')
	const err = new SocialAdapterValidationError(['text is required'])
	assert.ok(err instanceof Error)
	assert.ok(err.message.includes('text is required'))
	assert.deepEqual(err.errors, ['text is required'])
})

test('evaluateRules - validates content before processing', (t) => {
	const adapters = new Map([['dummy', new DummyAdapter()]])
	const rules = [{ name: 'r', if: {}, publish: [{ adapter: 'dummy', delay: 0 }] }]

	// completely empty content → should throw SocialAdapterValidationError
	assert.throws(() => evaluateRules({}, rules, adapters), SocialAdapterValidationError)
})

// ─── 4. Model.describe() ─────────────────────────────────────

test('Model.describe() - auto-documentation', (t) => {
	assert.equal(typeof Model.describe, 'function', 'should be a static method')

	const desc = SocialAdapterConfig.describe()
	assert.ok(Array.isArray(desc))
	assert.ok(desc.length > 0)

	const idField = desc.find((f) => f.field === 'id')
	assert.ok(idField, 'should include id field')
	assert.ok('help' in idField)
	assert.ok('default' in idField)
})

test('TelegramAdapterConfig.describe() - includes inherited + own fields', (t) => {
	const desc = TelegramAdapterConfig.describe()
	const botTokenField = desc.find((f) => f.field === 'botToken')
	assert.ok(botTokenField, 'should include botToken field')
	assert.ok(botTokenField.help.includes('BotFather'))
})
