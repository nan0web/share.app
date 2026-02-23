import { SocialAdapter } from './SocialAdapter.js'
import { SocialAdapterConfig, createLimits, createFeedback } from './Models.js'

// ─── DummyAdapterConfig ──────────────────────────────────────

export class DummyAdapterConfig extends SocialAdapterConfig {
	static rejectVerify = {
		help: 'If true, verify() will throw — used for testing failure paths.',
		default: false,
	}

	/** @type {boolean} */
	rejectVerify

	constructor(raw = {}) {
		super(raw)
		this.rejectVerify = raw.rejectVerify ?? DummyAdapterConfig.rejectVerify.default
	}
}

// ─── DummyAdapter ────────────────────────────────────────────

/**
 * A perfectly implemented mock adapter used as a reference point (Reference Architecture)
 * and for integration testing the Rules Engine without hitting live APIs.
 *
 * @example
 * const dummy = new DummyAdapter({ account: 'test-author' })
 * await dummy.publish({ text: 'Hello world!', tags: ['public'] })
 */
export class DummyAdapter extends SocialAdapter {
	/** @type {DummyAdapterConfig} */
	config

	/** @type {Map<string, import('./Models.js').SocialAdapterContent>} */
	posts

	/** @type {Map<string, { text: string, replyTo: string, author: string }>} */
	comments

	/**
	 * @param {ConstructorParameters<typeof DummyAdapterConfig>[0]} config
	 */
	constructor(config = {}) {
		super(config)
		this.config = new DummyAdapterConfig(config)
		this.posts = new Map()
		this.comments = new Map()
	}

	get id() {
		return 'dummy'
	}

	get capabilities() {
		return ['media', 'delete', 'reply', 'edit', 'photo', 'document']
	}

	get limits() {
		return createLimits({ maxLength: 280 })
	}

	async verify() {
		if (this.config.rejectVerify) {
			throw new Error('Invalid config: fake rejection triggered.')
		}
		return true
	}

	/**
	 * @param {import('./Models.js').SocialAdapterContent} content
	 * @returns {Promise<import('./Models.js').SocialAdapterPublishResult>}
	 */
	async publish(content) {
		if (content.text && content.text.length > this.limits.maxLength) {
			throw new Error(`Content exceeds max length of ${this.limits.maxLength}`)
		}
		const postId = `dummy-post-${Date.now()}`
		const payload = { ...content, id: postId, publishedAt: new Date() }
		this.posts.set(postId, payload)
		return { id: postId, url: `https://dummy.nan0web.app/posts/${postId}`, payload }
	}

	async delete(postId) {
		if (!this.posts.has(postId)) {
			throw new Error('Post not found on Dummy platform')
		}
		this.posts.delete(postId)
		return true
	}

	/**
	 * @param {string} postId
	 * @returns {Promise<import('./Models.js').SocialAdapterFeedback[]>}
	 */
	async syncFeedback(postId) {
		if (!this.posts.has(postId)) {
			throw new Error('Post not found for feedback sync')
		}
		return [
			createFeedback({
				id: `c-1-${postId}`,
				author: 'Alice Sovereign',
				text: 'This protocol is genius!',
				network: 'dummy',
			}),
			createFeedback({
				id: `c-2-${postId}`,
				author: 'Bob Builder',
				text: 'Where is the code?',
				network: 'dummy',
			}),
		]
	}

	/**
	 * @param {import('./Models.js').SocialAdapterTarget} target
	 * @param {string} text
	 * @returns {Promise<{ id: string }>}
	 */
	async reply(target, text) {
		const commentId = typeof target === 'string' ? target : target.id
		const replyId = `r-${Date.now()}`
		this.comments.set(replyId, {
			text,
			replyTo: commentId,
			author: this.config.account || 'Publisher (Me)',
		})
		return { id: replyId, text }
	}

	/**
	 * @param {string} postId
	 * @param {import('./Models.js').SocialAdapterContent} content
	 * @returns {Promise<import('./Models.js').SocialAdapterPublishResult>}
	 */
	async update(postId, content) {
		if (!this.posts.has(postId)) {
			throw new Error('Post not found on Dummy platform')
		}
		const existing = this.posts.get(postId)
		const updated = { ...existing, ...content, id: postId, updatedAt: new Date() }
		this.posts.set(postId, updated)
		return { id: postId, url: `https://dummy.nan0web.app/posts/${postId}` }
	}
}
