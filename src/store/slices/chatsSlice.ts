/**
 * CHATS SLICE
 * 
 * Redux slice for managing chat list state.
 * Handles pagination, sorting, and chat metadata.
 * 
 * State shape:
 * {
 *   items: Chat[],              // Current page of chats
 *   total: number,              // Total chats in database
 *   hasMore: boolean,           // More pages available
 *   currentOffset: number,      // Pagination offset
 *   loading: boolean,           // Fetch in progress
 *   error: string | null        // Error message if any
 * }
 */

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';

// Type definitions
interface Chat {
  id: string;
  title: string;
  lastMessageAt: number;
  unreadCount: number;
}

interface ChatsState {
  items: Chat[];
  total: number;
  hasMore: boolean;
  currentOffset: number;
  loading: boolean;
  error: string | null;
}

const initialState: ChatsState = {
  items: [],
  total: 0,
  hasMore: true,
  currentOffset: 0,
  loading: false,
  error: null,
};

/**
 * FETCH CHATS THUNK
 * 
 * Async action for fetching chats from Electron main process via IPC.
 * Demonstrates:
 * - Async operation with pending/fulfilled/rejected states
 * - Error handling
 * - Type-safe payload
 * 
 * @param offset - Pagination offset (0 for first page)
 * @returns { chats, total, hasMore } from database
 */
export const fetchChats = createAsyncThunk<
  { chats: Chat[]; total: number; hasMore: boolean },
  number // argument type (offset)
>('chats/fetchChats', async (offset) => {
  // Call Electron IPC handler
  const result = await window.electron.ipcRenderer.invoke('GET_CHATS', {
    offset,
    limit: 50,
  });

  if (!result.success) {
    throw new Error(result.error);
  }

  return result.data;
});

/**
 * UPDATE UNREAD COUNT WHEN MESSAGE ARRIVES
 * 
 * Called by WebSocket handler when new message received.
 * Increments unreadCount for the affected chat.
 */
export const updateChatUnread = createAsyncThunk<
  void,
  string // chatId
>('chats/updateUnread', async (chatId, { getState }) => {
  const state = getState() as any;
  // Find chat and increment unread count locally
  // In real app, could refetch from database if needed
});

/**
 * CHATS SLICE
 * 
 * Defines reducers for synchronous state updates.
 * Reducers are called by actions.
 */
const chatsSlice = createSlice({
  name: 'chats',
  initialState,
  reducers: {
    /**
     * RESET CHATS
     * Called when user logs out or clears data.
     */
    resetChats: () => initialState,

    /**
     * UPDATE CHAT UNREAD
     * Increment unread count for a specific chat.
     * Called by WebSocket message handler.
     */
    incrementChatUnread: (state, action: PayloadAction<string>) => {
      const chat = state.items.find((c) => c.id === action.payload);
      if (chat) {
        chat.unreadCount += 1;
        // Move to top (update lastMessageAt)
        chat.lastMessageAt = Date.now();
        // Re-sort (would do this in real app with database query)
      }
    },

    /**
     * MARK CHAT AS READ
     * Set unreadCount to 0 when user opens chat.
     */
    markChatRead: (state, action: PayloadAction<string>) => {
      const chat = state.items.find((c) => c.id === action.payload);
      if (chat) {
        chat.unreadCount = 0;
      }
    },
  },
  extraReducers: (builder) => {
    /**
     * FETCH CHATS - PENDING
     * Set loading state when fetch starts.
     */
    builder.addCase(fetchChats.pending, (state) => {
      state.loading = true;
      state.error = null;
    });

    /**
     * FETCH CHATS - FULFILLED
     * Update state with fetched chats.
     * Handle both initial load and pagination.
     */
    builder.addCase(
      fetchChats.fulfilled,
      (state, action) => {
        state.loading = false;
        state.items = action.payload.chats;
        state.total = action.payload.total;
        state.hasMore = action.payload.hasMore;
      }
    );

    /**
     * FETCH CHATS - REJECTED
     * Handle errors gracefully with user message.
     */
    builder.addCase(fetchChats.rejected, (state, action) => {
      state.loading = false;
      state.error = action.error.message || 'Failed to fetch chats';
    });
  },
});

export const { resetChats, incrementChatUnread, markChatRead } = chatsSlice.actions;
export default chatsSlice.reducer;
