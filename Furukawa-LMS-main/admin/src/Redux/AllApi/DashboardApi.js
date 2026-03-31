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
                    // Parse dateRange if passed to compatible format if needed
                    // For now, dateRange is handled loosely or not in controller yet
                },
            }),
            keepUnusedDataFor: 0, // Disable caching for real-time updates or manage tags
        }),
    }),
});

export const { useGetDashboardStatsQuery } = dashboardApi;
