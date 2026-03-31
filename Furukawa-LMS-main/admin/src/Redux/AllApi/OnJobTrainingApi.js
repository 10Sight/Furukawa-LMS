import { createApi } from "@reduxjs/toolkit/query/react";
import axiosBaseQuery from "@/Helper/axiosBaseQuery";

export const onJobTrainingApi = createApi({
    reducerPath: "onJobTrainingApi",
    baseQuery: axiosBaseQuery,
    tagTypes: ["OnJobTraining"],
    endpoints: (builder) => ({
        getStudentOJTs: builder.query({
            query: (studentId) => ({
                url: `/api/on-job-training/student/${studentId}`,
                method: "GET",
            }),
            providesTags: (result, error, studentId) => [{ type: "OnJobTraining", id: `LIST_${studentId}` }],
        }),
        getOnJobTrainingById: builder.query({
            query: (id) => ({
                url: `/api/on-job-training/${id}`,
                method: "GET",
            }),
            providesTags: (result, error, id) => [{ type: "OnJobTraining", id }],
        }),
        createOnJobTraining: builder.mutation({
            query: (data) => ({
                url: "/api/on-job-training/create",
                method: "POST",
                data,
            }),
            invalidatesTags: (result, error, { studentId }) => [{ type: "OnJobTraining", id: `LIST_${studentId}` }],
        }),
        updateOnJobTraining: builder.mutation({
            query: ({ id, data }) => ({
                url: `/api/on-job-training/${id}`,
                method: "PATCH",
                data,
            }),
            invalidatesTags: (result, error, { id, studentId }) => [
                { type: "OnJobTraining", id },
                { type: "OnJobTraining", id: `LIST_${studentId}` }
            ],
        }),
    }),
});

export const {
    useGetStudentOJTsQuery,
    useGetOnJobTrainingByIdQuery,
    useCreateOnJobTrainingMutation,
    useUpdateOnJobTrainingMutation,
} = onJobTrainingApi;
