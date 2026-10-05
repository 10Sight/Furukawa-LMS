import { createSlice } from "@reduxjs/toolkit";

const getTheme = (darkMode) => ({
    mainBg: darkMode ? 'bg-slate-950' : 'bg-slate-50',
    card: darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200',
    textMain: darkMode ? 'text-slate-100' : 'text-slate-800',
    textSub: darkMode ? 'text-slate-400' : 'text-slate-500',
    border: darkMode ? 'border-slate-800' : 'border-slate-200',
    tableHeader: darkMode
        ? 'bg-slate-800 text-slate-300 border-slate-700'
        : 'bg-slate-50 text-slate-700 border-slate-200',
    tableRowHover: darkMode
        ? 'hover:bg-slate-800 border-slate-800'
        : 'hover:bg-slate-50 border-slate-100',
    input: darkMode
        ? 'bg-slate-800 border-slate-700 text-slate-100 placeholder-slate-500'
        : 'bg-white border-slate-200 text-slate-900',
    iconBg: darkMode ? 'bg-slate-800' : 'bg-slate-50',
    modalOverlay: darkMode ? 'bg-slate-900/80' : 'bg-slate-900/50',
});

const savedMode = JSON.parse(localStorage.getItem("darkMode"));

const initialState = {
    darkMode: savedMode ?? false,
    theme: getTheme(savedMode ?? false),
};

const themeSlice = createSlice({
    name: "theme",
    initialState,
    reducers: {
        toggleTheme: (state) => {
            state.darkMode = !state.darkMode;
            localStorage.setItem("darkMode", state.darkMode);
            state.theme = getTheme(state.darkMode);
        },
        setDarkMode: (state, action) => {
            state.darkMode = action.payload;
            localStorage.setItem("darkMode", action.payload);
            state.theme = getTheme(action.payload);
        },
    },
});

export const { toggleTheme, setDarkMode } = themeSlice.actions;
export default themeSlice.reducer;
