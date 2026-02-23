import test from 'node:test'
import assert from 'node:assert/strict'
import {
	Model,
	SocialAdapterConfig,
	SocialAdapterLimits,
	SocialAdapterContent,
	SocialAdapterFeedback,
	SocialAdapterTarget,
	createConfig,
	createLimits,
	createContent,
	createFeedback,
	createTarget,
} from '../core/Models.js'

test('Model - base class', async (t) => {
	await t.test('toJSON returns plain object', () => {
		const m = new Model()
		assert.deepEqual(m.toJSON(), {})
	})

	await t.test('from parses string payload', () => {
		const m = SocialAdapterConfig.from('{"account": "test"}')
		assert.equal(m.account, 'test')
	})
})

test('SocialAdapterConfig - Model', async (t) => {
	await t.test('factory returns instance of SocialAdapterConfig', () => {
		const config = createConfig()
		assert.ok(config instanceof SocialAdapterConfig)
		assert.ok(config instanceof Model)
	})

	await t.test('returns defaults for empty input', () => {
		const config = createConfig()
		assert.deepEqual(config.credentials, {})
		assert.equal(config.id, undefined)
		assert.equal(config.account, undefined)
	})

	await t.test('schema is introspectable via static fields for auto-docs', () => {
		assert.equal(SocialAdapterConfig.id.default, undefined)
		assert.ok('help' in SocialAdapterConfig.account)
		assert.deepEqual(SocialAdapterConfig.credentials.default, {})
	})

	await t.test('base config does NOT include adapter-specific fields', () => {
		const config = createConfig({ botToken: 'abc', chatId: '@ch', account: 'main' })
		// base model only knows about id, account, credentials
		assert.equal(config.account, 'main')
		assert.equal(config.botToken, undefined)
		assert.equal(config.chatId, undefined)
	})

	await t.test('serializes to JSON', () => {
		const config = createConfig({ account: 'me' })
		const json = config.toJSON()
		assert.equal(json.account, 'me')
		assert.equal(json.id, undefined)
	})
})

test('SocialAdapterLimits - Model', async (t) => {
	await t.test('factory returns instance of SocialAdapterLimits', () => {
		const limits = createLimits()
		assert.ok(limits instanceof SocialAdapterLimits)
		assert.ok(limits instanceof Model)
	})

	await t.test('returns safe defaults', () => {
		assert.equal(createLimits().maxLength, Infinity)
	})

	await t.test('schema is introspectable via static fields', () => {
		assert.equal(SocialAdapterLimits.maxLength.default, Infinity)
	})

	await t.test('merges overrides', () => {
		const limits = createLimits({ maxLength: 280 })
		assert.equal(limits.maxLength, 280)
	})

	await t.test('serializes to JSON', () => {
		const json = createLimits({ maxLength: 4096 }).toJSON()
		assert.equal(json.maxLength, 4096)
	})
})

test('SocialAdapterContent - Model', async (t) => {
	await t.test('factory returns instance of SocialAdapterContent', () => {
		assert.ok(createContent() instanceof SocialAdapterContent)
	})

	await t.test('returns defaults for empty input', () => {
		const content = createContent()
		assert.deepEqual(content.tags, [])
		assert.deepEqual(content.options, {})
		assert.equal(content.text, undefined)
	})

	await t.test('schema lists all fields via static properties', () => {
		assert.equal(SocialAdapterContent.text.default, undefined)
		assert.deepEqual(SocialAdapterContent.tags.default, [])
		assert.deepEqual(SocialAdapterContent.options.default, {})
	})

	await t.test('preserves all content fields', () => {
		const content = createContent({
			text: 'Hello',
			photo: 'url',
			tags: ['public'],
			lang: 'uk',
			type: 'post',
			options: { parseMode: 'HTML' },
		})
		assert.equal(content.text, 'Hello')
		assert.equal(content.photo, 'url')
		assert.deepEqual(content.tags, ['public'])
		assert.equal(content.lang, 'uk')
		assert.equal(content.options.parseMode, 'HTML')
	})
})

test('SocialAdapterFeedback - Model', async (t) => {
	await t.test('factory returns instance of SocialAdapterFeedback', () => {
		assert.ok(createFeedback() instanceof SocialAdapterFeedback)
	})

	await t.test('returns defaults for empty input', () => {
		const fb = createFeedback()
		assert.equal(fb.id, '')
		assert.equal(fb.author, 'Unknown')
		assert.equal(fb.type, 'comment')
		assert.equal(fb.network, 'unknown')
		assert.ok(fb.createdAt instanceof Date)
	})

	await t.test('schema includes network field', () => {
		assert.equal(SocialAdapterFeedback.network.default, 'unknown')
	})

	await t.test('populates from raw data', () => {
		const fb = createFeedback({
			id: 'c-1',
			author: 'Alice',
			text: 'Great!',
			network: 'facebook',
			type: 'like',
		})
		assert.equal(fb.id, 'c-1')
		assert.equal(fb.author, 'Alice')
		assert.equal(fb.network, 'facebook')
		assert.equal(fb.type, 'like')
	})
})

test('SocialAdapterTarget - Model', async (t) => {
	await t.test('factory returns instance of SocialAdapterTarget', () => {
		assert.ok(createTarget() instanceof SocialAdapterTarget)
	})

	await t.test('returns defaults for empty input', () => {
		const target = createTarget()
		assert.equal(target.id, '')
		assert.equal(target.network, 'unknown')
		assert.equal(target.account, undefined)
	})

	await t.test('schema supports multi-account', () => {
		assert.equal(SocialAdapterTarget.account.default, undefined)
		assert.equal(SocialAdapterTarget.postId.default, undefined)
	})

	await t.test('supports multi-account targeting', () => {
		const target = createTarget({
			id: 'comment-42',
			network: 'telegram',
			account: 'bot-2',
			postId: 'post-99',
		})
		assert.equal(target.id, 'comment-42')
		assert.equal(target.network, 'telegram')
		assert.equal(target.account, 'bot-2')
		assert.equal(target.postId, 'post-99')
	})

	await t.test('serializes to JSON', () => {
		const json = createTarget({ id: 'x', network: 'fb' }).toJSON()
		assert.equal(json.id, 'x')
		assert.equal(json.network, 'fb')
	})
})
