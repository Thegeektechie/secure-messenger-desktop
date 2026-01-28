/**
 * UI SLICE
 * 
 * Redux slice for managing UI state that doesn't belong in other slices.
 * Handles search, filtering, and UI visibility states.
 * 
 * State shape:
 * {
 *   searchQuery: string,        // Current search text
 *   isSearching: boolean,       // Search active
 *   sidebarOpen: boolean,       // For mobile view
 * }
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface UIState {
  searchQuery: string;
  isSearching: boolean;
  sidebarOpen: boolean;
}

const initialState: UIState = {
  searchQuery: '',
  isSearching: false,
  sidebarOpen: true,
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    /**
     * SET SEARCH QUERY
     * Update search text in real-time.
     */
    setSearchQuery: (state, action: PayloadAction<string>) => {
      state.searchQuery = action.payload;
    },

    /**
     * SET SEARCHING
     * Toggle search mode active/inactive.
     */
    setSearching: (state, action: PayloadAction<boolean>) => {
      state.isSearching = action.payload;
    },

    /**
     * TOGGLE SIDEBAR
     * For mobile responsive design.
     */
    toggleSidebar: (state) => {
      state.sidebarOpen = !state.sidebarOpen;
    },

    /**
     * CLEAR UI STATE
     * Reset to initial state (on logout).
     */
    clearUI: () => initialState,
  },
});

export const { setSearchQuery, setSearching, toggleSidebar, clearUI } = uiSlice.actions;
export default uiSlice.reducer;
