import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface ThemeState {
  mode: "light" | "dark";
  primaryColor: string;
  secondaryColor: string;
  fontSize: number;
  borderRadius: number;
}

const initialState: ThemeState = {
  mode: "light",
  primaryColor: "#1976d2",
  secondaryColor: "#9c27b0",
  fontSize: 16,
  borderRadius: 8,
};

const themeSlice = createSlice({
  name: "theme",
  initialState,
  reducers: {
    toggleTheme: (state) => {
      state.mode = state.mode === "light" ? "dark" : "light";
    },
    setPrimaryColor: (state, action: PayloadAction<string>) => {
      state.primaryColor = action.payload;
    },
    setSecondaryColor: (state, action: PayloadAction<string>) => {
      state.secondaryColor = action.payload;
    },
    setFontSize: (state, action: PayloadAction<number>) => {
      state.fontSize = action.payload;
    },
    setBorderRadius: (state, action: PayloadAction<number>) => {
      state.borderRadius = action.payload;
    },
  },
});

export const {
  toggleTheme,
  setPrimaryColor,
  setSecondaryColor,
  setFontSize,
  setBorderRadius,
} = themeSlice.actions;

export default themeSlice.reducer;
