'use client';

/**
 * APP COMPONENT
 * 
 * Purpose: Root component that orchestrates the application.
 * 
 * Responsibilities:
 * - Initialize WebSocket connection on mount
 * - Layout main/sidebar structure
 * - Manage global keyboard shortcuts
 * - Cleanup on unmount
 */

import React, { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { ChatList } from './components/ChatList';
import { MessageView } from './components/MessageView';
import { ConnectionStatus } from './components/ConnectionStatus';
import { wsManager } from './services/websocket';
import { AppDispatch } from './store/store';
import './App.css';

export const App: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();

  /**
   * INITIALIZE APP
   * 
   * On component mount:
   * 1. Connect WebSocket to server
   * 2. Start listening for sync events
   * 
   * On unmount:
   * 1. Disconnect WebSocket gracefully
   */
  useEffect(() => {
    // Connect to WebSocket server
    wsManager.connect();

    // Cleanup on unmount
    return () => {
      wsManager.disconnect();
    };
  }, [dispatch]);

  /**
   * KEYBOARD SHORTCUTS
   * 
   * Command+K: Open search
   * Escape: Close search / clear selection
   */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Command+K for search
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        // Focus search input (would need ref)
      }

      // Escape to close search
      if (e.key === 'Escape') {
        // Clear search query
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="app-container">
      {/* Header with connection status */}
      <header className="app-header">
        <h1 className="app-title">Secure Messenger</h1>
        <ConnectionStatus />
      </header>

      {/* Main content area */}
      <main className="app-main">
        {/* Left sidebar: Chat list */}
        <aside className="app-sidebar">
          <ChatList />
        </aside>

        {/* Right content: Message view */}
        <section className="app-content">
          <MessageView />
        </section>
      </main>

      {/* Footer (optional) */}
      <footer className="app-footer">
        <p>Professional Secure Messenger • v1.0.0</p>
      </footer>
    </div>
  );
};

export default App;
