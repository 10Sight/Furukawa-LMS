import axiosBaseQuery from "@/services/requests/axiosBaseQuery.js";
import { createApi } from "@reduxjs/toolkit/query/react";

// Daily HR Meeting — Daily Manpower Report (server/routes/dailyManpowerReport.routes.js).
// Every response is the server's ApiResponse: { statuscode, data, message, success }.
const BASE = "/api/v1/daily-manpower-report";

export const dailyHrMeetingApi = createApi({
    reducerPath: "dailyHrMeetingApi",
    baseQuery: axiosBaseQuery,
    tagTypes: ["HrReport", "HrConfig", "HrAttendanceMap", "HrTraining"],
    endpoints: (builder) => ({
        getDailyManpowerReport: builder.query({
            query: ({ year, month }) => ({ url: `${BASE}/data`, method: "GET", params: { year, month } }),
            providesTags: (result, error, { year, month }) => [{ type: "HrReport", id: `${year}-${month}` }],
        }),

        // Daily Handover Report tab. Shares "HrReport" so saving the section config refreshes it too.
        getDailyHandoverReport: builder.query({
            query: ({ year, month, months = 1 }) => ({ url: `${BASE}/handover`, method: "GET", params: { year, month, months } }),
            providesTags: (result, error, { year, month, months = 1 }) => [{ type: "HrReport", id: `handover-${year}-${month}-${months}` }],
        }),

        getDailyManpowerConfig: builder.query({
            query: () => ({ url: `${BASE}/config`, method: "GET" }),
            providesTags: ["HrConfig"],
        }),

        saveDailyManpowerConfig: builder.mutation({
            query: (departments) => ({ url: `${BASE}/config`, method: "POST", data: { departments } }),
            invalidatesTags: ["HrConfig", "HrReport"],
        }),

        getAttendanceDeptMap: builder.query({
            query: ({ year, month }) => ({ url: `${BASE}/attendance-map`, method: "GET", params: { year, month } }),
            providesTags: ["HrAttendanceMap"],
        }),

        saveAttendanceDeptMap: builder.mutation({
            query: ({ year, month, mappings }) => ({ url: `${BASE}/attendance-map`, method: "POST", data: { year, month, mappings } }),
            invalidatesTags: ["HrAttendanceMap", "HrReport"],
        }),

        getTrainingInputs: builder.query({
            query: ({ year, month }) => ({ url: `${BASE}/training`, method: "GET", params: { year, month } }),
            providesTags: (result, error, { year, month }) => [{ type: "HrTraining", id: `${year}-${month}` }],
        }),

        saveTrainingInputs: builder.mutation({
            query: (payload) => ({ url: `${BASE}/training`, method: "POST", data: payload }),
            invalidatesTags: (result, error, { year, month }) => [
                { type: "HrTraining", id: `${year}-${month}` },
                { type: "HrReport", id: `${year}-${month}` },
            ],
        }),

        recalculateDailyManpowerMonth: builder.mutation({
            query: ({ year, month }) => ({ url: `${BASE}/recalculate`, method: "POST", data: { year, month } }),
            invalidatesTags: (result, error, { year, month }) => [{ type: "HrReport", id: `${year}-${month}` }],
        }),
    }),
});

export const {
    useGetDailyManpowerReportQuery,
    useGetDailyHandoverReportQuery,
    useGetDailyManpowerConfigQuery,
    useSaveDailyManpowerConfigMutation,
    useGetAttendanceDeptMapQuery,
    useSaveAttendanceDeptMapMutation,
    useGetTrainingInputsQuery,
    useSaveTrainingInputsMutation,
    useRecalculateDailyManpowerMonthMutation,
} = dailyHrMeetingApi;
