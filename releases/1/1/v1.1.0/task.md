# 🎯 Release v1.1.0

## Goal

v1.1.0 closes the gaps identified by the Council of Sages during v1.0.0 review.
The focus is **protocol completeness** and **production safety**:

- Full CRUD for posts (`update` joins `publish` + `delete`)
- `verify()` as a mandatory gate before any publish
- Content validation at the Rules Engine boundary
- Auto-documentation via `Model.describe()`

---

## 🛠️ Scope of v1.1.0

### 1. `update(postId, content)` — Edit Protocol

**Motivation (Леонардо да Вінчі):** Protocol is asymmetric without update. Platforms that support editing (Telegram, Facebook) require it for corrections, translations, scheduled content refresh.

```js
// SocialAdapter contract:
async update(postId, content) → { id, url }

// capabilities token:
'edit'

// DummyAdapter: updates in-memory store
// TelegramAdapter: calls editMessageText / editMessageCaption
```

### 2. `verify()` as Gate in `executeTasks`

**Motivation (Макіавелі):** A misconfigured adapter silently fails in production. `verify()` must be called before the first publish per session.

```js
// RulesEngine.executeTasks behavior:
// - calls adapter.verify() before first publish
// - caches verification result per adapter (avoid repeated calls)
// - if verify() throws → marks adapter as failed, skips its tasks, logs warning
```

### 3. Content Validation

**Motivation (Іван Сірко):** Garbage in, garbage out. The engine must reject malformed content early — before rules are evaluated.

```js
// New: SocialAdapterContent.validate(content) → { valid: boolean, errors: string[] }
// RulesEngine.evaluateRules() calls validate() first
// Invalid content → throws SocialAdapterValidationError with field errors
```

### 4. `Model.describe()` — Auto-Documentation

**Motivation (Сковорода):** Static `.help`/`.default` fields exist but are never consumed. `describe()` makes the schema machine-readable for CLI help, docs sites, and future OpenAPI generation.

```js
SocialAdapterConfig.describe()
// → [
//   { field: 'id',          help: '...', default: undefined, type: 'string?' },
//   { field: 'account',     help: '...', default: undefined, type: 'string?' },
//   { field: 'credentials', help: '...', default: {},        type: 'object'  },
// ]

TelegramAdapterConfig.describe()
// → [...SocialAdapterConfig.describe(), { field: 'botToken', ... }, ...]
```

---

## Definition of Done

- [ ] `SocialAdapter.update()` — abstract method with `'edit'` capability check
- [ ] `DummyAdapter.update()` — in-memory implementation + test
- [ ] `TelegramAdapter.update()` — `editMessageText` / `editMessageCaption` + test
- [ ] `executeTasks` — verify() gate with per-adapter cache + test
- [ ] `SocialAdapterContent.validate()` — field validation + `SocialAdapterValidationError`
- [ ] `evaluateRules` — calls `validate()` before processing
- [ ] `Model.describe()` — static introspection method on base class
- [ ] All new tests pass: `pnpm test:all` → 0 failures
- [ ] v1.1.0 E2E integration test in `src/test/releases/v1.1.0.test.js`

---

## TDD Order

```
Red → Green → Refactor

1. SocialAdapter.update() — write spec first
2. DummyAdapter.update() — make it pass
3. TelegramAdapter.update() — make it pass
4. executeTasks verify gate — spec then implement
5. SocialAdapterContent.validate() — spec then implement
6. evaluateRules validation — spec then implement
7. Model.describe() — spec then implement
8. v1.1.0.test.js — E2E covering all new features
```
