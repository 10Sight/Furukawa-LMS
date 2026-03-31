import { createSlice } from "@reduxjs/toolkit";

const initialState = {
    selectedCourse: null,
    courseFilters: {
        search: "",
        category: "",
        level: "",
        page: 1,
        limit: 10
    },
    isCreatingCourse: false,
    courseFormData: {
        title: "",
        description: "",
        category: "",
        level: "BEGINNER",
        modules: [],
        instructor: "",
        quizzes: [],
        assignments: []
    },
    bulkOperations: {
        selectedIds: [],
        isSelectAll: false,
    }
};

const courseSlice = createSlice({
    name: "course",
    initialState,
    reducers: {
        setSelectedCourse: (state, action) => {
            state.selectedCourse = action.payload;
        },
        setCourseFilters: (state, action) => {
            state.courseFilters = { ...state.courseFilters, ...action.payload };
        },
        clearCourseFilters: (state) => {
            state.courseFilters = initialState.courseFilters;
        },
        setIsCreatingCourse: (state, action) => {
            state.isCreatingCourse = action.payload;
        },
        setCourseFormData: (state, action) => {
            state.courseFormData = { ...state.courseFormData, ...action.payload };
        },
        resetCourseFormData: (state) => {
            state.courseFormData = initialState.courseFormData;
        },
        addModuleToCourse: (state, action) => {
            state.courseFormData.modules.push(action.payload);
        },
        removeModuleFromCourse: (state, action) => {
            state.courseFormData.modules = state.courseFormData.modules.filter(
                (_, index) => index !== action.payload
            );
        },
        toggleBulkSelection: (state, action) => {
            const courseId = action.payload;
            if (state.bulkOperations.selectedIds.includes(courseId)) {
                state.bulkOperations.selectedIds = state.bulkOperations.selectedIds.filter(id => id !== courseId);
            } else {
                state.bulkOperations.selectedIds.push(courseId);
            }
        },
        selectAllCourses: (state, action) => {
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
    setSelectedCourse,
    setCourseFilters,
    clearCourseFilters,
    setIsCreatingCourse,
    setCourseFormData,
    resetCourseFormData,
    addModuleToCourse,
    removeModuleFromCourse,
    toggleBulkSelection,
    selectAllCourses,
    clearBulkSelection
} = courseSlice.actions;

export default courseSlice.reducer;
