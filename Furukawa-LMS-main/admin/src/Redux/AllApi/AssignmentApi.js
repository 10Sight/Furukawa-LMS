import axiosBaseQuery from "@/Helper/axiosBaseQuery";
import { createApi } from "@reduxjs/toolkit/query/react";

export const assignmentApi = createApi({
    reducerPath: "assignmentApi",
    baseQuery: axiosBaseQuery,
    tagTypes: ['Assignment', 'Course', 'Module', 'Lesson'], // Add Module and Lesson to tagTypes
    endpoints: (builder) => ({
        createAssignment: builder.mutation({
            query: ({ courseId, moduleId, lessonId, scope, title, description, dueDate }) => ({
                url: "/api/assignments",
                method: "POST",
                data: { 
                    courseId, 
                    moduleId, 
                    lessonId, 
                    scope, 
                    title, 
                    description, 
                    dueDate 
                }
            }),
            invalidatesTags: ['Assignment', 'Course', 'Module', 'Lesson'], // Invalidate all relevant caches
        }),

        getAllAssignments: builder.query({
            query: ({ courseId } = {}) => ({
                url: "/api/assignments",
                method: "GET",
                params: courseId ? { courseId } : {}
            }),
            providesTags: (result, error, arg) => {
                const assignments = result?.data || [];
                return [
                    'Assignment',
                    ...(Array.isArray(assignments) ? assignments.map(({ _id }) => ({ type: 'Assignment', id: _id })) : [])
                ];
            },
        }),

        getAssignmentById: builder.query({
            query: (id) => ({
                url: `/api/assignments/${id}`,
                method: "GET",
            }),
            providesTags: (result, error, id) => [{ type: 'Assignment', id }],
        }),

        updateAssignment: builder.mutation({
            query: ({ id, title, description, dueDate }) => ({
                url: `/api/assignments/${id}`,
                method: "PUT",
                data: { title, description, dueDate }
            }),
            invalidatesTags: ['Assignment', 'Course'],
        }),

        deleteAssignment: builder.mutation({
            query: (id) => ({
                url: `/api/assignments/${id}`,
                method: "DELETE",
            }),
            invalidatesTags: ['Assignment', 'Course'],
        }),

        // New scoped query endpoints
        getAssignmentsByCourse: builder.query({
            query: (courseId) => ({
                url: `/api/assignments/by-course/${courseId}`,
                method: "GET",
            }),
            providesTags: (result, error, courseId) => {
                const assignments = result?.data || [];
                return [
                    { type: 'Course', id: courseId },
                    'Assignment',
                    ...(Array.isArray(assignments) ? assignments.map(({ _id }) => ({ type: 'Assignment', id: _id })) : [])
                ];
            },
        }),

        getAssignmentsByModule: builder.query({
            query: (moduleId) => ({
                url: `/api/assignments/by-module/${moduleId}`,
                method: "GET",
            }),
            providesTags: (result, error, moduleId) => {
                const assignments = result?.data || [];
                return [
                    { type: 'Module', id: moduleId },
                    'Assignment',
                    ...(Array.isArray(assignments) ? assignments.map(({ _id }) => ({ type: 'Assignment', id: _id })) : [])
                ];
            },
        }),

        getAssignmentsByLesson: builder.query({
            query: (lessonId) => ({
                url: `/api/assignments/by-lesson/${lessonId}`,
                method: "GET",
            }),
            providesTags: (result, error, lessonId) => {
                const assignments = result?.data || [];
                return [
                    { type: 'Lesson', id: lessonId },
                    'Assignment',
                    ...(Array.isArray(assignments) ? assignments.map(({ _id }) => ({ type: 'Assignment', id: _id })) : [])
                ];
            },
        }),
    }),
});

export const {
    useCreateAssignmentMutation,
    useGetAllAssignmentsQuery,
    useGetAssignmentByIdQuery,
    useUpdateAssignmentMutation,
    useDeleteAssignmentMutation,
    useGetAssignmentsByCourseQuery,
    useGetAssignmentsByModuleQuery,
    useGetAssignmentsByLessonQuery,
} = assignmentApi;
