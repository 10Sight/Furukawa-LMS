import { createApi } from "@reduxjs/toolkit/query/react";
import axiosBaseQuery from "@/Helper/axiosBaseQuery";

export const AbnormalConditionApi = createApi({
    reducerPath: "AbnormalConditionApi",
    baseQuery: axiosBaseQuery,
    tagTypes: ["AbnormalCondition"],
    endpoints: (builder) => ({
        getAbnormalConditionSheet: builder.query({
            query: (params) => ({
                url: "/api/abnormal-conditions",
                method: "GET",
                params,
            }),
            providesTags: ["AbnormalCondition"],
        }),
        getAbnormalConditionList: builder.query({
            query: (params) => ({
                url: "/api/abnormal-conditions/list",
                method: "GET",
                params,
            }),
            providesTags: ["AbnormalCondition"],
        }),

        createAbnormalConditionSheet: builder.mutation({
            query: (data) => ({
                url: "/api/abnormal-conditions",
                method: "POST",
                data,
            }),
            invalidatesTags: ["AbnormalCondition"],
        }),

        updateAbnormalConditionSheet: builder.mutation({
            query: ({ id, ...data }) => ({
                url: `/api/abnormal-conditions/${id}`,
                method: "PUT",
                data,
            }),
            invalidatesTags: ["AbnormalCondition"],
        }),

        approveAbnormalConditionEntry: builder.mutation({
            query: ({ id, ...data }) => ({
                url: `/api/abnormal-conditions/${id}/approve`,
                method: "POST",
                data,
            }),
            invalidatesTags: ["AbnormalCondition"],
        }),

        deleteAbnormalConditionSheet: builder.mutation({
            query: (id) => ({
                url: `/api/abnormal-conditions/${id}`,
                method: "DELETE",
            }),
            invalidatesTags: ["AbnormalCondition"],
        }),
    }),
});

export const {
    useGetAbnormalConditionSheetQuery,
    useLazyGetAbnormalConditionSheetQuery,
    useGetAbnormalConditionListQuery,
    useLazyGetAbnormalConditionListQuery,
    useCreateAbnormalConditionSheetMutation,
    useUpdateAbnormalConditionSheetMutation,
    useApproveAbnormalConditionEntryMutation,
    useDeleteAbnormalConditionSheetMutation,
} = AbnormalConditionApi;
