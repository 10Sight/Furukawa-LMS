import axiosBaseQuery from "@/Helper/axiosBaseQuery";
import { createApi } from "@reduxjs/toolkit/query/react";

export const adminHomeApi = createApi({
    reducerPath: "adminHomeApi",
    baseQuery: axiosBaseQuery,
    endpoints: (builder) => ({
        getAdminHomeDojoStats: builder.query({
            query: ({ startDate = "", endDate = "" } = {}) => ({
                url: "/api/admin-home/dojo-stats",
                method: "GET",
                params: { startDate, endDate }
            }),
            keepUnusedDataFor: 0,
        }),
        getAdminHomeHandoverStats: builder.query({
            query: ({ startDate = "", endDate = "" } = {}) => ({
                url: "/api/admin-home/handover-stats",
                method: "GET",
                params: { startDate, endDate }
            }),
            keepUnusedDataFor: 0,
        }),
        getAdminHomeTestPaperStats: builder.query({
            query: ({ startDate = "", endDate = "" } = {}) => ({
                url: "/api/admin-home/test-paper-stats",
                method: "GET",
                params: { startDate, endDate }
            }),
            keepUnusedDataFor: 0,
        }),
        getAdminHomeUserStatusStats: builder.query({
            query: ({ startDate = "", endDate = "" } = {}) => ({
                url: "/api/admin-home/user-status-stats",
                method: "GET",
                params: { startDate, endDate }
            }),
            keepUnusedDataFor: 0,
        }),
    }),
});

export const {
    useGetAdminHomeDojoStatsQuery,
    useGetAdminHomeHandoverStatsQuery,
    useGetAdminHomeTestPaperStatsQuery,
    useGetAdminHomeUserStatusStatsQuery,
} = adminHomeApi;
