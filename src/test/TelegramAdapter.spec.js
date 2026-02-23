import test from 'node:test'
import assert from 'node:assert/strict'
import { TelegramAdapter, TelegramAdapterConfig } from '../adapters/TelegramAdapter.js'
import { SocialAdapterConfig } from '../core/Models.js'

/**
 * Creates a TelegramAdapter with a mocked _callApi method.
 * @param {Object} [overrides] - Partial config overrides
 * @param {Function} [mockFn] - Custom mock for _callApi
 * @returns {TelegramAdapter}
 */
function createMockedAdapter(overrides = {}, mockFn) {
	const adapter = new TelegramAdapter({
		botToken: 'test-token-123',
		chatId: '@test_channel',
		...overrides,
	})
	const calls = []
	adapter._callApi =
		mockFn ||
		async function (method, body) {
			calls.push({ method, body })
			if (method === 'getMe') return { id: 123, is_bot: true, first_name: 'TestBot' }
			if (method === 'sendMessage') return { message_id: 42 }
			if (method === 'sendPhoto') return { message_id: 43 }
			if (method === 'sendDocument') return { message_id: 44 }
			if (method === 'deleteMessage') return true
			return {}
		}
	adapter._calls = calls
	return adapter
}

test('TelegramAdapterConfig - Model', async (t) => {
	await t.test('extends SocialAdapterConfig', () => {
		const config = new TelegramAdapterConfig({ botToken: 'tok', chatId: '@ch' })
		assert.ok(config instanceof TelegramAdapterConfig)
		assert.ok(config instanceof SocialAdapterConfig)
	})

	await t.test('declares all fields explicitly', () => {
		const config = new TelegramAdapterConfig({ botToken: 'tok', chatId: '@ch' })
		assert.equal(config.botToken, 'tok')
		assert.equal(config.chatId, '@ch')
		assert.equal(config.parseMode, 'HTML')
		assert.equal(config.disableNotification, false)
	})

	await t.test('has introspectable static field definitions', () => {
		assert.ok('help' in TelegramAdapterConfig.botToken)
		assert.ok('help' in TelegramAdapterConfig.chatId)
		assert.equal(TelegramAdapterConfig.parseMode.default, 'HTML')
		assert.equal(TelegramAdapterConfig.disableNotification.default, false)
	})

	await t.test('toJSON includes all telegram-specific fields', () => {
		const config = new TelegramAdapterConfig({ botToken: 'tok', chatId: '@ch', account: 'main' })
		const json = config.toJSON()
		assert.equal(json.botToken, 'tok')
		assert.equal(json.chatId, '@ch')
		assert.equal(json.account, 'main')
	})
})

test('TelegramAdapter - Config Validation', async (t) => {
	await t.test('throws if botToken is missing', () => {
		assert.throws(() => new TelegramAdapter({ chatId: '@ch' }), /requires config.botToken/)
	})

	await t.test('throws if chatId is missing', () => {
		assert.throws(() => new TelegramAdapter({ botToken: 'tok' }), /requires config.chatId/)
	})

	await t.test('creates successfully with valid config', () => {
		const a = new TelegramAdapter({ botToken: 'tok', chatId: '@ch' })
		assert.equal(a.id, 'telegram')
	})
})

test('TelegramAdapter - Capabilities & Limits', async (t) => {
	const adapter = createMockedAdapter()

	await t.test('reports correct capabilities as string[]', () => {
		const caps = adapter.capabilities
		assert.ok(Array.isArray(caps))
		assert.ok(caps.includes('media'))
		assert.ok(caps.includes('delete'))
		assert.ok(caps.includes('reply'))
		assert.ok(caps.includes('photo'))
		assert.ok(caps.includes('video'))
	})

	await t.test('can() helper works', () => {
		assert.ok(adapter.can('delete'))
		assert.ok(adapter.can('reply'))
		assert.equal(adapter.can('threads'), false)
	})

	await t.test('reports correct limits', () => {
		assert.equal(adapter.limits.maxLength, 4096)
	})
})

