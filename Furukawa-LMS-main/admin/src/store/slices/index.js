// Auth slice exports
export {
    login,
    register,
    logout,
    forgotPassword,
    resetPassword,
    profile,
    default as authSlice
} from './AuthSlice';

// User slice exports
export {
    setUserFilters,
    setCurrentPage,
    clearUserFilters,
    setSelectedUsers,
    toggleBulkSelection,
    selectAllUsers,
    clearBulkSelection,
    default as userSlice
} from './UserSlice';

// Course slice exports
export {
    setSelectedCourse,
    setCourseFilters,
    clearCourseFilters,
    setIsCreatingCourse,
    setCourseFormData,
    resetCourseFormData,
    addModuleToCourse,
    removeModuleFromCourse,
    toggleBulkSelection as toggleCourseBulkSelection,
    selectAllCourses,
    clearBulkSelection as clearCourseBulkSelection,
    default as courseSlice
} from './CourseSlice';

// Localization slice exports
export {
    setLanguage,
    selectLanguage,
    default as localizationSlice,
} from './LocalizationSlice';
