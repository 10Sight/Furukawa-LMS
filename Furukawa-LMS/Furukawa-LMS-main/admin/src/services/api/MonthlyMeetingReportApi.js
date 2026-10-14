import axiosBaseQuery from "@/services/requests/axiosBaseQuery.js";
import { createApi } from "@reduxjs/toolkit/query/react";

export const monthlyMeetingReportApi = createApi({
    reducerPath: "monthlyMeetingReportApi",
    baseQuery: axiosBaseQuery,
    tagTypes: ["MonthlyReport"],
    endpoints: (builder) => ({
        // The page's department and section tabs: every department and section, as
        // { id, name }, for anyone who may read reports — unlike getAllDepartments /
        // getSectionsByDepartment, which give a custom role only its own.
        getMonthlyReportDepartments: builder.query({
            query: () => ({
                url: "/api/monthly-report-folders/departments",
                method: "GET",
            }),
            providesTags: ["MonthlyReport"],
        }),

        getMonthlyReportSections: builder.query({
            query: (departmentId) => ({
                url: `/api/monthly-report-folders/departments/${departmentId}/sections`,
                method: "GET",
            }),
            providesTags: (result, error, departmentId) => [{ type: "MonthlyReport", id: `sections-${departmentId}` }],
        }),

        getMonthlyReportConfig: builder.query({
            query: (departmentId) => ({
                url: `/api/monthly-report-configs/${departmentId}`,
                method: "GET",
            }),
            providesTags: (result, error, departmentId) => [{ type: "MonthlyReport", id: `config-${departmentId}` }],
        }),

        saveMonthlyReportConfig: builder.mutation({
            query: ({ departmentId, shutter, sections }) => ({
                url: "/api/monthly-report-configs/save",
                method: "POST",
                data: { departmentId, shutter, sections },
            }),
            invalidatesTags: (result, error, { departmentId }) => [{ type: "MonthlyReport", id: `config-${departmentId}` }],
        }),

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

        // Re-renders a record's slides from its stored original file. The record
        // flips back to PENDING, so the panel's status polling picks up progress.
        reconvertMonthlyReportRecord: builder.mutation({
            query: ({ recordId }) => ({
                url: `/api/monthly-report-records/${recordId}/reconvert`,
                method: "POST",
            }),
            invalidatesTags: (result, error, { recordId, folderId }) => [
                { type: "MonthlyReport", id: `records-${folderId}` },
                { type: "MonthlyReport", id: `record-${recordId}` },
            ],
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
    useGetMonthlyReportDepartmentsQuery,
    useGetMonthlyReportSectionsQuery,
    useGetMonthlyReportConfigQuery,
    useSaveMonthlyReportConfigMutation,
    useGetMonthlyReportFoldersQuery,
    useCreateMonthlyReportFolderMutation,
    useDeleteMonthlyReportFolderMutation,
    useGetMonthlyReportRecordsQuery,
    useGetMonthlyReportRecordDetailQuery,
    useUploadMonthlyReportRecordMutation,
    useReconvertMonthlyReportRecordMutation,
    useDeleteMonthlyReportRecordMutation,
} = monthlyMeetingReportApi;