test('TelegramAdapter - verify()', async (t) => {
	await t.test('returns true on successful getMe', async () => {
		const adapter = createMockedAdapter()
		assert.equal(await adapter.verify(), true)
		assert.equal(adapter._calls[0].method, 'getMe')
	})

	await t.test('throws on API error', async () => {
		const adapter = createMockedAdapter({}, async () => {
			throw new Error('Telegram API error: Unauthorized')
		})
		await assert.rejects(() => adapter.verify(), /Unauthorized/)
	})
})

test('TelegramAdapter - publish()', async (t) => {
	await t.test('sends text message via sendMessage', async () => {
		const adapter = createMockedAdapter()
		const result = await adapter.publish({ text: 'Hello from nan0web!' })
		assert.equal(result.id, '42')
		assert.ok(result.url.includes('/42'))
		assert.equal(adapter._calls[0].method, 'sendMessage')
		assert.equal(adapter._calls[0].body.text, 'Hello from nan0web!')
		assert.equal(adapter._calls[0].body.parse_mode, 'HTML')
	})

	await t.test('sends photo via sendPhoto when content.photo is present', async () => {
		const adapter = createMockedAdapter()
		const result = await adapter.publish({ photo: 'https://example.com/img.jpg', text: 'Caption!' })
		assert.equal(result.id, '43')
		assert.equal(adapter._calls[0].method, 'sendPhoto')
		assert.equal(adapter._calls[0].body.caption, 'Caption!')
	})

	await t.test('sends document via sendDocument when content.document is present', async () => {
		const adapter = createMockedAdapter()
		const result = await adapter.publish({ document: 'https://example.com/file.pdf', text: 'Doc' })
		assert.equal(result.id, '44')
		assert.equal(adapter._calls[0].method, 'sendDocument')
	})

	await t.test('throws when text exceeds maxLength (4096)', async () => {
		const adapter = createMockedAdapter()
		const longText = 'x'.repeat(5000)
		await assert.rejects(() => adapter.publish({ text: longText }), /exceeds max length/)
	})

	await t.test('respects custom parseMode', async () => {
		const adapter = createMockedAdapter({ parseMode: 'MarkdownV2' })
		await adapter.publish({ text: 'test' })
		assert.equal(adapter._calls[0].body.parse_mode, 'MarkdownV2')
	})

	await t.test('respects disableNotification', async () => {
		const adapter = createMockedAdapter({ disableNotification: true })
		await adapter.publish({ text: 'silent' })
		assert.equal(adapter._calls[0].body.disable_notification, true)
	})
})

test('TelegramAdapter - delete()', async (t) => {
	await t.test('calls deleteMessage with correct params', async () => {
		const adapter = createMockedAdapter()
		const result = await adapter.delete('42')
		assert.equal(result, true)
		assert.equal(adapter._calls[0].method, 'deleteMessage')
		assert.equal(adapter._calls[0].body.message_id, 42)
		assert.equal(adapter._calls[0].body.chat_id, '@test_channel')
	})
})

test('TelegramAdapter - syncFeedback()', async (t) => {
	await t.test('returns empty array (Telegram Bot API limitation)', async () => {
		const adapter = createMockedAdapter()
		const feedback = await adapter.syncFeedback('42')
		assert.ok(Array.isArray(feedback))
		assert.equal(feedback.length, 0)
	})
})

test('TelegramAdapter - reply()', async (t) => {
	await t.test('sends reply with reply_to_message_id', async () => {
		const adapter = createMockedAdapter()
		const result = await adapter.reply(
			{ id: '42', network: 'telegram' },
			'Thanks for the feedback!',
		)
		assert.equal(result.id, '42')
		assert.equal(adapter._calls[0].method, 'sendMessage')
		assert.equal(adapter._calls[0].body.reply_to_message_id, 42)
		assert.equal(adapter._calls[0].body.text, 'Thanks for the feedback!')
	})
})
