import { createApi } from "@reduxjs/toolkit/query/react";
import axiosBaseQuery from "@/Helper/axiosBaseQuery";

export const multiSkillingApi = createApi({
    reducerPath: "multiSkillingApi",
    baseQuery: axiosBaseQuery,
    tagTypes: ["MultiSkilling"],
    endpoints: (builder) => ({
        getMultiSkillingPlan: builder.query({
            query: ({ departmentId, sectionId }) => ({
                url: `/api/multi-skilling/department/${departmentId}`,
                method: "GET",
                params: { sectionId },
            }),
            providesTags: (result, error, { departmentId, sectionId }) => [
                { type: "MultiSkilling", id: `${departmentId}-${sectionId}` }
            ],
        }),
        saveMultiSkillingPlan: builder.mutation({
            query: ({ departmentId, data }) => ({
                url: `/api/multi-skilling/department/${departmentId}`,
                method: "POST",
                data: data,
            }),
            invalidatesTags: (result, error, { departmentId, data }) => [
                { type: "MultiSkilling", id: `${departmentId}-${data.sectionId}` }
            ],
        }),
        getMultiSkillingConfig: builder.query({
            query: (departmentId) => ({
                url: `/api/multi-skilling/config/${departmentId}`,
                method: "GET",
            }),
            providesTags: ["MultiSkilling"],
        }),
        saveMultiSkillingConfig: builder.mutation({
            query: (data) => ({
                url: "/api/multi-skilling/config/save",
                method: "POST",
                data: data,
            }),
            invalidatesTags: ["MultiSkilling"],
        }),
        getMultiSkillingHistory: builder.query({
            query: (departmentId) => ({
                url: `/api/multi-skilling/history/${departmentId}`,
                method: "GET",
            }),
            providesTags: ["MultiSkilling"],
        }),
    }),
});

export const {
    useGetMultiSkillingPlanQuery,
    useSaveMultiSkillingPlanMutation,
    useGetMultiSkillingConfigQuery,
    useSaveMultiSkillingConfigMutation,
    useGetMultiSkillingHistoryQuery,
} = multiSkillingApi;
