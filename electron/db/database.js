/**
 * DATABASE MODULE (SQLite)
 * 
 * Purpose: Handle all database operations with proper schema design,
 * efficient queries, and connection management.
 * 
 * Design Principles:
 * - Single responsibility: Only database operations
 * - Query optimization: Use indexes, pagination, proper WHERE clauses
 * - No data loading into memory: All filtering/sorting done at database level
 * - Error handling: Comprehensive error messages for debugging
 * 
 * Tech Stack: better-sqlite3 (synchronous, performance-optimized for Electron)
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { logger } = require('./security/logger');

// Database path - store in app data directory
const dbPath = path.join(process.env.APPDATA || process.env.HOME, '.secure-messenger', 'app.db');

// Ensure directory exists
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

let db = null;

/**
 * INITIALIZE DATABASE
 * 
 * Creates database connection and sets up schema if needed.
 * Schema includes two main tables:
 * 
 * 1. chats table
 *    - id: unique identifier (UUID)
 *    - title: chat name/title
 *    - lastMessageAt: timestamp of most recent message (for sorting)
 *    - unreadCount: number of unread messages in this chat
 * 
 * 2. messages table
 *    - id: unique message identifier (UUID)
 *    - chatId: foreign key to chats table
 *    - ts: message timestamp (Unix milliseconds)
 *    - sender: who sent the message (simulated sender ID)
 *    - body: message content (encrypted in real app)
 * 
 * Indexes optimize common queries:
 * - idx_messages_chatId: Fast message lookup by chat
 * - idx_chats_lastMessageAt: Fast sorted chat list retrieval
 * - idx_messages_ts: Fast message ordering
 */
