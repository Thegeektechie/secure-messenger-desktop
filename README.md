---

# Secure Messenger Desktop

**Chat List + Sync Simulator**

## Overview

This project is a desktop application that simulates the core internals of a secure messaging client. The emphasis is not on visual polish or real encryption, but on **architecture, data discipline, and real time behavior under load**.

I built this as a focused engineering exercise to demonstrate how a desktop messenger can remain responsive while handling large local datasets, continuous message ingestion, and unstable network conditions.

The scope was intentionally constrained so that each subsystem could be designed cleanly and reasoned about under time pressure.

---

## Core Goals

The application focuses on five practical concerns that matter in real world messaging systems:

* Efficient local data access using SQLite
* Near real time synchronization using WebSockets
* UI performance with large chat and message lists
* Clear separation of responsibilities across layers
* Security hygiene through explicit boundaries

---

## Architecture Overview

The system is split into four clearly defined layers.

### 1. Electron Main Process

The Electron main process owns everything that should **never be exposed directly to the UI**.

Responsibilities include:

* SQLite database initialization and access
* Hosting the local WebSocket sync server
* IPC boundaries for safe communication with the renderer

All database reads and writes happen outside React. The UI never touches SQLite directly.

---

### 2. Local Database Layer (SQLite)

SQLite is used as the single source of truth for chats and messages.

#### Schema

* `chats`

  * `id`
  * `title`
  * `lastMessageAt`
  * `unreadCount`

* `messages`

  * `id`
  * `chatId`
  * `ts`
  * `sender`
  * `body`

#### Design Decisions

* Queries are **paginated at the database level**
* Sorting is done in SQL, not JavaScript
* Messages are fetched incrementally to avoid memory pressure
* Seed data generation simulates real load conditions with hundreds of chats and tens of thousands of messages

This mirrors how production messaging clients avoid loading entire histories into memory.

---

### 3. WebSocket Sync Simulator

To simulate real time behavior, the app includes an internal WebSocket server.

#### Behavior

* Emits a new message event every one to three seconds
* Randomly selects a chat
* Sends a structured message payload

The client:

* Listens for events
* Persists messages to SQLite
* Updates chat metadata such as last activity and unread counts
* Triggers UI refreshes through state updates

This setup allowed me to validate UI stability under continuous writes without introducing external infrastructure.

---

### 4. React Renderer (UI)

The renderer is a React and TypeScript application focused on **predictable state and performance**.

#### Layout

* Left pane: Chat list
* Right pane: Message view for the selected chat

#### Performance Strategy

* Chat list is virtualized to handle hundreds of items smoothly
* Message list supports incremental loading
* No full table scans in JavaScript
* State reflects only what is currently visible

Redux Toolkit is used for state management to keep side effects explicit and traceable.

---

## Connection Health Handling

The application treats connectivity as unreliable by default.

Implemented behaviors include:

* Connection state indicator: Connected, Reconnecting, Offline
* Periodic heartbeat to detect stale connections
* Exponential backoff on reconnect attempts
* Manual simulation of connection drops for testing recovery logic

This ensures the UI remains honest about system state rather than assuming ideal conditions.

---

## Security Hygiene

No real encryption is implemented by design, but **secure thinking is enforced structurally**.

### Security Boundaries

* A dedicated `SecurityService` module defines placeholder `encrypt` and `decrypt` functions
* Message bodies are never logged to the console
* Database access is isolated from the UI
* The renderer treats all incoming data as untrusted

### In a Real System

With more time, encryption would be applied:

* Before persistence to disk
* Before IPC transmission
* With strict controls on logging, crash dumps, and developer tools exposure

The current structure ensures these upgrades could be introduced without refactoring core logic.

---

## Trade Offs and Constraints

Given limited time, I made several conscious trade offs:

* UI polish was kept minimal to prioritize correctness
* Encryption is represented by boundaries, not implementations
* Cross process IPC abstractions are lean rather than generalized
* Testing is manual and scenario driven rather than automated

These choices allowed the system to remain coherent without overengineering.

---

## What I Would Improve With More Time

* Strongly typed IPC contracts with validation
* Background message indexing for faster search
* End to end tests for sync recovery scenarios
* Encrypted at rest message storage
* Smarter unread count reconciliation across reconnects

---

## Running the Project

### Install dependencies

```bash
pnpm install
```

### Start the app

```bash
pnpm dev
```

The application runs as a desktop Electron app and initializes its local database automatically on first launch.

---

## Final Notes

This project is not meant to be a feature complete messenger. It is a **systems focused exercise** demonstrating how performance, data safety, and real time behavior can coexist in a desktop environment when architecture is treated as a first class concern.

Everything here was built deliberately, under time pressure, with clarity as the priority.

---

