/**
 * @nan0web/share.app — Sovereign Social Distribution Layer
 *
 * Public API surface for the share.app engine.
 */

// Models (real classes with schema introspection)
export {
	Model,
	SocialAdapterConfig,
	SocialAdapterLimits,
	SocialAdapterContent,
	SocialAdapterFeedback,
	SocialAdapterTarget,
	SocialAdapterValidationError,
	createConfig,
	createLimits,
	createContent,
	createFeedback,
	createTarget,
} from './core/Models.js'

// Core Protocol
export { SocialAdapter, NotImplementedError } from './core/SocialAdapter.js'
export { DummyAdapter } from './core/DummyAdapter.js'

// Rules Engine
export { parseDelay, matchesConditions, evaluateRules, executeTasks } from './core/RulesEngine.js'

// Adapters
export { TelegramAdapter } from './adapters/TelegramAdapter.js'
