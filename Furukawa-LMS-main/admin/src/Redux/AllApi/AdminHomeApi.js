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
            query: ({ startDate = "", endDate = "", departmentId = "", isDojo = "" } = {}) => ({
                url: "/api/admin-home/test-paper-stats",
                method: "GET",
                params: { startDate, endDate, departmentId, isDojo }
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
        getDojoHiringTrend: builder.query({
            query: ({ startDate = "", endDate = "", groupBy = "monthly", departmentId = "" } = {}) => ({
                url: "/api/admin-home/dojo-hiring-trend",
                method: "GET",
                params: { startDate, endDate, groupBy, departmentId }
            }),
            keepUnusedDataFor: 0,
        }),
        getDojoHandoverComparison: builder.query({
            query: ({ startDate = "", endDate = "", groupBy = "monthly", departmentId = "" } = {}) => ({
                url: "/api/admin-home/dojo-handover-comparison",
                method: "GET",
                params: { startDate, endDate, groupBy, departmentId }
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
    useGetDojoHiringTrendQuery,
    useGetDojoHandoverComparisonQuery,
} = adminHomeApi;
