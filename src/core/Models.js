/**
 * Typed models for the @nan0web/share.app Sovereign Social Distribution Protocol.
 * Every model is a real class: validates input, serializable, introspectable for auto-docs.
 */

// ─── Base Model ──────────────────────────────────────────────

/**
 * Base class for all share.app models.
 * Provides serialization and instantiation from inputs.
 */
export class Model {
	/**
	 * Instantiates a model from raw data, parsing strings as JSON.
	 * @param {any} data
	 * @returns {any}
	 */
	static from(data) {
		let parsed = data
		if (typeof data === 'string') {
			try {
				parsed = JSON.parse(data)
			} catch (err) {
				parsed = {}
			}
		}
		// @ts-ignore
		return new this(parsed)
	}

	/**
	 * Returns a plain object representation for serialization.
	 * @returns {Record<string, any>}
	 */
	toJSON() {
		return { ...this }
	}

	/**
	 * Returns auto-documentation for all declared static field definitions.
	 * Walks up the prototype chain to include inherited fields.
	 * @returns {Array<{ field: string, help: string, default: any }>}
	 */
	static describe() {
		const result = []
		const seen = new Set()
		let proto = this

		while (proto && proto !== Function.prototype) {
			for (const key of Object.getOwnPropertyNames(proto)) {
				if (seen.has(key)) continue
				seen.add(key)
				if (key === 'length' || key === 'prototype' || key === 'name') continue
				const val = proto[key]
				if (val && typeof val === 'object' && 'help' in val && 'default' in val) {
					result.unshift({ field: key, help: val.help, default: val.default })
				}
			}
			proto = Object.getPrototypeOf(proto)
		}

		return result
	}
}

// ─── SocialAdapterConfig ─────────────────────────────────────

export class SocialAdapterConfig extends Model {
	static id = {
		help: 'Unique identifier of the adapter.',
		default: undefined,
	}
	static account = {
		help: 'Account identifier (for multi-account support).',
		default: undefined,
	}
	static credentials = {
		help: 'Key-value store for API tokens, passwords, etc.',
		default: {},
	}

	/** @type {string|undefined} */
	id
	/** @type {string|undefined} */
	account
	/** @type {Record<string, string>} */
	credentials

	constructor(raw = {}) {
		super()
		this.id = raw.id ?? SocialAdapterConfig.id.default
		this.account = raw.account ?? SocialAdapterConfig.account.default
		this.credentials = raw.credentials ?? SocialAdapterConfig.credentials.default
	}
}

/**
 * @param {Partial<SocialAdapterConfig>} raw
 * @returns {SocialAdapterConfig}
 */
export function createConfig(raw = {}) {
	return SocialAdapterConfig.from(raw)
}

// ─── SocialAdapterLimits ─────────────────────────────────────

export class SocialAdapterLimits extends Model {
	static maxLength = {
		help: 'Maximum text length per post (Infinity = unlimited)',
		default: Infinity,
	}

	/** @type {number} */
	maxLength

	constructor(raw = {}) {
		super()
		this.maxLength = raw.maxLength ?? SocialAdapterLimits.maxLength.default
	}
}

/**
 * @param {Partial<SocialAdapterLimits>} [overrides]
 * @returns {SocialAdapterLimits}
 */
export function createLimits(overrides = {}) {
	return SocialAdapterLimits.from(overrides)
}

// ─── SocialAdapterCapabilities ───────────────────────────────

/**
 * Capabilities are a flat string array describing what a platform supports.
 * Standard tokens: 'media', 'delete', 'reply', 'threads', 'photo', 'video', 'document', 'audio'
 * @typedef {string[]} SocialAdapterCapabilities
 */

// ─── SocialAdapterContent ────────────────────────────────────

export class SocialAdapterContent extends Model {
	static text = { help: 'The main text body of the post', default: undefined }
	static photo = { help: 'URL or file path to a photo', default: undefined }
	static video = { help: 'URL or file path to a video', default: undefined }
	static document = { help: 'URL or file path to a document/file', default: undefined }
	static audio = { help: 'URL or file path to audio', default: undefined }
	static tags = { help: 'Content tags for rule matching', default: [] }
	static type = { help: 'Content type (e.g. post, article, announcement)', default: undefined }
	static lang = { help: 'Content language code (e.g. uk, en)', default: undefined }
	static options = { help: 'Publishing options', default: {} }

	/** @type {string|undefined} */
	text
	/** @type {string|undefined} */
	photo
	/** @type {string|undefined} */
	video
	/** @type {string|undefined} */
	document
	/** @type {string|undefined} */
	audio
	/** @type {string[]} */
	tags
	/** @type {string|undefined} */
	type
	/** @type {string|undefined} */
	lang
	/** @type {SocialAdapterContentOptions} */
	options

