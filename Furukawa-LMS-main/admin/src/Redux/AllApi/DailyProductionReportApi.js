import { createApi } from "@reduxjs/toolkit/query/react";
import axiosBaseQuery from "@/Helper/axiosBaseQuery";

export const DailyProductionReportApi = createApi({
    reducerPath: "DailyProductionReportApi",
    baseQuery: axiosBaseQuery,
    tagTypes: ["DailyProductionReport", "DailyProductionReportConfig", "DailyProductionReportConfigHistory"],
    endpoints: (builder) => ({
        getDailyProductionReport: builder.query({
            query: (params) => ({
                url: "/api/daily-production-report",
                method: "GET",
                params, // { date, department, line, shift }
            }),
            providesTags: ["DailyProductionReport"],
        }),

        saveDailyProductionReport: builder.mutation({
            query: (data) => ({
                url: "/api/daily-production-report",
                method: "POST",
                data,
            }),
            invalidatesTags: ["DailyProductionReport"],
        }),

        getDPRConfig: builder.query({
            query: (departmentId) => ({
                url: `/api/daily-production-report/config/${departmentId}`,
                method: "GET",
            }),
            providesTags: ["DailyProductionReportConfig"],
        }),

        saveDPRConfig: builder.mutation({
            query: (data) => ({
                url: "/api/daily-production-report/config/save",
                method: "POST",
                data,
            }),
            invalidatesTags: ["DailyProductionReportConfig"],
        }),

        getDPRConfigHistory: builder.query({
            query: (departmentId) => ({
                url: `/api/daily-production-report/history/${departmentId}`,
                method: "GET",
            }),
            providesTags: ["DailyProductionReportConfigHistory"],
        }),
    }),
});

export const {
    useGetDailyProductionReportQuery,
    useLazyGetDailyProductionReportQuery,
    useSaveDailyProductionReportMutation,
    useGetDPRConfigQuery,
    useSaveDPRConfigMutation,
    useGetDPRConfigHistoryQuery,
} = DailyProductionReportApi;
