import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface UserPreferences {
  language: string;
  notifications: boolean;
  locationSharing: boolean;
  dataCollection: boolean;
}

interface UserState {
  isAuthenticated: boolean;
  user: {
    id: string;
    email: string;
    name: string;
    avatar: string;
  } | null;
  preferences: UserPreferences;
  searchHistory: Array<{
    query: string;
    timestamp: number;
    results: number;
  }>;
}

const initialState: UserState = {
  isAuthenticated: false,
  user: null,
  preferences: {
    language: "en",
    notifications: true,
    locationSharing: false,
    dataCollection: true,
  },
  searchHistory: [],
};

const userSlice = createSlice({
  name: "user",
  initialState,
  reducers: {
    setUser: (state, action: PayloadAction<UserState["user"]>) => {
      state.user = action.payload;
      state.isAuthenticated = !!action.payload;
    },
    setLanguage: (state, action: PayloadAction<string>) => {
      state.preferences.language = action.payload;
    },
    toggleNotifications: (state) => {
      state.preferences.notifications = !state.preferences.notifications;
    },
    toggleLocationSharing: (state) => {
      state.preferences.locationSharing = !state.preferences.locationSharing;
    },
    toggleDataCollection: (state) => {
      state.preferences.dataCollection = !state.preferences.dataCollection;
    },
    addSearchHistory: (
      state,
      action: PayloadAction<{
        query: string;
        results: number;
      }>
    ) => {
      state.searchHistory.unshift({
        ...action.payload,
        timestamp: Date.now(),
      });
      // Keep only the last 50 searches
      if (state.searchHistory.length > 50) {
        state.searchHistory.pop();
      }
    },
    clearSearchHistory: (state) => {
      state.searchHistory = [];
    },
    deleteAccount: (state) => {
      state.isAuthenticated = false;
      state.user = null;
      state.preferences = initialState.preferences;
      state.searchHistory = [];
    },
  },
});

export const {
  setUser,
  setLanguage,
  toggleNotifications,
  toggleLocationSharing,
  toggleDataCollection,
  addSearchHistory,
  clearSearchHistory,
  deleteAccount,
} = userSlice.actions;

export default userSlice.reducer;
