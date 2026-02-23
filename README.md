# @nan0web/share.app

> **Sovereign Social Distribution Layer** — Rules Engine для автоматичного публікування контенту в соціальних мережах.

Автор налаштовує правила один раз. Далі `share.app` сам публікує новий контент у потрібні платформи з потрібною затримкою.

---

## Quick Start (3 рядки)

```js
import { DummyAdapter, evaluateRules, executeTasks } from '@nan0web/share.app'

const adapters = new Map([['dummy', new DummyAdapter({ account: 'me' })]])

const rules = [
  { name: 'All public posts', if: { tags: ['public'] }, publish: [{ adapter: 'dummy', delay: 0 }] },
]

const content = { text: 'Hello Sovereign World!', tags: ['public'], type: 'post', lang: 'uk' }

const tasks = evaluateRules(content, rules, adapters)
const results = await executeTasks(tasks)
// → [{ id: 'dummy-post-...', url: 'https://dummy.nan0web.app/posts/...' }]
```

---

## Architecture

```
Content (post / article / announcement)
    │
    ▼
Rules Engine (evaluateRules)
    │  matches conditions (tags, type, lang, hasMedia)
    │  parses delay (0, '30m', '2h', '1d 09:00', 'Mon 10:00')
    ▼
Tasks [ { adapter, content, delayMs } ]
    │
    ▼
executeTasks → immediate tasks run now
             → delayed tasks via setTimeout (dev) / Queue (prod)
    │
    ▼
SocialAdapter.publish(content) → { id, url }
```

---

## Core Modules

### `SocialAdapter` — Base Protocol

```js
import { SocialAdapter } from '@nan0web/share.app'

class MyAdapter extends SocialAdapter {
  get id() {
    return 'my-platform'
  }
  get capabilities() {
    return ['media', 'delete', 'reply']
  }
  get limits() {
    return createLimits({ maxLength: 500 })
  }
  async verify() {
    /* check credentials */ return true
  }
  async publish(content) {
    /* ... */ return { id, url }
  }
  async delete(postId) {
    /* ... */ return true
  }
  async syncFeedback(postId) {
    /* ... */ return [SocialAdapterFeedback]
  }
  async reply(target, text) {
    /* ... */ return { id }
  }
}
```

### `RulesEngine`

```js
import { evaluateRules, executeTasks, parseDelay } from '@nan0web/share.app'

// Parse delays
parseDelay('30m') // → 1_800_000ms
parseDelay('2h') // → 7_200_000ms
parseDelay('1d 09:00') // → ms until tomorrow 09:00
parseDelay('Mon 10:00') // → ms until next Monday 10:00
```

### `Models` — Typed Schemas

```js
import {
  SocialAdapterConfig,
  SocialAdapterFeedback,
  TelegramAdapterConfig,
} from '@nan0web/share.app'

// Every model: instanceof check, toJSON(), static field.help/default
const config = new TelegramAdapterConfig({ botToken: 'abc', chatId: '@ch' })
config instanceof SocialAdapterConfig // true
config.toJSON() // { botToken, chatId, parseMode, disableNotification, ... }

// Auto-documentation:
TelegramAdapterConfig.botToken.help // 'Telegram Bot API token from @BotFather.'
TelegramAdapterConfig.parseMode.default // 'HTML'
```

---

## Available Adapters

| Adapter              | Platform                   | Status    |
| -------------------- | -------------------------- | --------- |
| `DummyAdapter`       | In-memory (test/reference) | ✅ v1.0.0 |
| `TelegramAdapter`    | Telegram Bot API           | ✅ v1.0.0 |
| `@nan0web/share-rss` | RSS Feed                   | 🔜 v1.1.0 |
| `@nan0web/share-x`   | X (Twitter) API            | 🔜 v1.2.0 |

---

## Rule Schema

```yaml
# YAML config (planned — currently pass as JS objects)
rules:
  - name: Public posts to Telegram
    if:
      tags: [public]
      lang: uk
    publish:
      - adapter: telegram
        delay: 0
      - adapter: telegram
        delay: 1d 09:00 # next day at 09:00

  - name: Articles to all platforms (delayed)
    if:
      type: article
    publish:
      - adapter: telegram
        delay: 30m
```

---

## Tests

```bash
npm test              # unit tests (96 specs)
npm run test:integration   # E2E (6 integration scenarios)
npm run test:all      # all 103 tests
```

---

## Capabilities Token Reference

| Token                                    | Meaning                               |
| ---------------------------------------- | ------------------------------------- |
| `media`                                  | Platform accepts photo/video/document |
| `delete`                                 | Platform allows deleting posts        |
| `reply`                                  | Platform supports native replies      |
| `threads`                                | Platform supports threaded posts      |
| `photo` / `video` / `document` / `audio` | Specific media types                  |

```js
adapter.can('media') // true / false
adapter.can('delete') // true / false
```

---

## What's Next (v1.1.0)

- `update(postId, content)` — edit published posts
- `verify()` as gate before publish in RulesEngine
- Content validation on `evaluateRules` input
- `Model.describe()` for auto-documentation generation
- RSS adapter (`@nan0web/share-rss`)

---

_Part of the [nan•web](https://github.com/nan0web) Sovereign Digital State ecosystem._
