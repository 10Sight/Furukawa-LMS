import axiosBaseQuery from "@/Helper/axiosBaseQuery";
import { createApi } from "@reduxjs/toolkit/query/react";

export const enrollmentApi = createApi({
    reducerPath: "enrollmentApi",
    baseQuery: axiosBaseQuery,
    tagTypes: ['Enrollment'],
    endpoints: (builder) => ({
        enrollStudent: builder.mutation({
            query: ({ courseId, studentId }) => ({
                url: "/api/enrollments",
                method: "POST",
                data: { courseId, studentId }
            }),
            invalidatesTags: ['Enrollment'],
        }),

        unenrollStudent: builder.mutation({
            query: ({ courseId, studentId }) => ({
                url: "/api/enrollments/unenroll",
                method: "POST",
                data: { courseId, studentId }
            }),
            invalidatesTags: ['Enrollment'],
        }),

        getAllEnrollments: builder.query({
            query: ({ page = 1, limit = 20, search = "" } = {}) => ({
                url: "/api/enrollments",
                method: "GET",
                params: { page, limit, search }
            }),
            providesTags: ['Enrollment'],
        }),

        getStudentEnrollments: builder.query({
            query: (studentId) => ({
                url: `/api/enrollments/student/${studentId}`,
                method: "GET",
            }),
            providesTags: (result, error, studentId) => [{ type: 'Enrollment', id: studentId }],
        }),

        getCourseEnrollments: builder.query({
            query: (courseId) => ({
                url: `/api/enrollments/course/${courseId}`,
                method: "GET",
            }),
            providesTags: (result, error, courseId) => [{ type: 'Enrollment', id: courseId }],
        }),

        updateEnrollment: builder.mutation({
            query: ({ id, status }) => ({
                url: `/api/enrollments/${id}`,
                method: "PUT",
                data: { status }
            }),
            invalidatesTags: ['Enrollment'],
        }),

        deleteEnrollment: builder.mutation({
            query: (id) => ({
                url: `/api/enrollments/${id}`,
                method: "DELETE",
            }),
            invalidatesTags: ['Enrollment'],
        }),
    }),
});

export const {
    useEnrollStudentMutation,
    useUnenrollStudentMutation,
    useGetAllEnrollmentsQuery,
    useGetStudentEnrollmentsQuery,
    useGetCourseEnrollmentsQuery,
    useUpdateEnrollmentMutation,
    useDeleteEnrollmentMutation,
} = enrollmentApi;
