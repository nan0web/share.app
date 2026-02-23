import { createConfig, createLimits } from './Models.js'

export class NotImplementedError extends Error {
	constructor(method) {
		super(`Method '${method}' must be implemented by the adapter`)
		this.name = 'NotImplementedError'
	}
}

/**
 * The base protocol that every Sovereign Social Distribution Adapter must implement.
 * Unifies API and Playwright based platforms under a single interface.
 */
export class SocialAdapter {
	/** @type {import('./Models.js').SocialAdapterConfig} */
	config

	/**
	 * @param {import('./Models.js').SocialAdapterConfig} config
	 */
	constructor(config = {}) {
		this.config = createConfig(config)
	}

	/**
	 * The unique identifier for this adapter (e.g. 'telegram', 'facebook', 'dummy').
	 * @returns {string}
	 */
	get id() {
		throw new NotImplementedError('get id')
	}

	/**
	 * Array of capability tokens describing what this platform supports.
	 * Standard tokens: 'media', 'delete', 'reply', 'threads', 'photo', 'video', 'document', 'audio'
	 * @returns {import('./Models.js').SocialAdapterCapabilities}
	 */
	get capabilities() {
		return []
	}

	/**
	 * Platform-specific numeric limits.
	 * @returns {import('./Models.js').SocialAdapterLimits}
	 */
	get limits() {
		return createLimits()
	}

	/**
	 * @param {string} cap - Capability token to check
	 * @returns {boolean}
	 */
	can(cap) {
		return this.capabilities.includes(cap)
	}

	/**
	 * Verifies the connection to the platform using the provided config.
	 * Should throw an error if validation fails.
	 * @returns {Promise<boolean>}
	 */
	async verify() {
		throw new NotImplementedError('verify')
	}

	/**
	 * Publishes new content to the platform.
	 * Content options (parseMode, disableNotification, etc.) are part of `content.options`.
	 *
	 * @param {import('./Models.js').SocialAdapterContent} content
	 * @returns {Promise<import('./Models.js').SocialAdapterPublishResult>}
	 */
	async publish(content) {
		throw new NotImplementedError('publish')
	}

	/**
	 * Rollback or delete a published post if supported by the platform.
	 * @param {string} postId - The underlying platform's post ID.
	 * @returns {Promise<boolean>}
	 */
	async delete(postId) {
		if (!this.can('delete')) {
			throw new Error(`Adapter '${this.constructor.name}' does not support deleting posts.`)
		}
		throw new NotImplementedError('delete')
	}

	/**
	 * Fetches new feedback (comments, likes) for a given post.
	 * Used by connect.app to aggregate reactions.
	 *
	 * @param {string} postId
	 * @returns {Promise<import('./Models.js').SocialAdapterFeedback[]>}
	 */
	async syncFeedback(postId) {
		throw new NotImplementedError('syncFeedback')
	}

	/**
	 * Replies to a specific comment natively on the platform.
	 * The target contains both the comment ID and the network identifier,
	 * enabling multi-account scenarios where different accounts reply on different networks.
	 *
	 * @param {import('./Models.js').SocialAdapterTarget} target - Identifies the comment and network
	 * @param {string} text - Reply text
	 * @returns {Promise<{ id: string }>}
	 */
	async reply(target, text) {
		if (!this.can('reply')) {
			throw new Error(`Adapter '${this.constructor.name}' does not support replying.`)
		}
		throw new NotImplementedError('reply')
	}
}
