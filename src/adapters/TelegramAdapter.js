import { SocialAdapter } from '../core/SocialAdapter.js'
import { SocialAdapterConfig, createLimits } from '../core/Models.js'

// ─── TelegramAdapterConfig ───────────────────────────────────

export class TelegramAdapterConfig extends SocialAdapterConfig {
	static botToken = {
		help: 'Telegram Bot API token from @BotFather.',
		default: undefined,
	}
	static chatId = {
		help: 'Target channel or chat ID (e.g. "@my_channel" or "-100123456").',
		default: undefined,
	}
	static parseMode = {
		help: 'Message parse mode: "HTML" or "MarkdownV2".',
		default: /** @type {'HTML'|'MarkdownV2'} */ ('HTML'),
	}
	static disableNotification = {
		help: 'If true, messages are sent silently.',
		default: false,
	}

	/** @type {string} */
	botToken
	/** @type {string} */
	chatId
	/** @type {'HTML'|'MarkdownV2'} */
	parseMode
	/** @type {boolean} */
	disableNotification

	/**
	 * @param {{ botToken: string, chatId: string, parseMode?: 'HTML'|'MarkdownV2', disableNotification?: boolean } & Partial<import('../core/Models.js').SocialAdapterConfig>} raw
	 */
	constructor(raw = {}) {
		super(raw)
		if (!raw.botToken) throw new Error('TelegramAdapter requires config.botToken')
		if (!raw.chatId) throw new Error('TelegramAdapter requires config.chatId')
		this.botToken = raw.botToken
		this.chatId = raw.chatId
		this.parseMode = raw.parseMode ?? TelegramAdapterConfig.parseMode.default
		this.disableNotification =
			raw.disableNotification ?? TelegramAdapterConfig.disableNotification.default
	}
}

// ─── TelegramAdapter ─────────────────────────────────────────

/**
 * @nan0web/share-telegram
 *
 * Sovereign Telegram Adapter for share.app and connect.app.
 * Uses the Telegram Bot API to publish content and aggregate feedback.
 */
export class TelegramAdapter extends SocialAdapter {
	/** @type {TelegramAdapterConfig} */
	config

	/** @type {string} */
	#baseUrl

	/**
	 * @param {ConstructorParameters<typeof TelegramAdapterConfig>[0]} config
	 */
	constructor(config = {}) {
		super(config)
		this.config = new TelegramAdapterConfig(config)
		this.#baseUrl = `https://api.telegram.org/bot${this.config.botToken}`
	}

	get id() {
		return 'telegram'
	}

	get capabilities() {
		return ['media', 'delete', 'reply', 'edit', 'photo', 'document', 'video', 'audio']
	}

	get limits() {
		return createLimits({ maxLength: 4096 })
	}

	/**
	 * Low-level HTTP caller for the Telegram Bot API.
	 * Extracted for easy mocking in tests.
	 * @param {string} method - Telegram API method name
	 * @param {Record<string, any>} body - JSON body
	 * @returns {Promise<Record<string, any>>}
	 */
	async _callApi(method, body) {
		const res = await fetch(`${this.#baseUrl}/${method}`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body),
		})
		const data = await res.json()
		if (!data.ok) {
			throw new Error(`Telegram API error: ${data.description || 'Unknown error'}`)
		}
		return data.result
	}

	async verify() {
		const me = await this._callApi('getMe', {})
		return !!me.id
	}

	/**
	 * @param {import('../core/Models.js').SocialAdapterContent} content
	 * @returns {Promise<import('../core/Models.js').SocialAdapterPublishResult>}
	 */
	async publish(content) {
		const { chatId, parseMode, disableNotification } = this.config
		const opts = content.options || {}
		const effectiveParseMode = opts.parseMode ?? parseMode
		const effectiveDisableNotification = opts.disableNotification ?? disableNotification

		let result

		if (content.photo) {
			result = await this._callApi('sendPhoto', {
				chat_id: chatId,
				photo: content.photo,
				caption: content.text || '',
				parse_mode: effectiveParseMode,
				disable_notification: effectiveDisableNotification,
			})
		} else if (content.document) {
			result = await this._callApi('sendDocument', {
				chat_id: chatId,
				document: content.document,
				caption: content.text || '',
				parse_mode: effectiveParseMode,
				disable_notification: effectiveDisableNotification,
			})
		} else {
			if (content.text && content.text.length > this.limits.maxLength) {
				throw new Error(`Content exceeds max length of ${this.limits.maxLength}`)
			}
			result = await this._callApi('sendMessage', {
				chat_id: chatId,
				text: content.text,
				parse_mode: effectiveParseMode,
				disable_notification: effectiveDisableNotification,
			})
		}

		const messageId = String(result.message_id)
		return {
			id: messageId,
			url: `https://t.me/c/${String(chatId).replace(/^-100/, '')}/${messageId}`,
		}
	}

	async delete(postId) {
		await this._callApi('deleteMessage', {
			chat_id: this.config.chatId,
			message_id: Number(postId),
		})
		return true
	}

	async syncFeedback(postId) {
		// Telegram Bot API does not provide a way to fetch comments for a channel post
		// out of the box. In production, this would require a linked Discussion Group
		// and polling getUpdates or a webhook. For now, return empty.
		return []
	}

	/**
	 * @param {import('../core/Models.js').SocialAdapterTarget} target
	 * @param {string} text
	 * @returns {Promise<{ id: string }>}
	 */
	async reply(target, text) {
		const commentId = typeof target === 'string' ? target : target.id
		const result = await this._callApi('sendMessage', {
			chat_id: this.config.chatId,
			text,
			reply_to_message_id: Number(commentId),
			parse_mode: this.config.parseMode,
		})
		return { id: String(result.message_id) }
	}

	/**
	 * @param {string} postId
	 * @param {import('../core/Models.js').SocialAdapterContent} content
	 * @returns {Promise<import('../core/Models.js').SocialAdapterPublishResult>}
	 */
	async update(postId, content) {
		const { chatId, parseMode } = this.config
		const messageId = Number(postId)

		if (content.photo) {
			await this._callApi('editMessageCaption', {
				chat_id: chatId,
				message_id: messageId,
				caption: content.text || '',
				parse_mode: parseMode,
			})
		} else {
			await this._callApi('editMessageText', {
				chat_id: chatId,
				message_id: messageId,
				text: content.text,
				parse_mode: parseMode,
			})
		}

		return {
			id: postId,
			url: `https://t.me/c/${String(chatId).replace(/^-100/, '')}/${postId}`,
		}
	}
}
