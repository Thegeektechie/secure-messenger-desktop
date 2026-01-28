/**
 * ELECTRON MAIN PROCESS
 * 
 * Purpose: Core Electron process that manages the application window,
 * handles IPC communication with renderer process, and orchestrates
 * WebSocket server and database layer initialization.
 * 
 * Responsibilities:
 * - Create and manage BrowserWindow
 * - Initialize SQLite database
 * - Start WebSocket server for sync simulation
 * - Handle IPC messages from renderer (React)
 * - Manage application lifecycle
 */

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const isDev = require('electron-is-dev');

// Import database and WebSocket services
const { initializeDatabase, getChats, getMessages, searchMessages, markChatAsRead } = require('./db');
const { startWebSocketServer, stopWebSocketServer, simulateConnectionDrop } = require('./websocket-server');
const { logger } = require('./security/logger');

let mainWindow;

/**
 * CREATE WINDOW
 * Creates the main application window and loads the React app.
 * In development, connects to localhost:3000 (React dev server).
 * In production, loads from built files.
 */
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      // Security: Disable nodeIntegration and enable contextIsolation
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  const startUrl = isDev
    ? 'http://localhost:3000'
    : `file://${path.join(__dirname, '../build/index.html')}`;

  mainWindow.loadURL(startUrl);

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  logger.info('Main window created successfully');
}

/**
 * APP READY
 * Initialize database, start WebSocket server, and create window.
 * This is the entry point for application startup.
 */
app.on('ready', async () => {
  try {
    // Initialize SQLite database with schema
    await initializeDatabase();
    
    // Start WebSocket server for real-time sync simulation
    startWebSocketServer();
    
    // Create main window
    createWindow();
  } catch (error) {
    logger.error(`Failed to initialize app: ${error.message}`);
    process.exit(1);
  }
});

/**
 * QUIT APP
 * Clean up resources when app is closing.
 * Stop WebSocket server and database connections.
 */
app.on('window-all-closed', () => {
  stopWebSocketServer();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

/**
 * IPC HANDLERS
 * These handlers receive requests from the React renderer process
 * and interact with backend services (database, WebSocket).
 */

/**
 * IPC: GET_CHATS
 * Handler for fetching paginated chat list.
 * 
 * Request format: { offset: number, limit: number }
 * Response format: { chats: Chat[], total: number, hasMore: boolean }
 * 
 * This query is optimized to:
 * - Use pagination to avoid loading all chats
 * - Sort by lastMessageAt (most recent first)
 * - Include unread counts from database (not computed in JS)
 */
ipcMain.handle('GET_CHATS', async (event, { offset = 0, limit = 50 }) => {
  try {
    const result = await getChats(offset, limit);
    return {
      success: true,
      data: result,
    };
  } catch (error) {
    logger.error(`Error fetching chats: ${error.message}`);
    return {
      success: false,
      error: error.message,
    };
  }
});

/**
 * IPC: GET_MESSAGES
 * Handler for fetching messages for a specific chat.
 * 
 * Request format: { chatId: string, offset: number, limit: number }
 * Response format: { messages: Message[], total: number, hasMore: boolean }
 * 
 * Performance considerations:
 * - Uses pagination to handle large chat histories
 * - Orders by timestamp DESC (newest first, then reverse in UI)
 * - Only fetches necessary columns from database
 */
ipcMain.handle('GET_MESSAGES', async (event, { chatId, offset = 0, limit = 50 }) => {
  try {
    const result = await getMessages(chatId, offset, limit);
    return {
      success: true,
      data: result,
    };
  } catch (error) {
    logger.error(`Error fetching messages: ${error.message}`);
    return {
      success: false,
      error: error.message,
    };
  }
});

/**
 * IPC: SEARCH_MESSAGES
 * Handler for searching messages in current chat by substring.
 * 
 * Request format: { chatId: string, query: string, limit: number }
 * Response format: { messages: Message[] }
 * 
 * Security note: Query is parameterized in database layer to prevent SQL injection.
 * Results limited to 50 to prevent UI performance degradation.
 */
ipcMain.handle('SEARCH_MESSAGES', async (event, { chatId, query, limit = 50 }) => {
  try {
    const result = await searchMessages(chatId, query, limit);
    return {
      success: true,
      data: result,
    };
  } catch (error) {
    logger.error(`Error searching messages: ${error.message}`);
    return {
      success: false,
      error: error.message,
    };
  }
});

/**
 * IPC: MARK_CHAT_AS_READ
 * Handler for marking a chat as read (unreadCount = 0).
 * 
 * Request format: { chatId: string }
 * Response format: { success: boolean }
 * 
 * Called when user opens a chat in the UI.
 */
ipcMain.handle('MARK_CHAT_AS_READ', async (event, { chatId }) => {
  try {
    await markChatAsRead(chatId);
    return {
      success: true,
    };
  } catch (error) {
    logger.error(`Error marking chat as read: ${error.message}`);
    return {
      success: false,
      error: error.message,
    };
  }
});

/**
 * IPC: SIMULATE_CONNECTION_DROP
 * Handler for testing connection recovery.
 * 
 * This closes the WebSocket connection from server side.
 * Client must automatically reconnect with exponential backoff.
 */
ipcMain.handle('SIMULATE_CONNECTION_DROP', async () => {
  try {
    simulateConnectionDrop();
    return {
      success: true,
      message: 'Connection dropped - client should reconnect',
    };
  } catch (error) {
    logger.error(`Error simulating connection drop: ${error.message}`);
    return {
      success: false,
      error: error.message,
    };
  }
});

module.exports = { app, mainWindow };
