import { configureStore } from "@reduxjs/toolkit";
import themeReducer from "./slices/themeSlice";
import userReducer from "./slices/userSlice";
import searchReducer from "./slices/searchSlice";
import notificationReducer from "./slices/notificationSlice";

export const store = configureStore({
  reducer: {
    theme: themeReducer,
    user: userReducer,
    search: searchReducer,
    notifications: notificationReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
