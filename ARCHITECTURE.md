# 📡 @nan0web/share.app

The **Sovereign Social Distribution Layer**.

This is the central application that runs the Social Publishing Rules Engine. It reads content from designated Data Verse folders or external RSS feeds, evaluates them against author-defined conditions, respects configured delays, and publishes to external platforms via modular adapters.

---

## 🏗️ 1. Core Structure & UIs

The app must be capable of running independently (`standalone`) and provides two primary interfaces to control the daemon:

### 1.1. Web UI (`ui-lit` / `ui-web-lit`)

The visual dashboard that can be accessed when the app runs as a standalone Node.js server or Docker container.

- **Log Viewer**: Live streaming of publishing logs (who published what, error traces, delay queue status).
- **Rule Configuration**: Visual editor for the `share.config.yaml` to set conditions, delays, targets.
- **Adapter Management**: A view to browse available installed adapters, configure tokens/API keys for each, and install new ones.

### 1.2. CLI UI (`ui-cli`)

The terminal interface for server administrators or local desktop usage.

- **Log Tail**: e.g., `share logs --tail` to watch exactly what the platform watches.
- **Config Editor**: Direct manipulation of the rules file with linting.
- **Adapter CLI**: Commands to install plugins (e.g., `share adapter add @nan0web/share-instagram`).

---

## 🔌 2. Adapter Ecosystem

Adapters are modular plugins. Rather than creating a standalone `share` vendor at the root, **the foundational adapters belong to the `@nan0web` domain** (just like the core app).

### Naming Convention

- Core App: `@nan0web/share.app` (located in `apps/@/nan0web/share.app`)
- Core Adapters: `@nan0web/share-telegram`, `@nan0web/share-x`, `@nan0web/share-linkedin`, etc.

**Other vendors or third parties** can create their own adapters (e.g., `@industrialbank/share-internal-api`) which the user can simply `npm install` and register in the UI or CLI.

---

## ⚙️ 3. Execution Model

1. **Daemon Mode**: The core engine runs continuously (e.g. as a Docker container).
2. **Scanner**: It polls or watches configured sources (RSS feeds, local YAML/MD folders).
3. **Queue**: matched rules with a `delay` (e.g., `delay: 2h`) go into a persistence queue (e.g. Redis or SQLite).
4. **Dispatcher**: Dispatches payloads to specific Adapters when the condition and timer are met.
