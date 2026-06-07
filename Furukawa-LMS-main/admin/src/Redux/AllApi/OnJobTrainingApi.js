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
        getAllOnJobTrainings: builder.query({
            query: (params) => ({
                url: "/api/on-job-training",
                method: "GET",
                params,
            }),
            providesTags: (result) => 
                result 
                    ? [
                        ...result.data.map(({ id }) => ({ type: "OnJobTraining", id })),
                        { type: "OnJobTraining", id: "LIST" }
                      ]
                    : [{ type: "OnJobTraining", id: "LIST" }],
        }),
        createOnJobTraining: builder.mutation({
            query: (data) => ({
                url: "/api/on-job-training/create",
                method: "POST",
                data,
            }),
            invalidatesTags: (result, error, { studentId }) => [
                { type: "OnJobTraining", id: `LIST_${studentId}` },
                { type: "OnJobTraining", id: "LIST" }
            ],
        }),
        updateOnJobTraining: builder.mutation({
            query: ({ id, data }) => ({
                url: `/api/on-job-training/${id}`,
                method: "PATCH",
                data,
            }),
            invalidatesTags: (result, error, { id, studentId }) => [
                { type: "OnJobTraining", id },
                { type: "OnJobTraining", id: `LIST_${studentId}` },
                { type: "OnJobTraining", id: "LIST" }
            ],
        }),
        deleteOnJobTraining: builder.mutation({
            query: (id) => ({
                url: `/api/on-job-training/${id}`,
                method: "DELETE",
            }),
            invalidatesTags: ["OnJobTraining"],
        }),
    }),
});

export const {
    useGetStudentOJTsQuery,
    useGetOnJobTrainingByIdQuery,
    useGetAllOnJobTrainingsQuery,
    useCreateOnJobTrainingMutation,
    useUpdateOnJobTrainingMutation,
    useDeleteOnJobTrainingMutation,
} = onJobTrainingApi;
