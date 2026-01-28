/**
 * MESSAGES SLICE
 * 
 * Redux slice for managing messages in the currently selected chat.
 * Handles pagination, loading, and real-time message insertion.
 * 
 * State shape:
 * {
 *   items: Message[],           // Messages for current chat
 *   selectedChatId: string,     // Which chat we're viewing
 *   total: number,              // Total messages in chat
 *   hasMore: boolean,           // More messages in history
 *   currentOffset: number,      // Pagination offset
 *   loading: boolean,           // Fetch in progress
 *   error: string | null        // Error message
 * }
 */

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';

interface Message {
  id: string;
  chatId: string;
  ts: number;
  sender: string;
  body: string;
}

interface MessagesState {
  items: Message[];
  selectedChatId: string | null;
  total: number;
  hasMore: boolean;
  currentOffset: number;
  loading: boolean;
  error: string | null;
}

const initialState: MessagesState = {
  items: [],
  selectedChatId: null,
  total: 0,
  hasMore: true,
  currentOffset: 0,
  loading: false,
  error: null,
};

/**
 * FETCH MESSAGES THUNK
 * 
 * Load messages for a specific chat with pagination.
 * Called when:
 * - User selects a chat
 * - User clicks "Load older messages"
 */
export const fetchMessages = createAsyncThunk<
  { messages: Message[]; total: number; hasMore: boolean },
  { chatId: string; offset: number }
>('messages/fetchMessages', async ({ chatId, offset }) => {
  const result = await window.electron.ipcRenderer.invoke('GET_MESSAGES', {
    chatId,
    offset,
    limit: 50,
  });

  if (!result.success) {
    throw new Error(result.error);
  }

  return result.data;
});

/**
 * SEARCH MESSAGES THUNK
 * 
 * Search messages in current chat by substring.
 * Results limited to 50 to prevent performance issues.
 */
export const searchMessages = createAsyncThunk<
  { messages: Message[] },
  { chatId: string; query: string }
>('messages/searchMessages', async ({ chatId, query }) => {
  const result = await window.electron.ipcRenderer.invoke('SEARCH_MESSAGES', {
    chatId,
    query,
    limit: 50,
  });

  if (!result.success) {
    throw new Error(result.error);
  }

  return result.data;
});

const messagesSlice = createSlice({
  name: 'messages',
  initialState,
  reducers: {
    /**
     * SET SELECTED CHAT
     * Called when user clicks on a chat in the list.
     * Clears current messages and prepares to load new ones.
     */
    setSelectedChat: (state, action: PayloadAction<string>) => {
      state.selectedChatId = action.payload;
      state.items = [];
      state.currentOffset = 0;
      state.error = null;
    },

    /**
     * ADD MESSAGE
     * Insert new message at the end (when it arrives via WebSocket).
     * Called by sync handler.
     * 
     * In real app, would check if message is for selected chat
     * and only add if visible to avoid confusion.
     */
    addMessage: (state, action: PayloadAction<Message>) => {
      // Only add if viewing this chat
      if (state.selectedChatId === action.payload.chatId) {
        state.items.push(action.payload);
      }
    },

    /**
     * CLEAR MESSAGES
     * Called when disconnecting or switching chats.
     */
    clearMessages: (state) => {
      state.items = [];
      state.selectedChatId = null;
      state.currentOffset = 0;
    },
  },
  extraReducers: (builder) => {
    // FETCH MESSAGES PENDING
    builder.addCase(fetchMessages.pending, (state) => {
      state.loading = true;
      state.error = null;
    });

    // FETCH MESSAGES FULFILLED
    builder.addCase(fetchMessages.fulfilled, (state, action) => {
      state.loading = false;
      state.items = action.payload.messages;
      state.total = action.payload.total;
      state.hasMore = action.payload.hasMore;
    });

    // FETCH MESSAGES REJECTED
    builder.addCase(fetchMessages.rejected, (state, action) => {
      state.loading = false;
      state.error = action.error.message || 'Failed to fetch messages';
    });

    // SEARCH MESSAGES FULFILLED
    builder.addCase(searchMessages.fulfilled, (state, action) => {
      state.items = action.payload.messages;
    });

    // SEARCH MESSAGES REJECTED
    builder.addCase(searchMessages.rejected, (state, action) => {
      state.error = action.error.message || 'Search failed';
    });
  },
});

export const { setSelectedChat, addMessage, clearMessages } = messagesSlice.actions;
export default messagesSlice.reducer;
