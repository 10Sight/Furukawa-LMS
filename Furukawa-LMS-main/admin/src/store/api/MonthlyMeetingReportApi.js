import axiosBaseQuery from "@/Helper/axiosBaseQuery";
import { createApi } from "@reduxjs/toolkit/query/react";

export const monthlyMeetingReportApi = createApi({
    reducerPath: "monthlyMeetingReportApi",
    baseQuery: axiosBaseQuery,
    tagTypes: ["MonthlyReport"],
    endpoints: (builder) => ({
        getMonthlyReportFolders: builder.query({
            query: (sectionId) => ({
                url: `/api/monthly-report-folders/section/${sectionId}`,
                method: "GET",
            }),
            providesTags: (result, error, sectionId) => [{ type: "MonthlyReport", id: `folders-${sectionId}` }],
        }),

        createMonthlyReportFolder: builder.mutation({
            query: ({ departmentId, sectionId, name, color }) => ({
                url: "/api/monthly-report-folders",
                method: "POST",
                data: { departmentId, sectionId, name, color },
            }),
            invalidatesTags: (result, error, { sectionId }) => [{ type: "MonthlyReport", id: `folders-${sectionId}` }],
        }),

        deleteMonthlyReportFolder: builder.mutation({
            query: ({ folderId }) => ({
                url: `/api/monthly-report-folders/${folderId}`,
                method: "DELETE",
            }),
            invalidatesTags: (result, error, { sectionId }) => [{ type: "MonthlyReport", id: `folders-${sectionId}` }],
        }),

        getMonthlyReportRecords: builder.query({
            query: (folderId) => ({
                url: `/api/monthly-report-records/folder/${folderId}`,
                method: "GET",
            }),
            providesTags: (result, error, folderId) => [{ type: "MonthlyReport", id: `records-${folderId}` }],
        }),

        // Caller controls `pollingInterval` (e.g. keep polling while
        // conversionStatus is PENDING/PROCESSING, stop once DONE/FAILED).
        getMonthlyReportRecordDetail: builder.query({
            query: (recordId) => ({
                url: `/api/monthly-report-records/${recordId}`,
                method: "GET",
            }),
            providesTags: (result, error, recordId) => [{ type: "MonthlyReport", id: `record-${recordId}` }],
        }),

        uploadMonthlyReportRecord: builder.mutation({
            // `data` is a FormData instance (folderId, title, month, year, file) —
            // axiosInstance sets the multipart Content-Type automatically, same
            // pattern as resourceApi.js's createResource.
            query: (formData) => ({
                url: "/api/monthly-report-records",
                method: "POST",
                data: formData,
            }),
            invalidatesTags: (result) => result?.data?.folderId
                ? [{ type: "MonthlyReport", id: `records-${result.data.folderId}` }]
                : [],
        }),

        deleteMonthlyReportRecord: builder.mutation({
            query: ({ recordId }) => ({
                url: `/api/monthly-report-records/${recordId}`,
                method: "DELETE",
            }),
            invalidatesTags: (result, error, { folderId }) => [{ type: "MonthlyReport", id: `records-${folderId}` }],
        }),
    }),
});

export const {
    useGetMonthlyReportFoldersQuery,
    useCreateMonthlyReportFolderMutation,
    useDeleteMonthlyReportFolderMutation,
    useGetMonthlyReportRecordsQuery,
    useGetMonthlyReportRecordDetailQuery,
    useUploadMonthlyReportRecordMutation,
    useDeleteMonthlyReportRecordMutation,
} = monthlyMeetingReportApi;
