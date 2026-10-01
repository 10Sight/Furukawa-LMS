import { createSlice } from "@reduxjs/toolkit";

const initialState = {
    selectedUsers: [],
    userFilters: {
        search: "",
        role: "",
        sortBy: "createdAt",
        order: "desc"
    },
    currentPage: 1,
    bulkOperations: {
        selectedIds: [],
        isSelectAll: false,
    }
};

const userSlice = createSlice({
    name: "user",
    initialState,
    reducers: {
        setUserFilters: (state, action) => {
            state.userFilters = { ...state.userFilters, ...action.payload };
        },
        setCurrentPage: (state, action) => {
            state.currentPage = action.payload;
        },
        clearUserFilters: (state) => {
            state.userFilters = initialState.userFilters;
            state.currentPage = 1;
        },
        setSelectedUsers: (state, action) => {
            state.selectedUsers = action.payload;
        },
        toggleBulkSelection: (state, action) => {
            const userId = action.payload;
            if (state.bulkOperations.selectedIds.includes(userId)) {
                state.bulkOperations.selectedIds = state.bulkOperations.selectedIds.filter(id => id !== userId);
            } else {
                state.bulkOperations.selectedIds.push(userId);
            }
        },
        selectAllUsers: (state, action) => {
            state.bulkOperations.isSelectAll = action.payload;
            if (!action.payload) {
                state.bulkOperations.selectedIds = [];
            }
        },
        clearBulkSelection: (state) => {
            state.bulkOperations.selectedIds = [];
            state.bulkOperations.isSelectAll = false;
        }
    },
});

export const {
    setUserFilters,
    setCurrentPage,
    clearUserFilters,
    setSelectedUsers,
    toggleBulkSelection,
    selectAllUsers,
    clearBulkSelection
} = userSlice.actions;

export default userSlice.reducer;
