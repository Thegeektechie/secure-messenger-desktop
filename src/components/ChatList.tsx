'use client';

/**
 * CHAT LIST COMPONENT
 * 
 * Purpose: Display list of chats with virtualization for performance.
 * 
 * Performance Optimizations:
 * - react-window for virtualizing 200+ chats (only renders visible items)
 * - Pagination to avoid loading all chats at once
 * - Memoization to prevent unnecessary re-renders
 * - Efficient CSS selectors
 * 
 * Features:
 * - Sorted by most recent message
 * - Display unread count badge
 * - Click to select chat
 * - Load more on scroll
 * - Responsive design
 */

import React, { useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { FixedSizeList as List } from 'react-window';
import {
  fetchChats,
  markChatRead,
  incrementChatUnread,
} from '../store/slices/chatsSlice';
import { setSelectedChat, fetchMessages, clearMessages } from '../store/slices/messagesSlice';
import { RootState, AppDispatch } from '../store/store';
import './ChatList.css';

/**
 * CHAT LIST ROW COMPONENT
 * 
 * Rendered by react-window for each visible chat.
 * Keeps this component pure to avoid re-renders.
 */
const ChatRow = React.memo(
  ({
    index,
    style,
    data,
  }: {
    index: number;
    style: React.CSSProperties;
    data: any;
  }) => {
    const chat = data.chats[index];
    if (!chat) return null;

    const isSelected = data.selectedChatId === chat.id;

    const handleClick = () => {
      data.onSelectChat(chat.id);
    };

    const formatTime = (ts: number) => {
      const date = new Date(ts);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) return 'now';
      if (diffMins < 60) return `${diffMins}m`;
      if (diffHours < 24) return `${diffHours}h`;
      if (diffDays < 7) return `${diffDays}d`;
      return date.toLocaleDateString();
    };

    return (
      <div
        style={style}
        className={`chat-row ${isSelected ? 'selected' : ''}`}
        onClick={handleClick}
      >
        <div className="chat-content">
          <div className="chat-header">
            <h3 className="chat-title">{chat.title}</h3>
            <span className="chat-time">{formatTime(chat.lastMessageAt)}</span>
          </div>
          <p className="chat-preview">Last message...</p>
        </div>
        {chat.unreadCount > 0 && (
          <div className="unread-badge">{chat.unreadCount}</div>
        )}
      </div>
    );
  }
);

ChatRow.displayName = 'ChatRow';

/**
 * MAIN CHAT LIST COMPONENT
 */
export const ChatList: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();

  // Select data from Redux store
  const { items: chats, loading, hasMore, total } = useSelector(
    (state: RootState) => state.chats
  );
  const selectedChatId = useSelector(
    (state: RootState) => state.messages.selectedChatId
  );

  // Load chats on component mount
  useEffect(() => {
    dispatch(fetchChats(0));
  }, [dispatch]);

  // Handle chat selection
  const handleSelectChat = useCallback(
    (chatId: string) => {
      // Mark as read
      dispatch(markChatRead(chatId));

      // Clear old messages and fetch new ones
      dispatch(clearMessages());
      dispatch(setSelectedChat(chatId));
      dispatch(fetchMessages({ chatId, offset: 0 }));
    },
    [dispatch]
  );

  // Prepare data for virtualized list
  const itemData = {
    chats,
    selectedChatId,
    onSelectChat: handleSelectChat,
  };

  return (
    <div className="chat-list-container">
      <div className="chat-list-header">
        <h2>Chats</h2>
        <span className="chat-count">{total} total</span>
      </div>

      {loading && chats.length === 0 ? (
        <div className="loading">Loading chats...</div>
      ) : chats.length === 0 ? (
        <div className="empty">No chats found</div>
      ) : (
        <List
          height={600}
          itemCount={chats.length}
          itemSize={80}
          width="100%"
          itemData={itemData}
        >
          {ChatRow}
        </List>
      )}

      {hasMore && (
        <button className="load-more-btn" onClick={() => dispatch(fetchChats(chats.length))}>
          Load more chats
        </button>
      )}
    </div>
  );
};
