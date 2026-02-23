# 🎯 Release v1.0.0

## Goal

The first release (`v1.0.0`) of `@nan0web/share.app` establishes the immutable **Core Adapter Protocol**. This protocol guarantees that any adapter (whether API-driven or Playwright-driven) provides a unified experience for `share.app` (publishing) and `connect.app` (aggregating feedback).

We must hit full test coverage for the core protocol before implementing specific platform connectors.

---

## 🛠️ Scope of v1.0.0

### 1. The Core Adapter API (`src/core/SocialAdapter.js`)

All platforms must implement a standardized interface.

- `id`: Unique identifier (e.g., `facebook`, `telegram`).
- `capabilities()`: Returns limits configuration (e.g., `maxLength`, `supportsMedia`, `supportsThreads`).
- `verify()`: Test connection / Auth state. If it throws, the adapter is disconnected.
- `publish(content)`: The primary publishing method. Must return a standardized `PostId` and URL.
- `delete(postId)`: (Optional based on caps) Rollback/Delete a post.
- `syncFeedback(postId)`: (For `connect.app`) Fetches new comments, likes, and shares since the last sync.
- `reply(commentId, text)`: (For `connect.app`) Posts a native reply to a specific comment.

### 2. The Verification Suite (TDD)

- The core protocol must come with a rigorous set of unit tests (`.spec.js`) to guarantee that any subclass strictly adheres to the return types and input validations.
- **Rules evaluation logic.** `share.app` tests should evaluate mock rules (`if: tags includes public`) against mock content and ensure the correct mock adapters are triggered.

### 3. The Dummy Adapter (Golden Standard)

- Implement `@nan0web/share-dummy` (in-memory simulator) which perfectly implements the protocol to be used as a reference point for future contributors.

### 4. Integration with UI

- (Optional for v1.0.0 core, but needed for ecosystem) The configuration schema validator.

---

## Definition of Done

- `SocialAdapter.js` created and documented (JSDoc).
- 100% passing tests for the abstract class validation.
- A functional "Dummy" adapter passes the test suite.
- Architecture workflows are completely respected (fractal intent registry).