	constructor(raw = {}) {
		super()
		this.text = raw.text ?? SocialAdapterContent.text.default
		this.photo = raw.photo ?? SocialAdapterContent.photo.default
		this.video = raw.video ?? SocialAdapterContent.video.default
		this.document = raw.document ?? SocialAdapterContent.document.default
		this.audio = raw.audio ?? SocialAdapterContent.audio.default
		this.tags = raw.tags ?? SocialAdapterContent.tags.default
		this.type = raw.type ?? SocialAdapterContent.type.default
		this.lang = raw.lang ?? SocialAdapterContent.lang.default
		this.options = raw.options ?? SocialAdapterContent.options.default
	}

	/**
	 * Validates raw content before publishing.
	 * Content must have at least text OR one media field.
	 * @param {Partial<SocialAdapterContent>} raw
	 * @returns {{ valid: boolean, errors: string[] }}
	 */
	static validate(raw = {}) {
		const errors = []
		const hasText = raw.text && raw.text.trim().length > 0
		const hasMedia = !!(raw.photo || raw.video || raw.document || raw.audio)

		if (!hasText && !hasMedia) {
			errors.push(
				'content must have at least text or one media field (photo, video, document, audio)',
			)
		}

		return { valid: errors.length === 0, errors }
	}
}

/**
 * Validation error thrown when content fails schema checks.
 */
export class SocialAdapterValidationError extends Error {
	/** @type {string[]} */
	errors

	/**
	 * @param {string[]} errors
	 */
	constructor(errors = []) {
		super(`Content validation failed: ${errors.join('; ')}`)
		this.name = 'SocialAdapterValidationError'
		this.errors = errors
	}
}

/**
 * @typedef {Object} SocialAdapterContentOptions
 * @property {string} [parseMode]
 * @property {boolean} [disableNotification]
 * @property {boolean} [disablePreview]
 * @property {string} [threadId]
 */

/**
 * @param {Partial<SocialAdapterContent>} raw
 * @returns {SocialAdapterContent}
 */
export function createContent(raw = {}) {
	return SocialAdapterContent.from(raw)
}

// ─── SocialAdapterFeedback ───────────────────────────────────

export class SocialAdapterFeedback extends Model {
	static id = { help: 'Platform-specific comment/reaction ID', default: '' }
	static author = { help: 'Display name of the commenter', default: 'Unknown' }
	static authorId = { help: 'Unique ID of the author on the platform', default: undefined }
	static authorAvatar = { help: 'URL to the author avatar', default: undefined }
	static text = { help: 'Comment text content', default: '' }
	static type = { help: 'Feedback type', default: 'comment' }
	static createdAt = { help: 'Timestamp of the feedback', default: () => new Date() }
	static network = { help: 'Source network ID (e.g. telegram, facebook)', default: 'unknown' }

	/** @type {string} */
	id
	/** @type {string} */
	author
	/** @type {string|undefined} */
	authorId
	/** @type {string|undefined} */
	authorAvatar
	/** @type {string} */
	text
	/** @type {'comment'|'like'|'share'|'reaction'} */
	type
	/** @type {Date|string} */
	createdAt
	/** @type {string} */
	network

	constructor(raw = {}) {
		super()
		this.id = raw.id ?? SocialAdapterFeedback.id.default
		this.author = raw.author ?? SocialAdapterFeedback.author.default
		this.authorId = raw.authorId ?? SocialAdapterFeedback.authorId.default
		this.authorAvatar = raw.authorAvatar ?? SocialAdapterFeedback.authorAvatar.default
		this.text = raw.text ?? SocialAdapterFeedback.text.default
		this.type = raw.type ?? SocialAdapterFeedback.type.default
		this.network = raw.network ?? SocialAdapterFeedback.network.default
		this.createdAt = raw.createdAt ?? SocialAdapterFeedback.createdAt.default()
	}
}

/**
 * @param {Partial<SocialAdapterFeedback>} raw
 * @returns {SocialAdapterFeedback}
 */
export function createFeedback(raw = {}) {
	return SocialAdapterFeedback.from(raw)
}

// ─── SocialAdapterTarget ─────────────────────────────────────

export class SocialAdapterTarget extends Model {
	static id = { help: 'Platform-specific comment ID', default: '' }
	static network = { help: 'Source network ID (e.g. telegram, facebook)', default: 'unknown' }
	static account = {
		help: 'Which account to reply from (for multi-account setups)',
		default: undefined,
	}
	static postId = { help: 'The parent post ID (for context)', default: undefined }

	/** @type {string} */
	id
	/** @type {string} */
	network
	/** @type {string|undefined} */
	account
	/** @type {string|undefined} */
	postId

	constructor(raw = {}) {
		super()
		this.id = raw.id ?? SocialAdapterTarget.id.default
		this.network = raw.network ?? SocialAdapterTarget.network.default
		this.account = raw.account ?? SocialAdapterTarget.account.default
		this.postId = raw.postId ?? SocialAdapterTarget.postId.default
	}
}

/**
 * @param {Partial<SocialAdapterTarget>} raw
 * @returns {SocialAdapterTarget}
 */
export function createTarget(raw = {}) {
	return SocialAdapterTarget.from(raw)
}
