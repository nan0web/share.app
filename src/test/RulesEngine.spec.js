import test from 'node:test'
import assert from 'node:assert/strict'
import { parseDelay, matchesConditions, evaluateRules, executeTasks } from '../core/RulesEngine.js'
import { DummyAdapter } from '../core/DummyAdapter.js'

// ─── parseDelay ──────────────────────────────────────────────

test('parseDelay - converts delay strings to milliseconds', async (t) => {
	await t.test('0 and null return 0ms', () => {
		assert.equal(parseDelay(0), 0)
		assert.equal(parseDelay('0'), 0)
		assert.equal(parseDelay(null), 0)
		assert.equal(parseDelay(undefined), 0)
	})

	await t.test('numeric values pass through', () => {
		assert.equal(parseDelay(5000), 5000)
	})

	await t.test('parses minutes', () => {
		assert.equal(parseDelay('30m'), 30 * 60 * 1000)
		assert.equal(parseDelay('1m'), 60 * 1000)
	})

	await t.test('parses hours', () => {
		assert.equal(parseDelay('2h'), 2 * 60 * 60 * 1000)
	})

	await t.test('parses days', () => {
		assert.equal(parseDelay('1d'), 24 * 60 * 60 * 1000)
		assert.equal(parseDelay('7d'), 7 * 24 * 60 * 60 * 1000)
	})

	await t.test('parses day + time (1d 09:00)', () => {
		const expected = (1 * 24 * 60 * 60 + 9 * 60 * 60) * 1000
		assert.equal(parseDelay('1d 09:00'), expected)
	})

	await t.test('parses day + time with minutes (2d 14:30)', () => {
		const expected = (2 * 24 * 60 * 60 + 14 * 60 * 60 + 30 * 60) * 1000
		assert.equal(parseDelay('2d 14:30'), expected)
	})

	await t.test('parses weekday (Mon 10:00) — returns positive ms', () => {
		const ms = parseDelay('Mon 10:00')
		assert.ok(ms > 0, 'should return a positive delay')
		assert.ok(ms <= 7 * 24 * 60 * 60 * 1000, 'should be within 7 days')
	})

	await t.test('throws on invalid format', () => {
		assert.throws(() => parseDelay('tomorrow'), /Invalid delay format/)
		assert.throws(() => parseDelay('5x'), /Invalid delay format/)
	})
})

// ─── matchesConditions ───────────────────────────────────────

test('matchesConditions - evaluates content against rule conditions', async (t) => {
	await t.test('empty conditions match everything', () => {
		assert.equal(matchesConditions({ text: 'hello' }, {}), true)
		assert.equal(matchesConditions({ text: 'hello' }, undefined), true)
	})

	await t.test('matches tags (any-of)', () => {
		const content = { tags: ['public', 'tech'] }
		assert.equal(matchesConditions(content, { tags: ['public'] }), true)
		assert.equal(matchesConditions(content, { tags: ['private'] }), false)
		assert.equal(matchesConditions(content, { tags: ['tech', 'science'] }), true) // 'tech' matches
	})

	await t.test('matches type', () => {
		assert.equal(matchesConditions({ type: 'post' }, { type: 'post' }), true)
		assert.equal(matchesConditions({ type: 'article' }, { type: 'post' }), false)
	})

	await t.test('matches lang', () => {
		assert.equal(matchesConditions({ lang: 'uk' }, { lang: 'uk' }), true)
		assert.equal(matchesConditions({ lang: 'en' }, { lang: 'uk' }), false)
	})

	await t.test('matches hasMedia', () => {
		assert.equal(matchesConditions({ photo: 'url' }, { hasMedia: true }), true)
		assert.equal(matchesConditions({ text: 'no media' }, { hasMedia: true }), false)
		assert.equal(matchesConditions({ text: 'no media' }, { hasMedia: false }), true)
	})

	await t.test('combines multiple conditions (AND logic)', () => {
		const content = { tags: ['public'], type: 'post', lang: 'uk' }
		assert.equal(matchesConditions(content, { tags: ['public'], lang: 'uk' }), true)
		assert.equal(matchesConditions(content, { tags: ['public'], lang: 'en' }), false)
		assert.equal(matchesConditions(content, { tags: ['private'], type: 'post' }), false)
	})
})

// ─── evaluateRules ───────────────────────────────────────────

