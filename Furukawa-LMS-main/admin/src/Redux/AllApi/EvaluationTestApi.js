import { createApi } from "@reduxjs/toolkit/query/react";
import axiosBaseQuery from "@/Helper/axiosBaseQuery";

export const EvaluationTestApi = createApi({
    reducerPath: "EvaluationTestApi",
    baseQuery: axiosBaseQuery,
    tagTypes: ["EvaluationTest", "EvaluationAttempt"],
    endpoints: (builder) => ({
        // Template APIs
        getEvaluationTests: builder.query({
            query: (params) => ({
                url: "/api/evaluation-tests",
                method: "GET",
                params,
            }),
            providesTags: ["EvaluationTest"],
        }),
        getEvaluationTestById: builder.query({
            query: (id) => ({
                url: `/api/evaluation-tests/${id}`,
                method: "GET",
            }),
            providesTags: (result, error, id) => [{ type: "EvaluationTest", id }],
        }),
        createEvaluationTest: builder.mutation({
            query: (data) => ({
                url: "/api/evaluation-tests",
                method: "POST",
                data,
            }),
            invalidatesTags: ["EvaluationTest"],
        }),
        updateEvaluationTest: builder.mutation({
            query: ({ id, ...data }) => ({
                url: `/api/evaluation-tests/${id}`,
                method: "PUT",
                data,
            }),
            invalidatesTags: (result, error, { id }) => [
                "EvaluationTest",
                { type: "EvaluationTest", id },
            ],
        }),
        deleteEvaluationTest: builder.mutation({
            query: (id) => ({
                url: `/api/evaluation-tests/${id}`,
                method: "DELETE",
            }),
            invalidatesTags: ["EvaluationTest"],
        }),

        // Student Attempts / Submissions APIs
        getEvaluationTestAttempts: builder.query({
            query: (params) => ({
                url: "/api/evaluation-tests/attempts",
                method: "GET",
                params,
            }),
            providesTags: ["EvaluationAttempt"],
        }),
        getEvaluationTestAttemptById: builder.query({
            query: (id) => ({
                url: `/api/evaluation-tests/attempts/${id}`,
                method: "GET",
            }),
            providesTags: (result, error, id) => [{ type: "EvaluationAttempt", id }],
        }),
        getEvaluationTestAttemptsByTestId: builder.query({
            query: (testId) => ({
                url: `/api/evaluation-tests/${testId}/attempts`,
                method: "GET",
            }),
            providesTags: ["EvaluationAttempt"],
        }),
        createEvaluationTestAttempt: builder.mutation({
            query: (data) => ({
                url: "/api/evaluation-tests/attempts",
                method: "POST",
                data,
            }),
            invalidatesTags: ["EvaluationAttempt"],
        }),
        updateEvaluationTestAttempt: builder.mutation({
            query: ({ id, ...data }) => ({
                url: `/api/evaluation-tests/attempts/${id}`,
                method: "PUT",
                data,
            }),
            invalidatesTags: (result, error, { id }) => [
                "EvaluationAttempt",
                { type: "EvaluationAttempt", id },
            ],
        }),
        deleteEvaluationTestAttempt: builder.mutation({
            query: (id) => ({
                url: `/api/evaluation-tests/attempts/${id}`,
                method: "DELETE",
            }),
            invalidatesTags: ["EvaluationAttempt"],
        }),
    }),
});

export const {
    useGetEvaluationTestsQuery,
    useLazyGetEvaluationTestsQuery,
    useGetEvaluationTestByIdQuery,
    useCreateEvaluationTestMutation,
    useUpdateEvaluationTestMutation,
    useDeleteEvaluationTestMutation,
    useGetEvaluationTestAttemptsQuery,
    useGetEvaluationTestAttemptByIdQuery,
    useGetEvaluationTestAttemptsByTestIdQuery,
    useCreateEvaluationTestAttemptMutation,
    useUpdateEvaluationTestAttemptMutation,
    useDeleteEvaluationTestAttemptMutation,
} = EvaluationTestApi;
