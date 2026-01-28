/**
 * WEBSOCKET MANAGER
 * 
 * Purpose: Manage WebSocket connection lifecycle and event handling.
 * Decouples React components from WebSocket logic.
 * 
 * Responsibilities:
 * - Connect/disconnect from WebSocket server
 * - Handle reconnection with exponential backoff
 * - Emit messages received to Redux store
 * - Monitor connection health via heartbeat
 * - Handle errors gracefully
 * 
 * Exponential Backoff Strategy:
 * Attempt 1: Wait 1 second
 * Attempt 2: Wait 2 seconds
 * Attempt 3: Wait 4 seconds
 * Attempt 4: Wait 8 seconds
 * Attempt 5+: Wait 30 seconds (max)
 * 
 * This prevents overwhelming server if connection is down.
 */

import { store } from '../store/store';
import {
  setConnecting,
  setConnected,
  setDisconnected,
  setConnectionError,
  updateHeartbeat,
} from '../store/slices/connectionSlice';
import {
  addMessage,
  incrementChatUnread as incrementUnread,
} from '../store/slices/messagesSlice';
import { incrementChatUnread } from '../store/slices/chatsSlice';

const WS_URL = 'ws://localhost:9000';
const HEARTBEAT_INTERVAL = 10000; // 10 seconds
const HEARTBEAT_TIMEOUT = 5000; // 5 seconds to respond

interface WSMessage {
  type: string;
  data: any;
}

class WebSocketManager {
  private ws: WebSocket | null = null;
  private reconnectAttempt = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private heartbeatTimeout: NodeJS.Timeout | null = null;

  /**
   * CONNECT
   * Establish WebSocket connection to server.
   * Dispatches Redux actions to update UI state.
   */
  connect() {
    try {
      store.dispatch(setConnecting());

      this.ws = new WebSocket(WS_URL);

      // Connection opened
      this.ws.onopen = () => {
        console.log('[ ] WebSocket connected');
        store.dispatch(setConnected());
        this.reconnectAttempt = 0;
        this.startHeartbeat();
      };

      // Message received from server
      this.ws.onmessage = (event) => {
        const message: WSMessage = JSON.parse(event.data);
        this.handleMessage(message);
      };

      // Connection closed
      this.ws.onclose = () => {
        console.log('[ ] WebSocket closed');
        store.dispatch(setDisconnected());
        this.stopHeartbeat();
        this.scheduleReconnect();
      };

      // Connection error
      this.ws.onerror = (error) => {
        console.log('[ ] WebSocket error:', error);
        const errorMsg = `WebSocket error: ${error}`;
        store.dispatch(setConnectionError(errorMsg));
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.log('[ ] Failed to connect:', errorMsg);
      store.dispatch(setConnectionError(errorMsg));
      this.scheduleReconnect();
    }
  }

  /**
   * DISCONNECT
   * Gracefully close WebSocket connection.
   * Called on app shutdown.
   */
  disconnect() {
    this.stopHeartbeat();
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * SCHEDULE RECONNECT
   * 
   * Implements exponential backoff:
   * - 1st attempt: 1 second
   * - 2nd attempt: 2 seconds
   * - 3rd attempt: 4 seconds
   * - 4th attempt: 8 seconds
   * - 5th+ attempt: 30 seconds
   * 
   * After max attempts, stops trying to avoid hammering server.
   */
  private scheduleReconnect() {
    // Exponential backoff with max of 30 seconds
    const baseDelay = Math.pow(2, this.reconnectAttempt);
    const delay = Math.min(baseDelay * 1000, 30000);

    console.log(
      `[ ] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempt + 1})`
    );

    if (this.reconnectAttempt < this.maxReconnectAttempts) {
      this.reconnectTimeout = setTimeout(() => {
        this.reconnectAttempt += 1;
        this.connect();
      }, delay);
    } else {
      console.log('[ ] Max reconnect attempts reached');
      store.dispatch(
        setConnectionError('Max reconnection attempts reached. Please restart app.')
      );
    }
  }

  /**
   * HANDLE MESSAGE
   * 
   * Process incoming WebSocket messages.
   * Currently handles NEW_MESSAGE events from server.
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
   */
  private handleMessage(message: WSMessage) {
    console.log('[ ] Message received:', message.type);

    switch (message.type) {
      case 'NEW_MESSAGE':
        this.handleNewMessage(message.data);
        break;
      case 'PONG':
        this.handlePong();
        break;
      default:
        console.warn(`[ ] Unknown message type: ${message.type}`);
    }
  }

  /**
   * HANDLE NEW MESSAGE
   * 
   * Called when server emits a new message.
   * Updates Redux state to reflect new message in UI.
   * 
   * Flow:
   * 1. Increment unread count for chat (chats list)
   * 2. Add message to messages slice (if viewing this chat)
   * 3. UI automatically re-renders
   */
  private handleNewMessage(data: any) {
    const { chatId, messageId, ts, sender, body } = data;

    // Update chat unread count
    store.dispatch(incrementChatUnread(chatId));

    // Add message to currently viewed chat
    store.dispatch(
      addMessage({
        id: messageId,
        chatId,
        ts,
        sender,
        body,
      })
    );

    console.log(
      `[ ] New message in chat ${chatId.substring(0, 8)}: "${body.substring(0, 20)}..."`
    );
  }

  /**
   * START HEARTBEAT
   * 
   * Send periodic ping to detect connection issues.
   * Server responds with pong if connection is healthy.
   * 
   * If no pong received within HEARTBEAT_TIMEOUT, consider connection dead.
   */
  private startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        // Use WebSocket ping/pong (native support)
        this.ws.send(JSON.stringify({ type: 'PING' }));

        // Set timeout to detect if pong doesn't arrive
        this.heartbeatTimeout = setTimeout(() => {
          console.log('[ ] Heartbeat timeout, reconnecting...');
          this.disconnect();
          this.connect();
        }, HEARTBEAT_TIMEOUT);
      }
    }, HEARTBEAT_INTERVAL);
  }

  /**
   * HANDLE PONG
   * 
   * Called when server responds to our ping.
   * Clears heartbeat timeout and updates last heartbeat timestamp.
   */
  private handlePong() {
    if (this.heartbeatTimeout) {
      clearTimeout(this.heartbeatTimeout);
    }
    store.dispatch(updateHeartbeat());
  }

  /**
   * STOP HEARTBEAT
   * 
   * Cancel heartbeat interval and timeout.
   * Called when disconnecting.
   */
  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    if (this.heartbeatTimeout) {
      clearTimeout(this.heartbeatTimeout);
    }
  }

  /**
   * SIMULATE CONNECTION DROP
   * 
   * For testing: Call Electron main process to close server connection.
   * Client will detect disconnection and reconnect automatically.
   */
  async simulateConnectionDrop() {
    const result = await window.electron.ipcRenderer.invoke(
      'SIMULATE_CONNECTION_DROP'
    );
    if (result.success) {
      console.log('[ ] Connection drop simulated');
    }
  }

  /**
   * GET CONNECTION STATUS
   * 
   * Returns current connection status.
   * Used to show UI indicators.
   */
  getStatus(): string {
    if (!this.ws) return 'disconnected';
    if (this.ws.readyState === WebSocket.CONNECTING) return 'connecting';
    if (this.ws.readyState === WebSocket.OPEN) return 'connected';
    return 'disconnected';
  }
}

// Export singleton instance
export const wsManager = new WebSocketManager();