test('evaluateRules - matches content to rules and generates tasks', async (t) => {
	const dummy = new DummyAdapter()
	const adapters = new Map([['dummy', dummy]])

	const rules = [
		{
			name: 'Public posts to Dummy',
			if: { tags: ['public'] },
			publish: [{ adapter: 'dummy', delay: 0 }],
		},
		{
			name: 'Ukrainian content with delay',
			if: { lang: 'uk' },
			publish: [{ adapter: 'dummy', delay: '30m', channel: '@ukr_channel' }],
		},
		{
			name: 'Unknown adapter',
			if: {},
			publish: [{ adapter: 'nonexistent', delay: 0 }],
		},
	]

	await t.test('matches the correct rules and generates tasks', () => {
		const content = { text: 'Hello', tags: ['public'], lang: 'en' }
		const tasks = evaluateRules(content, rules, adapters)

		// Should match rule 1 (public tag) and rule 3 (empty conditions) but
		// rule 3 has nonexistent adapter so it should be skipped with a warning.
		assert.equal(tasks.length, 1)
		assert.equal(tasks[0].ruleName, 'Public posts to Dummy')
		assert.equal(tasks[0].delayMs, 0)
	})

	await t.test('matches multiple rules for the same content', () => {
		const content = { text: 'Привіт!', tags: ['public'], lang: 'uk' }
		const tasks = evaluateRules(content, rules, adapters)

		assert.equal(tasks.length, 2)
		assert.equal(tasks[0].ruleName, 'Public posts to Dummy')
		assert.equal(tasks[1].ruleName, 'Ukrainian content with delay')
		assert.equal(tasks[1].delayMs, 30 * 60 * 1000)
		assert.equal(tasks[1].channel, '@ukr_channel')
	})

	await t.test('returns empty array when no rules match', () => {
		const content = { text: 'Secret', tags: ['private'], lang: 'de' }
		const tasks = evaluateRules(content, rules, adapters)
		assert.equal(tasks.length, 0)
	})
})

// ─── executeTasks ────────────────────────────────────────────

test('executeTasks - executes publish tasks with delays', async (t) => {
	await t.test('executes immediate tasks and returns results', async () => {
		const dummy = new DummyAdapter()
		const tasks = [
			{
				adapter: dummy,
				content: { text: 'Immediate post' },
				delayMs: 0,
				ruleName: 'Immediate Rule',
			},
		]

		const results = await executeTasks(tasks)
		assert.equal(results.length, 1)
		assert.ok(results[0].id.startsWith('dummy-post-'))
		assert.equal(results[0].ruleName, 'Immediate Rule')
		assert.equal(results[0].adapter, 'dummy')
	})

	await t.test('executes delayed tasks (capped at 50ms in test mode)', async () => {
		const dummy = new DummyAdapter()
		const tasks = [
			{
				adapter: dummy,
				content: { text: 'Now!' },
				delayMs: 0,
				ruleName: 'Now',
			},
			{
				adapter: dummy,
				content: { text: 'Later!' },
				delayMs: 30 * 60 * 1000, // 30 min, capped to 50ms in executeTasks
				ruleName: 'Later',
			},
		]

		const start = Date.now()
		const results = await executeTasks(tasks)
		const elapsed = Date.now() - start

		assert.equal(results.length, 2)
		assert.equal(results[0].ruleName, 'Now')
		assert.equal(results[1].ruleName, 'Later')
		// Delayed task should have waited ~50ms (not 30 min)
		assert.ok(elapsed < 200, `Expected <200ms but took ${elapsed}ms`)
	})

	await t.test('handles multiple delayed tasks in parallel', async () => {
		const dummy = new DummyAdapter()
		const tasks = [
			{ adapter: dummy, content: { text: 'A' }, delayMs: 1000, ruleName: 'A' },
			{ adapter: dummy, content: { text: 'B' }, delayMs: 2000, ruleName: 'B' },
			{ adapter: dummy, content: { text: 'C' }, delayMs: 3000, ruleName: 'C' },
		]

		const start = Date.now()
		const results = await executeTasks(tasks)
		const elapsed = Date.now() - start

		assert.equal(results.length, 3)
		// All delayed tasks run in parallel, each capped at 50ms
		assert.ok(elapsed < 200, `Expected <200ms but took ${elapsed}ms`)
	})
})