async function initializeDatabase() {
  return new Promise((resolve, reject) => {
    try {
      db = new Database(dbPath);
      
      // Enable foreign keys for referential integrity
      db.pragma('foreign_keys = ON');
      
      logger.info(`Database opened at: ${dbPath}`);

      // Create chats table
      db.exec(`
        CREATE TABLE IF NOT EXISTS chats (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          lastMessageAt INTEGER NOT NULL,
          unreadCount INTEGER DEFAULT 0
        )
      `);

      // Create messages table
      db.exec(`
        CREATE TABLE IF NOT EXISTS messages (
          id TEXT PRIMARY KEY,
          chatId TEXT NOT NULL,
          ts INTEGER NOT NULL,
          sender TEXT NOT NULL,
          body TEXT NOT NULL,
          FOREIGN KEY(chatId) REFERENCES chats(id) ON DELETE CASCADE
        )
      `);

      // Create indexes for optimized queries
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_messages_chatId ON messages(chatId);
        CREATE INDEX IF NOT EXISTS idx_chats_lastMessageAt ON chats(lastMessageAt DESC);
        CREATE INDEX IF NOT EXISTS idx_messages_ts ON messages(ts DESC);
      `);

      // Check if database is already seeded
      const chatCount = db.prepare('SELECT COUNT(*) as count FROM chats').get();
      
      if (chatCount.count === 0) {
        seedDatabase();
      }

      logger.info('Database schema initialized successfully');
      resolve();
    } catch (error) {
      logger.error(`Database initialization failed: ${error.message}`);
      reject(error);
    }
  });
}

/**
 * SEED DATABASE
 * 
 * Generate realistic test data:
 * - 200 chats with various names
 * - 20,000+ messages distributed across chats
 * - Realistic timestamps (recent messages have higher timestamps)
 * 
 * This simulates a real messaging app with reasonable data volume
 * for testing performance and pagination.
 */
function seedDatabase() {
  const { v4: uuid } = require('uuid');
  
  const senders = ['user_001', 'user_002', 'user_003', 'contact_a', 'contact_b'];
  const chatNames = Array.from({ length: 200 }, (_, i) => `Chat ${i + 1}`);
  const sampleMessages = [
    'Hey, how are you?',
    'That sounds great!',
    'Let me check that for you',
    'I agree, let\'s move forward',
    'When can you meet?',
    'Sounds good to me',
    'I\'ll send you the details',
    'Thanks for the update',
    'Perfect, see you then',
    'Let\'s discuss this further',
  ];

  const startInsert = Date.now();
  
  // Use transaction for bulk insert performance
  const insertChat = db.prepare(`
    INSERT INTO chats (id, title, lastMessageAt, unreadCount)
    VALUES (?, ?, ?, ?)
  `);

  const insertMessage = db.prepare(`
    INSERT INTO messages (id, chatId, ts, sender, body)
    VALUES (?, ?, ?, ?, ?)
  `);

  const transaction = db.transaction((chats) => {
    for (const chatName of chats) {
      const chatId = uuid();
      let latestTimestamp = 0;

      // Create 100-150 messages per chat (varying distribution)
      const messageCount = Math.floor(Math.random() * 50) + 100;
      
      for (let i = 0; i < messageCount; i++) {
        // Spread timestamps across last 30 days
        const daysAgo = Math.floor(Math.random() * 30);
        const hoursAgo = Math.floor(Math.random() * 24);
        const ts = Date.now() - (daysAgo * 24 * 3600 * 1000) - (hoursAgo * 3600 * 1000);
        
        latestTimestamp = Math.max(latestTimestamp, ts);

        insertMessage.run(
          uuid(),
          chatId,
          ts,
          senders[Math.floor(Math.random() * senders.length)],
          sampleMessages[Math.floor(Math.random() * sampleMessages.length)]
        );
      }

      // Insert chat with latest message timestamp
      insertChat.run(
        chatId,
        chatName,
        latestTimestamp,
        Math.random() > 0.7 ? Math.floor(Math.random() * 10) : 0
      );
    }
  });

  try {
    transaction(chatNames);
    const duration = Date.now() - startInsert;
    logger.info(`Database seeded with 200 chats and ~20,000 messages in ${duration}ms`);
  } catch (error) {
    logger.error(`Seeding failed: ${error.message}`);
  }
}

/**
 * GET CHATS
 * 
 * Fetch paginated chat list sorted by most recent message.
 * This query demonstrates:
 * - Pagination with OFFSET/LIMIT (scales to thousands of chats)
 * - Sorting by lastMessageAt DESC (recent first)
 * - Only selecting needed columns
 * - Prepared statement (prevents SQL injection)
 * 
 * @param offset - Number of chats to skip
 * @param limit - Number of chats to return
 * @returns { chats: Array, total: number, hasMore: boolean }
 */
function getChats(offset = 0, limit = 50) {
  try {
    // Get total count
    const countResult = db.prepare('SELECT COUNT(*) as total FROM chats').get();
    const total = countResult.total;

    // Get paginated results
    const chats = db.prepare(`
      SELECT id, title, lastMessageAt, unreadCount
      FROM chats
      ORDER BY lastMessageAt DESC
      LIMIT ? OFFSET ?
    `).all(limit, offset);

    return {
      chats,
      total,
      hasMore: offset + limit < total,
    };
  } catch (error) {
    logger.error(`Error in getChats: ${error.message}`);
    throw error;
  }
}

/**
 * GET MESSAGES
 * 
 * Fetch paginated message history for a specific chat.
 * Ordered by timestamp DESC (newest first).
 * 
 * Performance notes:
 * - Index on (chatId, ts DESC) enables efficient retrieval
 * - Pagination prevents loading thousands of messages
 * - In real app, messages would be decrypted here
 * 
 * @param chatId - Chat identifier
 * @param offset - Message offset (pagination)
 * @param limit - Messages per page
 * @returns { messages: Array, total: number, hasMore: boolean }
 */
function getMessages(chatId, offset = 0, limit = 50) {
  try {
    // Count total messages in this chat
    const countResult = db.prepare(
      'SELECT COUNT(*) as total FROM messages WHERE chatId = ?'
    ).get(chatId);
    const total = countResult.total;

    // Get paginated messages (newest first)
    const messages = db.prepare(`
      SELECT id, chatId, ts, sender, body
      FROM messages
      WHERE chatId = ?
      ORDER BY ts DESC
      LIMIT ? OFFSET ?
    `).all(chatId, limit, offset);

    return {
      messages: messages.reverse(), // Reverse to show oldest first in UI
      total,
      hasMore: offset + limit < total,
    };
  } catch (error) {
    logger.error(`Error in getMessages: ${error.message}`);
    throw error;
  }
}

/**
 * SEARCH MESSAGES
 * 
 * Search messages in a specific chat by substring.
 * Uses SQL LIKE operator with LIMIT to prevent performance issues.
 * 
 * Security note:
 * - Parameterized query prevents SQL injection
 * - Results limited to 50 to prevent UI freezing
 * 
 * Real app would:
 * - Support full-text search with FTS5 extension
 * - Decrypt messages before searching
 * - Log search queries for audit trail
 * 
 * @param chatId - Chat to search in
 * @param query - Search substring (case-insensitive)
 * @param limit - Max results
 * @returns { messages: Array }
 */
function searchMessages(chatId, query, limit = 50) {
  try {
    const messages = db.prepare(`
      SELECT id, chatId, ts, sender, body
      FROM messages
      WHERE chatId = ? AND body LIKE ?
      ORDER BY ts DESC
      LIMIT ?
    `).all(chatId, `%${query}%`, limit);

    return {
      messages,
    };
  } catch (error) {
    logger.error(`Error in searchMessages: ${error.message}`);
    throw error;
  }
}

/**
 * MARK CHAT AS READ
 * 
 * Reset unreadCount for a chat to 0.
 * Called when user opens a chat in the UI.
 * 
 * @param chatId - Chat to mark as read
 */
function markChatAsRead(chatId) {
  try {
    db.prepare('UPDATE chats SET unreadCount = 0 WHERE id = ?').run(chatId);
  } catch (error) {
    logger.error(`Error in markChatAsRead: ${error.message}`);
    throw error;
  }
}

/**
 * INSERT MESSAGE
 * 
 * Insert new message (called by WebSocket handler when sync event arrives).
 * Also updates chat's lastMessageAt timestamp.
 * 
 * @param chatId - Chat to add message to
 * @param messageId - Unique message ID
 * @param ts - Message timestamp
 * @param sender - Message sender
 * @param body - Message body
 * @param increment_unread - Whether to increment unreadCount
 */
function insertMessage(chatId, messageId, ts, sender, body, increment_unread = true) {
  try {
    const insertMsg = db.prepare(`
      INSERT INTO messages (id, chatId, ts, sender, body)
      VALUES (?, ?, ?, ?, ?)
    `);

    insertMsg.run(messageId, chatId, ts, sender, body);

    // Update chat's lastMessageAt and optionally increment unreadCount
    const updateChat = increment_unread
      ? db.prepare(`
          UPDATE chats 
          SET lastMessageAt = ?, unreadCount = unreadCount + 1
          WHERE id = ?
        `)
      : db.prepare(`
          UPDATE chats 
          SET lastMessageAt = ?
          WHERE id = ?
        `);

    updateChat.run(ts, chatId);
  } catch (error) {
    logger.error(`Error in insertMessage: ${error.message}`);
    throw error;
  }
}

/**
 * CLOSE DATABASE
 * 
 * Gracefully close database connection.
 * Called on app shutdown.
 */
function closeDatabase() {
  if (db) {
    db.close();
    logger.info('Database connection closed');
  }
}

module.exports = {
  initializeDatabase,
  getChats,
  getMessages,
  searchMessages,
  markChatAsRead,
  insertMessage,
  closeDatabase,
};
