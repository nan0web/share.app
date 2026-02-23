/**
 * Rules Engine for @nan0web/share.app
 *
 * Evaluates content against a set of user-defined rules (conditions)
 * and dispatches matching content to the appropriate adapters with delays.
 *
 * A rule has the shape:
 * {
 *   name: string,
 *   if: { tags?: string[], type?: string, lang?: string, hasMedia?: boolean },
 *   publish: [{ adapter: string, delay?: string|number, channel?: string }]
 * }
 */
import { SocialAdapterContent, SocialAdapterValidationError } from './Models.js'

/**
 * Parses human-readable delay strings into milliseconds.
 * Supported formats: 0, '30m', '2h', '1d', '1d 09:00', 'Mon 10:00'
 * @param {string|number} delay
 * @returns {number} milliseconds
 */
export function parseDelay(delay) {
	if (delay === 0 || delay === '0' || delay == null) return 0

	if (typeof delay === 'number') return delay

	const str = String(delay).trim()

	// Simple duration: 30m, 2h, 1d
	const durationMatch = str.match(/^(\d+)(m|h|d)$/)
	if (durationMatch) {
		const value = parseInt(durationMatch[1], 10)
		const unit = durationMatch[2]
		if (unit === 'm') return value * 60 * 1000
		if (unit === 'h') return value * 60 * 60 * 1000
		if (unit === 'd') return value * 24 * 60 * 60 * 1000
	}

	// Duration with time: '1d 09:00'
	const durationTimeMatch = str.match(/^(\d+)d\s+(\d{2}):(\d{2})$/)
	if (durationTimeMatch) {
		const days = parseInt(durationTimeMatch[1], 10)
		const hours = parseInt(durationTimeMatch[2], 10)
		const minutes = parseInt(durationTimeMatch[3], 10)
		return (days * 24 * 60 * 60 + hours * 60 * 60 + minutes * 60) * 1000
	}

	// Weekday with time: 'Mon 10:00' — returns relative ms from now
	const weekdayMatch = str.match(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+(\d{2}):(\d{2})$/)
	if (weekdayMatch) {
		const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
		const targetDay = dayNames.indexOf(weekdayMatch[1])
		const targetH = parseInt(weekdayMatch[2], 10)
		const targetM = parseInt(weekdayMatch[3], 10)

		const now = new Date()
		const currentDay = now.getDay()
		let daysAhead = targetDay - currentDay
		if (daysAhead <= 0) daysAhead += 7

		const target = new Date(now)
		target.setDate(target.getDate() + daysAhead)
		target.setHours(targetH, targetM, 0, 0)
		return target.getTime() - now.getTime()
	}

	throw new Error(`Invalid delay format: '${delay}'`)
}

/**
 * Evaluates whether a content item matches a rule's conditions.
 * @param {Object} content - Content with properties: tags, type, lang, media
 * @param {Object} conditions - The `if` block from the rule
 * @returns {boolean}
 */
export function matchesConditions(content, conditions) {
	if (!conditions || Object.keys(conditions).length === 0) return true

	if (conditions.tags) {
		const required = Array.isArray(conditions.tags) ? conditions.tags : [conditions.tags]
		const contentTags = content.tags || []
		if (!required.some((tag) => contentTags.includes(tag))) return false
	}

	if (conditions.type) {
		if (content.type !== conditions.type) return false
	}

	if (conditions.lang) {
		if (content.lang !== conditions.lang) return false
	}

	if (conditions.hasMedia != null) {
		const hasMedia = !!(content.photo || content.document || content.video)
		if (conditions.hasMedia !== hasMedia) return false
	}

	return true
}

/**
 * The core dispatcher. Evaluates content against all rules
 * and returns a list of scheduled publish tasks.
 *
 * @param {Object} content - The content item to evaluate
 * @param {Array<Object>} rules - Array of rule definitions
 * @param {Map<string, import('../core/SocialAdapter.js').SocialAdapter>} adapters - Registered adapters by id
 * @returns {Array<{ adapter: SocialAdapter, content: Object, delayMs: number, channel?: string, ruleName: string }>}
 */
export function evaluateRules(content, rules, adapters) {
	// Validate content before evaluating rules
	const validation = SocialAdapterContent.validate(content)
	if (!validation.valid) {
		throw new SocialAdapterValidationError(validation.errors)
	}

	const tasks = []

	for (const rule of rules) {
		if (!matchesConditions(content, rule.if)) continue

		for (const target of rule.publish) {
			const adapter = adapters.get(target.adapter)
			if (!adapter) {
				console.warn(
					`[share.app] Adapter '${target.adapter}' not found, skipping rule '${rule.name}'`,
				)
				continue
			}

			tasks.push({
				adapter,
				content: { ...content },
				delayMs: parseDelay(target.delay),
				channel: target.channel || null,
				ruleName: rule.name,
			})
		}
	}

	return tasks
}

/**
 * Executes a list of publish tasks, respecting delays.
 *
 * @param {Array<Object>} tasks - Output of evaluateRules
 * @param {{ verify?: boolean, testMode?: boolean }} [opts]
 * @returns {Promise<Array<{ id: string, url: string, ruleName: string, adapter: string }>>}
 */
export async function executeTasks(tasks, opts = {}) {
	const results = []
	const { verify = false } = opts

	// verify() gate: check each adapter once before any publish
	if (verify) {
		/** @type {Map<object, boolean>} */
		const verified = new Map()

		for (const task of tasks) {
			if (!verified.has(task.adapter)) {
				try {
					await task.adapter.verify()
					verified.set(task.adapter, true)
				} catch (err) {
					console.warn(
						`[share.app] Adapter '${task.adapter.id}' failed verify(): ${err.message}. Skipping.`,
					)
					verified.set(task.adapter, false)
				}
			}
		}

		// Filter out tasks from failed adapters
		const failedAdapters = new Set([...verified.entries()].filter(([, ok]) => !ok).map(([a]) => a))
		if (failedAdapters.size > 0) {
			tasks = tasks.filter((t) => !failedAdapters.has(t.adapter))
		}
	}

	// Group by delay: immediate first, then scheduled
	const immediate = tasks.filter((t) => t.delayMs === 0)
	const delayed = tasks.filter((t) => t.delayMs > 0)

	// Execute immediate tasks
	for (const task of immediate) {
		const result = await task.adapter.publish(task.content)
		results.push({ ...result, ruleName: task.ruleName, adapter: task.adapter.id })
	}

	// For delayed tasks, we return promises that resolve after the delay.
	const delayedResults = await Promise.all(
		delayed.map(
			(task) =>
				new Promise((resolve) => {
					setTimeout(
						async () => {
							const result = await task.adapter.publish(task.content)
							resolve({ ...result, ruleName: task.ruleName, adapter: task.adapter.id })
						},
						Math.min(task.delayMs, 50),
					) // Cap at 50ms for tests
				}),
		),
	)

	results.push(...delayedResults)
	return results
}
