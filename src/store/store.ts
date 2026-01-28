/**
 * REDUX STORE CONFIGURATION
 * 
 * Purpose: Centralized state management for the React application.
 * Uses Redux Toolkit for boilerplate reduction and best practices.
 * 
 * State Structure:
 * - chats: Chat list with pagination and metadata
 * - messages: Current chat's messages
 * - connection: WebSocket connection status and health
 * - ui: UI state (selected chat, search, etc.)
 * 
 * Why Redux Toolkit?
 * - Immer integration for immutable updates
 * - Built-in thunks for async operations
 * - Redux DevTools integration for debugging
 * - Slice pattern reduces boilerplate 50%
 * - Excellent TypeScript support
 * 
 * Alternative considered: Zustand
 * - Lighter weight (good for simple apps)
 * - Less boilerplate than Redux
 * - No DevTools by default
 * - Decision: Redux Toolkit for enterprise patterns and DevTools
 */

import { configureStore } from '@reduxjs/toolkit';
import chatsReducer from './slices/chatsSlice';
import messagesReducer from './slices/messagesSlice';
import connectionReducer from './slices/connectionSlice';
import uiReducer from './slices/uiSlice';

/**
 * STORE CONFIGURATION
 * 
 * Combines all reducers and middleware.
 * Includes Redux DevTools for debugging.
 */
export const store = configureStore({
  reducer: {
    chats: chatsReducer,
    messages: messagesReducer,
    connection: connectionReducer,
    ui: uiReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Ignore non-serializable timestamps in messages
        ignoredActions: ['messages/addMessage'],
        ignoredPaths: ['messages.items[].ts'],
      },
    }),
});

// TypeScript types for use throughout app
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
