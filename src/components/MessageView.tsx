'use client';

/**
 * MESSAGE VIEW COMPONENT
 * 
 * Purpose: Display messages for selected chat with pagination and search.
 * 
 * Features:
 * - Virtual list for performance with 1000+ messages
 * - Load older messages on scroll up
 * - Search within current chat
 * - Real-time message updates
 * - Scroll to bottom on new message
 * - Responsive message display
 */

import React, { useEffect, useRef, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { FixedSizeList as List } from 'react-window';
import {
  fetchMessages,
  searchMessages,
  setSearchQuery,
  setSearching,
} from '../store/slices/messagesSlice';
import { RootState, AppDispatch } from '../store/store';
import './MessageView.css';

/**
 * MESSAGE ROW COMPONENT
 * 
 * Renders individual message with timestamp, sender, and body.
 */
const MessageRow = React.memo(
  ({
    index,
    style,
    data,
  }: {
    index: number;
    style: React.CSSProperties;
    data: any;
  }) => {
    const message = data.messages[index];
    if (!message) return null;

    const isCurrentUser = message.sender === 'user_001';
    const date = new Date(message.ts);
    const time = date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });

    return (
      <div
        style={style}
        className={`message-row ${isCurrentUser ? 'own-message' : 'other-message'}`}
      >
        <div className="message-bubble">
          <div className="message-sender">{message.sender}</div>
          <div className="message-body">{message.body}</div>
          <div className="message-time">{time}</div>
        </div>
      </div>
    );
  }
);

MessageRow.displayName = 'MessageRow';

/**
 * MAIN MESSAGE VIEW COMPONENT
 */
export const MessageView: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const listRef = useRef<List>(null);

  // Select data from Redux
  const {
    items: messages,
    selectedChatId,
    loading,
    hasMore,
    total,
  } = useSelector((state: RootState) => state.messages);

  const { searchQuery, isSearching } = useSelector((state: RootState) => state.ui);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (listRef.current && messages.length > 0) {
      listRef.current.scrollToItem(messages.length - 1, 'end');
    }
  }, [messages.length]);

  // Handle load older messages (scroll to top)
  const handleLoadOlder = useCallback(() => {
    if (selectedChatId && hasMore) {
      dispatch(fetchMessages({ chatId: selectedChatId, offset: messages.length }));
    }
  }, [selectedChatId, hasMore, messages.length, dispatch]);

  // Handle search
  const handleSearch = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const query = e.target.value;
      dispatch(setSearchQuery(query));

      if (selectedChatId && query.length > 0) {
        dispatch(setSearching(true));
        dispatch(searchMessages({ chatId: selectedChatId, query }));
      } else {
        dispatch(setSearching(false));
        // Reload original messages
        dispatch(fetchMessages({ chatId: selectedChatId || '', offset: 0 }));
      }
    },
    [selectedChatId, dispatch]
  );

  if (!selectedChatId) {
    return (
      <div className="message-view-empty">
        <p>Select a chat to start messaging</p>
      </div>
    );
  }

  return (
    <div className="message-view-container">
      <div className="message-view-header">
        <h2>Messages</h2>
        <input
          type="text"
          placeholder="Search messages..."
          value={searchQuery}
          onChange={handleSearch}
          className="search-input"
        />
      </div>

      {loading && messages.length === 0 ? (
        <div className="loading">Loading messages...</div>
      ) : messages.length === 0 ? (
        <div className="empty">No messages in this chat</div>
      ) : (
        <>
          {hasMore && (
            <button className="load-older-btn" onClick={handleLoadOlder}>
              Load older messages
            </button>
          )}

          <List
            ref={listRef}
            height={500}
            itemCount={messages.length}
            itemSize={100}
            width="100%"
            itemData={{ messages }}
          >
            {MessageRow}
          </List>

          {isSearching && (
            <div className="search-info">
              Found {messages.length} results for "{searchQuery}"
            </div>
          )}
        </>
      )}
    </div>
  );
};
