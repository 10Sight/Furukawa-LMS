import axiosBaseQuery from "@/Helper/axiosBaseQuery";
import { createApi } from "@reduxjs/toolkit/query/react";

export const quizApi = createApi({
    reducerPath: "quizApi",
    baseQuery: axiosBaseQuery,
    tagTypes: ['Quiz', 'Course', 'Module', 'Lesson'], // Add Module and Lesson to tagTypes
    endpoints: (builder) => ({
        createQuiz: builder.mutation({
            query: ({ courseId, moduleId, lessonId, scope, title, questions, passingScore = 70, timeLimit, attemptsAllowed, skillUpgradation, departmentId, sectionId, lineId, subSectionId, level, issueCertificate, isDojo, isHandover, isTheoretical, conductedBy, isMultiSkilling, paperTitle, paperSubTitle, targetDeptId, targetSectionId }) => ({
                url: "/api/quizzes",
                method: "POST",
                data: {
                    courseId,
                    moduleId,
                    lessonId,
                    scope,
                    title,
                    questions,
                    passingScore,
                    departmentId,
                    sectionId,
                    ...(lineId !== undefined ? { lineId } : {}),
                    ...(subSectionId !== undefined ? { subSectionId } : {}),
                    ...(level !== undefined ? { level } : {}),
                    ...(timeLimit !== undefined ? { timeLimit } : {}),
                    ...(attemptsAllowed !== undefined ? { attemptsAllowed } : {}),
                    ...(skillUpgradation !== undefined ? { skillUpgradation } : {}),
                    ...(issueCertificate !== undefined ? { issueCertificate } : {}),
                    ...(isDojo !== undefined ? { isDojo } : {}),
                    ...(isHandover !== undefined ? { isHandover } : {}),
                    ...(isTheoretical !== undefined ? { isTheoretical } : {}),
                    ...(conductedBy !== undefined ? { conductedBy } : {}),
                    ...(isMultiSkilling !== undefined ? { isMultiSkilling } : {}),
                    ...(paperTitle !== undefined ? { paperTitle } : {}),
                    ...(paperSubTitle !== undefined ? { paperSubTitle } : {}),
                    ...(targetDeptId !== undefined ? { targetDeptId } : {}),
                    ...(targetSectionId !== undefined ? { targetSectionId } : {})
                }
            }),
            invalidatesTags: ['Quiz', 'Course', 'Module', 'Lesson'], // Invalidate all relevant caches
        }),

        getAllQuizzes: builder.query({
            query: ({ page = 1, limit = 20, search = "", courseId, departmentId, includeUnscoped, sectionId, isDojo, isHandover, isTheoretical, isMultiSkilling, skillUpgradation } = {}) => ({
                url: "/api/quizzes",
                method: "GET",
                params: {
                    page,
                    limit,
                    search,
                    ...(courseId && { courseId }),
                    ...(departmentId && { departmentId }),
                    ...(includeUnscoped !== undefined && { includeUnscoped }),
                    ...(sectionId && { sectionId }),
                    ...(isDojo !== undefined && { isDojo }),
                    ...(isHandover !== undefined && { isHandover }),
                    ...(isTheoretical !== undefined && { isTheoretical }),
                    ...(isMultiSkilling !== undefined && { isMultiSkilling }),
                    ...(skillUpgradation !== undefined && { skillUpgradation })
                }
            }),
            providesTags: (result, error, arg) => {
                // Handle different response structures
                const quizzes = result?.data?.quizzes || result?.data || [];
                return [
                    'Quiz',
                    ...(Array.isArray(quizzes) ? quizzes.map(({ _id }) => ({ type: 'Quiz', id: _id })) : [])
                ];
            },
        }),

        getQuizById: builder.query({
            query: (id) => ({
                url: `/api/quizzes/${id}`,
                method: "GET",
            }),
            providesTags: (result, error, id) => [{ type: 'Quiz', id }],
        }),

        updateQuiz: builder.mutation({
            query: ({ id, title, questions, description, passingScore, timeLimit, attemptsAllowed, skillUpgradation, departmentId, sectionId, lineId, subSectionId, level, issueCertificate, isDojo, isHandover, isTheoretical, conductedBy, isMultiSkilling, paperTitle, paperSubTitle, targetDeptId, targetSectionId }) => ({
                url: `/api/quizzes/${id}`,
                method: "PUT",
                data: {
                    title,
                    questions,
                    passingScore,
                    ...(description !== undefined ? { description } : {}),
                    ...(timeLimit !== undefined ? { timeLimit } : {}),
                    ...(attemptsAllowed !== undefined ? { attemptsAllowed } : {}),
                    ...(skillUpgradation !== undefined ? { skillUpgradation } : {}),
                    ...(departmentId !== undefined ? { departmentId } : {}),
                    ...(sectionId !== undefined ? { sectionId } : {}),
                    ...(lineId !== undefined ? { lineId } : {}),
                    ...(subSectionId !== undefined ? { subSectionId } : {}),
                    ...(level !== undefined ? { level } : {}),
                    ...(issueCertificate !== undefined ? { issueCertificate } : {}),
                    ...(isDojo !== undefined ? { isDojo } : {}),
                    ...(isHandover !== undefined ? { isHandover } : {}),
                    ...(isTheoretical !== undefined ? { isTheoretical } : {}),
                    ...(conductedBy !== undefined ? { conductedBy } : {}),
                    ...(isMultiSkilling !== undefined ? { isMultiSkilling } : {}),
                    ...(paperTitle !== undefined ? { paperTitle } : {}),
                    ...(paperSubTitle !== undefined ? { paperSubTitle } : {}),
                    ...(targetDeptId !== undefined ? { targetDeptId } : {}),
                    ...(targetSectionId !== undefined ? { targetSectionId } : {})
                }
            }),
            invalidatesTags: (result, error, arg) => [
                { type: 'Quiz', id: arg.id },
                'Quiz',
                'Course'
            ],
        }),

        deleteQuiz: builder.mutation({
            query: (id) => ({
                url: `/api/quizzes/${id}`,
                method: "DELETE",
            }),
            invalidatesTags: ['Quiz', 'Course'],
        }),

        // New scoped query endpoints
        getQuizzesByCourse: builder.query({
            query: (courseId) => ({
                url: `/api/quizzes/by-course/${courseId}`,
                method: "GET",
            }),
            providesTags: (result, error, courseId) => {
                const quizzes = result?.data || [];
                return [
                    { type: 'Course', id: courseId },
                    'Quiz',
                    ...(Array.isArray(quizzes) ? quizzes.map(({ _id }) => ({ type: 'Quiz', id: _id })) : [])
                ];
            },
        }),

        getQuizzesByModule: builder.query({
            query: (moduleId) => ({
                url: `/api/quizzes/by-module/${moduleId}`,
                method: "GET",
            }),
            providesTags: (result, error, moduleId) => {
                const quizzes = result?.data || [];
                return [
                    { type: 'Module', id: moduleId },
                    'Quiz',
                    ...(Array.isArray(quizzes) ? quizzes.map(({ _id }) => ({ type: 'Quiz', id: _id })) : [])
                ];
            },
        }),

        getQuizzesByLesson: builder.query({
            query: (lessonId) => ({
                url: `/api/quizzes/by-lesson/${lessonId}`,
                method: "GET",
            }),
            providesTags: (result, error, lessonId) => {
                const quizzes = result?.data || [];
                return [
                    { type: 'Lesson', id: lessonId },
                    'Quiz',
                    ...(Array.isArray(quizzes) ? quizzes.map(({ _id }) => ({ type: 'Quiz', id: _id })) : [])
                ];
            },
        }),
    }),
});

export const {
    useCreateQuizMutation,
    useGetAllQuizzesQuery,
    useLazyGetAllQuizzesQuery,
    useGetQuizByIdQuery,
    useUpdateQuizMutation,
    useDeleteQuizMutation,
    useGetQuizzesByCourseQuery,
    useGetQuizzesByModuleQuery,
    useGetQuizzesByLessonQuery,
} = quizApi;
