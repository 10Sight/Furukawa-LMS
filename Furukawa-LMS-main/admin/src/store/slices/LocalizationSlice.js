import { createSlice } from "@reduxjs/toolkit";

const LANGUAGE_STORAGE_KEY = "appLanguage";

const initialState = {
  language: localStorage.getItem(LANGUAGE_STORAGE_KEY) || "en",
};

const localizationSlice = createSlice({
  name: "localization",
  initialState,
  reducers: {
    setLanguage(state, action) {
      state.language = action.payload || "en";
      try {
        localStorage.setItem(LANGUAGE_STORAGE_KEY, state.language);
      } catch {
        // ignore storage errors
      }
    },
  },
});

export const { setLanguage } = localizationSlice.actions;

export const selectLanguage = (state) => state.localization?.language || "en";

export default localizationSlice.reducer;
