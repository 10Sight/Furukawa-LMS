import { createApi } from "@reduxjs/toolkit/query/react";
import axiosBaseQuery from "@/Helper/axiosBaseQuery";

export const dashboardApi = createApi({
    reducerPath: "dashboardApi",
    baseQuery: axiosBaseQuery,
    endpoints: (builder) => ({
        getDashboardStats: builder.query({
            query: ({ section, line, machine, dateRange }) => ({
                url: "/api/dashboard/stats",
                method: "GET",
                params: {
                    section,
                    line,
                    machine,
                },
            }),
            keepUnusedDataFor: 0,
        }),

        getDashboardAttendance: builder.query({
            query: ({ section, line } = {}) => ({
                url: "/api/dashboard/attendance",
                method: "GET",
                params: {
                    section: section || 'ALL',
                    line:    line    || 'ALL',
                },
            }),
            keepUnusedDataFor: 0,
        }),
    }),
});

export const {
    useGetDashboardStatsQuery,
    useGetDashboardAttendanceQuery,
} = dashboardApi;
