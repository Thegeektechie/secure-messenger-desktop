'use client';

/**
 * CONNECTION STATUS COMPONENT
 * 
 * Purpose: Display WebSocket connection state to user.
 * Shows indicator and allows manual connection testing.
 * 
 * States:
 * - Connected (green): Active WebSocket connection
 * - Connecting (yellow): Attempting to establish connection
 * - Disconnected (red): No connection, waiting to retry
 * - Error (red): Connection failed
 */

import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState, AppDispatch } from '../store/store';
import { wsManager } from '../services/websocket';
import './ConnectionStatus.css';

export const ConnectionStatus: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { status, error, reconnectAttempt } = useSelector(
    (state: RootState) => state.connection
  );

  // Handle test disconnect button
  const handleSimulateDrop = async () => {
    await wsManager.simulateConnectionDrop();
  };

  const statusColor =
    status === 'connected'
      ? '#10b981' // Green
      : status === 'connecting'
        ? '#f59e0b' // Amber
        : '#ef4444'; // Red

  const statusLabel =
    status === 'connected'
      ? 'Connected'
      : status === 'connecting'
        ? `Connecting (attempt ${reconnectAttempt})`
        : status === 'error'
          ? 'Error'
          : 'Disconnected';

  return (
    <div className="connection-status">
      <div className="status-indicator" style={{ backgroundColor: statusColor }} />
      <div className="status-text">
        <div className="status-label">{statusLabel}</div>
        {error && <div className="status-error">{error}</div>}
      </div>

      <button
        className="test-disconnect-btn"
        onClick={handleSimulateDrop}
        title="Simulate server connection drop to test reconnection"
      >
        Test Disconnect
      </button>
    </div>
  );
};
