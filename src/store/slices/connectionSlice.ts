/**
 * CONNECTION SLICE
 * 
 * Redux slice for managing WebSocket connection state.
 * Handles connection health monitoring and recovery.
 * 
 * Connection States:
 * - 'connected': Active WebSocket connection
 * - 'connecting': Attempting to connect (backoff active)
 * - 'disconnected': No connection, waiting to retry
 * - 'error': Connection failed with error
 * 
 * State shape:
 * {
 *   status: 'connected' | 'connecting' | 'disconnected' | 'error',
 *   lastHeartbeat: number,      // Timestamp of last ping/pong
 *   reconnectAttempt: number,   // Current retry attempt (for backoff)
 *   error: string | null        // Error message if failed
 * }
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit';

type ConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'error';

interface ConnectionState {
  status: ConnectionStatus;
  lastHeartbeat: number;
  reconnectAttempt: number;
  error: string | null;
}

const initialState: ConnectionState = {
  status: 'disconnected',
  lastHeartbeat: 0,
  reconnectAttempt: 0,
  error: null,
};

const connectionSlice = createSlice({
  name: 'connection',
  initialState,
  reducers: {
    /**
     * SET CONNECTION CONNECTING
     * Called when initiating connection attempt.
     */
    setConnecting: (state) => {
      state.status = 'connecting';
      state.error = null;
    },

    /**
     * SET CONNECTION CONNECTED
     * Called when WebSocket connection established successfully.
     */
    setConnected: (state) => {
      state.status = 'connected';
      state.reconnectAttempt = 0;
      state.error = null;
      state.lastHeartbeat = Date.now();
    },

    /**
     * SET CONNECTION DISCONNECTED
     * Called when connection closes or is interrupted.
     */
    setDisconnected: (state) => {
      state.status = 'disconnected';
      state.reconnectAttempt += 1;
    },

    /**
     * SET CONNECTION ERROR
     * Called when connection fails with an error.
     */
    setConnectionError: (state, action: PayloadAction<string>) => {
      state.status = 'error';
      state.error = action.payload;
    },

    /**
     * UPDATE HEARTBEAT
     * Called when heartbeat ping/pong received.
     * Used to determine if connection is healthy.
     */
    updateHeartbeat: (state) => {
      state.lastHeartbeat = Date.now();
    },

    /**
     * RESET CONNECTION
     * Clear state (on app exit or manual reset).
     */
    resetConnection: () => initialState,
  },
});

export const {
  setConnecting,
  setConnected,
  setDisconnected,
  setConnectionError,
  updateHeartbeat,
  resetConnection,
} = connectionSlice.actions;

export default connectionSlice.reducer;
