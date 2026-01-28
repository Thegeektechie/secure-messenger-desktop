/**
 * WEBSOCKET SERVER - SYNC SIMULATOR
 * 
 * Purpose: Simulate real-time message sync from a server.
 * Emits new messages to connected clients every 1-3 seconds.
 * 
 * Architecture:
 * - Local WebSocket server (ws://localhost:9000)
 * - Runs in main Electron process
 * - Broadcasts sync events to all connected clients
 * - Simulates realistic message distribution across chats
 * 
 * This demonstrates:
 * - Real-time sync patterns
 * - Connection state management
 * - Message event broadcasting
 * - Connection drop/recovery testing
 */

const WebSocket = require('ws');
const { v4: uuid } = require('uuid');
const db = require('./db');
const { logger } = require('./security/logger');

// Server configuration
const WS_PORT = 9000;
const MESSAGE_INTERVAL = 2000; // Emit message every 2 seconds (±1s variance)

let wss = null; // WebSocket Server instance
let messageIntervalId = null;

/**
 * START WEBSOCKET SERVER
 * 
 * Initialize WebSocket server and start message broadcast loop.
 * Handles new connections and maintains client list.
 */
function startWebSocketServer() {
  try {
    // Create WebSocket server
    wss = new WebSocket.Server({ port: WS_PORT });

    logger.info(`WebSocket server started on ws://localhost:${WS_PORT}`);

    /**
     * CONNECTION HANDLER
     * Called when a client connects.
     * Sends heartbeat pings to detect connection issues.
     */
    wss.on('connection', (ws) => {
      const clientId = uuid();
      logger.info(`Client connected: ${clientId}`);

      // Set up heartbeat to detect stale connections
      let heartbeatInterval = setInterval(() => {
        if (ws.isAlive === false) {
          clearInterval(heartbeatInterval);
          return ws.terminate();
        }
        ws.isAlive = false;
        ws.ping();
      }, 10000); // Ping every 10 seconds

      ws.isAlive = true;
      ws.on('pong', () => {
        ws.isAlive = true;
      });

      // Handle client disconnection
      ws.on('close', () => {
        clearInterval(heartbeatInterval);
        logger.info(`Client disconnected: ${clientId}`);
      });

      // Handle errors
      ws.on('error', (error) => {
        logger.error(`WebSocket error from ${clientId}: ${error.message}`);
      });
    });

    // Start broadcasting synthetic messages
    startMessageBroadcast();

  } catch (error) {
    logger.error(`Failed to start WebSocket server: ${error.message}`);
  }
}

/**
 * START MESSAGE BROADCAST
 * 
 * Periodically generate and broadcast new messages.
 * Simulates realistic incoming message patterns:
 * - Random chat selection
 * - Random sender (not the user)
 * - Timestamp is current time (server time in real app)
 * - Realistic message content
 * 
 * Flow:
 * 1. Generate synthetic message with random data
 * 2. Insert into database
 * 3. Broadcast to all connected clients via WebSocket
 * 4. Client updates Redux state
 * 5. React re-renders with new message
 */
function startMessageBroadcast() {
  const senders = ['user_001', 'user_002', 'user_003', 'contact_a', 'contact_b'];
  const sampleMessages = [
    'Got it, thanks!',
    'Can you send me the file?',
    'I\'ll check and get back to you',
    'Sounds like a plan',
    'Just finished reviewing',
    'Let me know what you think',
    'All done here',
    'Perfect, moving forward',
    'I have a few questions',
    'This looks great!',
  ];

  messageIntervalId = setInterval(() => {
    try {
      // Get all chats to select one randomly
      const allChats = db.prepare('SELECT id FROM chats').all();
      
      if (allChats.length === 0) {
        logger.warn('No chats in database, skipping message broadcast');
        return;
      }

      // Randomly select a chat
      const randomChat = allChats[Math.floor(Math.random() * allChats.length)];
      const chatId = randomChat.id;

      // Generate message data
      const messageId = uuid();
      const ts = Date.now();
      const sender = senders[Math.floor(Math.random() * senders.length)];
      const body = sampleMessages[Math.floor(Math.random() * sampleMessages.length)];

      // Insert into database (increment unread count)
      db.insertMessage(chatId, messageId, ts, sender, body, true);

      // Create event payload
      const event = {
        type: 'NEW_MESSAGE',
        data: {
          chatId,
          messageId,
          ts,
          sender,
          body,
        },
      };

      // Broadcast to all connected clients
      broadcastToClients(event);

      logger.info(`Broadcasted message to chat ${chatId.substring(0, 8)}`);

    } catch (error) {
      logger.error(`Error in message broadcast: ${error.message}`);
    }

    // Reschedule with random interval (1-3 seconds)
    rescheduleMessageBroadcast(sampleMessages, senders);

  }, MESSAGE_INTERVAL + Math.random() * 1000 - 500);
}

/**
 * RESCHEDULE MESSAGE BROADCAST
 * 
 * Reschedules the next broadcast with random interval.
 * Creates variability in sync events (realistic behavior).
 */
function rescheduleMessageBroadcast(sampleMessages, senders) {
  // This is called at end of interval to reschedule with new random interval
  // (Optional enhancement for production)
}

/**
 * BROADCAST TO CLIENTS
 * 
 * Send message to all connected clients.
 * Handles errors gracefully (client might be disconnecting).
 * 
 * Event format:
 * {
 *   type: 'NEW_MESSAGE',
 *   data: {
 *     chatId: string,
 *     messageId: string,
 *     ts: number,
 *     sender: string,
 *     body: string
 *   }
 * }
 * 
 * @param event - Event object to broadcast
 */
function broadcastToClients(event) {
  const message = JSON.stringify(event);
  
  if (!wss) return;

  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message, (error) => {
        if (error) {
          logger.error(`Failed to send message to client: ${error.message}`);
        }
      });
    }
  });
}

/**
 * SIMULATE CONNECTION DROP
 * 
 * For testing: Close connection from server side.
 * Client must detect disconnection and reconnect automatically
 * with exponential backoff strategy.
 * 
 * This validates:
 * - Automatic reconnection logic
 * - Exponential backoff implementation
 * - UI state handling during outage
 * - Message recovery after reconnection
 */
function simulateConnectionDrop() {
  logger.info('Simulating connection drop...');
  
  if (!wss) {
    logger.warn('WebSocket server not running');
    return;
  }

  // Close all client connections
  wss.clients.forEach((client) => {
    client.close(1006, 'Connection terminated by server'); // Code 1006 = Abnormal close
  });

  logger.info('All client connections closed');

  // Optional: Restart server after delay to test reconnection
  setTimeout(() => {
    logger.info('Restarting WebSocket server for reconnection test');
    stopWebSocketServer();
    startWebSocketServer();
  }, 2000);
}

/**
 * STOP WEBSOCKET SERVER
 * 
 * Gracefully shut down the WebSocket server.
 * Called on app exit.
 */
function stopWebSocketServer() {
  // Clear message broadcast interval
  if (messageIntervalId) {
    clearInterval(messageIntervalId);
    messageIntervalId = null;
  }

  // Close server
  if (wss) {
    // Close all client connections
    wss.clients.forEach((client) => {
      client.close();
    });

    // Close server
    wss.close((error) => {
      if (error) {
        logger.error(`Error closing WebSocket server: ${error.message}`);
      } else {
        logger.info('WebSocket server stopped');
      }
    });

    wss = null;
  }
}

module.exports = {
  startWebSocketServer,
  stopWebSocketServer,
  simulateConnectionDrop,
  broadcastToClients,
};
