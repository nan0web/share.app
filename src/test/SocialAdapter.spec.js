import test from 'node:test'
import assert from 'node:assert/strict'
import { SocialAdapter, NotImplementedError } from '../core/SocialAdapter.js'
import { DummyAdapter } from '../core/DummyAdapter.js'

test('SocialAdapter - Base Protocol Enforcement', async (t) => {
	const adapter = new SocialAdapter()

	await t.test('capabilities return empty array by default', () => {
		const caps = adapter.capabilities
		assert.ok(Array.isArray(caps))
		assert.equal(caps.length, 0)
	})

	await t.test('limits return defaults', () => {
		assert.equal(adapter.limits.maxLength, Infinity)
	})

	await t.test('can() returns false for everything by default', () => {
		assert.equal(adapter.can('delete'), false)
		assert.equal(adapter.can('media'), false)
		assert.equal(adapter.can('reply'), false)
	})

	await t.test('throws NotImplementedError for unoverridden properties/methods', async () => {
		assert.throws(() => adapter.id, NotImplementedError)
		await assert.rejects(() => adapter.verify(), NotImplementedError)
		await assert.rejects(() => adapter.publish({}), NotImplementedError)
		await assert.rejects(() => adapter.syncFeedback('post-1'), NotImplementedError)
	})

	await t.test('throws capability error for unsupported features', async () => {
		await assert.rejects(() => adapter.delete('post-1'), /does not support deleting/)
		await assert.rejects(
			() => adapter.reply({ id: 'comment-1', network: 'test' }, 'hi'),
			/does not support replying/,
		)
	})
})

test('DummyAdapter - Valid Reference Implementation', async (t) => {
	await t.test('should return correct identity, capabilities and limits', () => {
		const dummy = new DummyAdapter({ apiKey: 'testing' })
		assert.equal(dummy.id, 'dummy')
		assert.ok(dummy.can('delete'))
		assert.ok(dummy.can('reply'))
		assert.ok(dummy.can('media'))
		assert.ok(dummy.can('photo'))
		assert.equal(dummy.can('threads'), false)
		assert.equal(dummy.limits.maxLength, 280)
	})

	await t.test('should verify connection with valid config', async () => {
		const valid = new DummyAdapter({ rejectVerify: false })
		assert.equal(await valid.verify(), true)

		const invalid = new DummyAdapter({ rejectVerify: true })
		await assert.rejects(() => invalid.verify(), /Invalid config: fake rejection/)
	})

	await t.test('should enforce limits (maxLength)', async () => {
		const adapter = new DummyAdapter()
		const longText = 'a'.repeat(300)
		await assert.rejects(() => adapter.publish({ text: longText }), /exceeds max length/)
	})

	await t.test('should publish, return URL, and allow deletion', async () => {
		const adapter = new DummyAdapter()
		const result = await adapter.publish({ text: 'Hello Sovereign World!' })

		assert.ok(result.id.startsWith('dummy-post-'))
		assert.equal(result.url, `https://dummy.nan0web.app/posts/${result.id}`)

		const feedback = await adapter.syncFeedback(result.id)
		assert.equal(feedback.length, 2)
		assert.equal(feedback[0].author, 'Alice Sovereign')
		assert.equal(feedback[0].network, 'dummy')

		const replyResult = await adapter.reply({ id: feedback[0].id, network: 'dummy' }, 'Thanks!')
		assert.ok(replyResult.id.startsWith('r-'))

		await adapter.delete(result.id)
		await assert.rejects(() => adapter.delete(result.id), /Post not found/)
	})
})
