import axiosBaseQuery from "@/Helper/axiosBaseQuery";
import { createApi } from "@reduxjs/toolkit/query/react";

export const submissionApi = createApi({
    reducerPath: "submissionApi",
    baseQuery: axiosBaseQuery,
    tagTypes: ['Submission'],
    endpoints: (builder) => ({
        createSubmission: builder.mutation({
            query: ({ assignmentId, fileUrl }) => ({
                url: "/api/submissions",
                method: "POST",
                data: { assignmentId, fileUrl }
            }),
            invalidatesTags: ['Submission'],
        }),

        resubmitAssignment: builder.mutation({
            query: ({ submissionId, fileUrl }) => ({
                url: "/api/submissions/resubmit",
                method: "PATCH",
                data: { submissionId, fileUrl }
            }),
            invalidatesTags: ['Submission'],
        }),

        getSubmissionByAssignment: builder.query({
            query: (assignmentId) => ({
                url: `/api/submissions/assignment/${assignmentId}`,
                method: "GET",
            }),
            providesTags: (result, error, assignmentId) => [{ type: 'Submission', id: assignmentId }],
        }),

        getMySubmissions: builder.query({
            query: () => ({
                url: "/api/submissions/my",
                method: "GET",
            }),
            providesTags: ['Submission'],
        }),

        gradeSubmission: builder.mutation({
            query: ({ submissionId, grade, feedback }) => ({
                url: `/api/submissions/grade/${submissionId}`,
                method: "PATCH",
                data: { grade, feedback }
            }),
            invalidatesTags: ['Submission'],
        }),

        getStudentSubmissions: builder.query({
            query: (studentId) => ({
                url: `/api/submissions/student/${studentId}`,
                method: "GET",
            }),
            providesTags: (result, error, studentId) => [{ type: 'Submission', id: `student-${studentId}` }],
        }),
    }),
});

export const {
    useCreateSubmissionMutation,
    useResubmitAssignmentMutation,
    useGetSubmissionByAssignmentQuery,
    useGetMySubmissionsQuery,
    useGradeSubmissionMutation,
    useGetStudentSubmissionsQuery,
} = submissionApi;
