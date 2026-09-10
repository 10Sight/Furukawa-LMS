import axiosBaseQuery from "@/Helper/axiosBaseQuery";
import { createApi } from "@reduxjs/toolkit/query/react";

export const departmentApi = createApi({
    reducerPath: "departmentApi",
    baseQuery: axiosBaseQuery,
    tagTypes: ['Department'],
    endpoints: (builder) => ({
        createDepartment: builder.mutation({
            query: ({ name, uniCode, instructorId, courseId, courseIds, startDate, endDate, capacity }) => ({
                url: "/api/departments",
                method: "POST",
                data: { name, uniCode, instructorId, courseId, courseIds, startDate, endDate, capacity }
            }),
            invalidatesTags: ['Department'],
        }),

        assignInstructor: builder.mutation({
            query: ({ departmentId, instructorId }) => ({
                url: "/api/departments/assign-instructor",
                method: "POST",
                data: { departmentId, instructorId }
            }),
            invalidatesTags: ['Department'],
        }),

        removeInstructor: builder.mutation({
            query: (departmentId) => ({
                url: "/api/departments/remove-instructor",
                method: "POST",
                data: { departmentId }
            }),
            invalidatesTags: ['Department'],
        }),

        addStudentToDepartment: builder.mutation({
            // Add student to department (supports single studentId or bulk studentIds)
            query: ({ departmentId, studentId, studentIds }) => ({
                url: "/api/departments/add-student",
                method: "POST",
                data: { departmentId, studentId, studentIds }
            }),
            invalidatesTags: ['Department'],
        }),

        removeStudentFromDepartment: builder.mutation({
            query: ({ departmentId, studentId }) => ({
                url: "/api/departments/remove-student",
                method: "POST",
                data: { departmentId, studentId }
            }),
            invalidatesTags: ['Department'],
        }),

        getAllDepartments: builder.query({
            query: ({ page = 1, limit = 30, search = "", status = "" } = {}) => ({
                url: "/api/departments",
                method: "GET",
                params: { page, limit, search, status }
            }),
            serializeQueryArgs: ({ queryArgs }) => {
                const { search = "", status = "" } = queryArgs || {};
                return { search, status };
            },
            merge: (currentCache, newData, { arg }) => {
                if (!arg?.page || arg.page === 1) {
                    return newData;
                }
                currentCache.data.departments.push(...newData.data.departments);
                currentCache.data.currentPage = newData.data.currentPage;
            },
            forceRefetch: ({ currentArg, previousArg }) => currentArg?.page !== previousArg?.page,
            providesTags: ['Department'],
        }),

        getDepartmentById: builder.query({
            query: (id) => ({
                url: `/api/departments/${id}`,
                method: "GET",
            }),
            providesTags: (result, error, id) => [{ type: 'Department', id }],
        }),

        getDepartmentTrainees: builder.query({
            query: ({ id, page = 1, limit = 20, search = "", status = "" }) => ({
                url: `/api/departments/${id}/trainees`,
                method: "GET",
                params: { page, limit, search, status }
            }),
            providesTags: (result, error, { id }) => [{ type: 'Department', id: `trainees-${id}` }],
        }),

        updateDepartment: builder.mutation({
            query: ({ id, data }) => ({
                url: `/api/departments/${id}`,
                method: "PUT",
                data: data
            }),
            invalidatesTags: ['Department'],
        }),

        deleteDepartment: builder.mutation({
            query: (id) => ({
                url: `/api/departments/${id}`,
                method: "DELETE",
            }),
            invalidatesTags: ['Department'],
        }),

        getDepartmentProgress: builder.query({
            query: ({ departmentId, page = 1, limit = 20, search = "", sectionId, lineId, subSectionId, stationId }) => ({
                url: `/api/departments/${departmentId}/progress`,
                method: "GET",
                params: { page, limit, search, sectionId, lineId, subSectionId, stationId }
            }),
            providesTags: (result, error, { departmentId }) => [{ type: 'Department', id: `progress-${departmentId}` }],
        }),

        getAllDepartmentsProgress: builder.query({
            query: () => ({
                url: "/api/departments/progress/all",
                method: "GET",
            }),
            providesTags: ['Department'],
        }),

        getDepartmentSubmissions: builder.query({
            query: ({ departmentId, page = 1, limit = 20, search = "" }) => ({
                url: `/api/departments/${departmentId}/submissions`,
                method: "GET",
                params: { page, limit, search }
            }),
            providesTags: (result, error, { departmentId }) => [{ type: 'Department', id: `submissions-${departmentId}` }],
        }),

        getDepartmentAttempts: builder.query({
            query: ({ departmentId, page = 1, limit = 20, search = "" }) => ({
                url: `/api/departments/${departmentId}/attempts`,
                method: "GET",
                params: { page, limit, search }
            }),
            providesTags: (result, error, { departmentId }) => [{ type: 'Department', id: `attempts-${departmentId}` }],
        }),

        // Super Admin functions
        getSoftDeletedDepartments: builder.query({
            query: ({ page = 1, limit = 20, search = "" } = {}) => ({
                url: "/api/departments/deleted/all",
                method: "GET",
                params: { page, limit, search }
            }),
            providesTags: ['Department'],
        }),

        restoreDepartment: builder.mutation({
            query: (id) => ({
                url: `/api/departments/deleted/${id}/restore`,
                method: "PATCH",
            }),
            invalidatesTags: ['Department'],
        }),

        cancelDepartment: builder.mutation({
            query: ({ id, reason }) => ({
                url: `/api/departments/${id}/cancel`,
                method: "POST",
                data: { reason }
            }),
            invalidatesTags: ['Department'],
        }),

        getMyDepartments: builder.query({
            query: () => ({
                url: "/api/departments/me/my-departments",
                method: "GET",
            }),
            providesTags: ['Department'],
        }),

        exportDepartments: builder.query({
            query: ({ format = 'excel', search = '', status = '' } = {}) => ({
                url: `/api/exports/departments`,
                method: "GET",
                params: { format, search, status },
                responseHandler: (response) => response.data
            }),
            keepUnusedDataFor: 0,
        }),

        getHandoverSheetsMonitoring: builder.query({
            query: ({ departmentId = 'all', sectionId = 'all', month = 'all', year = 'all', shift = 'all' } = {}) => ({
                url: "/api/departments/handover-sheet/monitoring",
                method: "GET",
                params: { departmentId, sectionId, month, year, shift }
            }),
            providesTags: ['Department'],
        }),

        deleteHandoverSheet: builder.mutation({
            query: (id) => ({
                url: `/api/departments/handover-sheet/${id}`,
                method: "DELETE",
            }),
            invalidatesTags: ['Department'],
        }),

        bulkDeleteHandoverSheets: builder.mutation({
            query: (ids) => ({
                url: "/api/departments/handover-sheet/bulk-delete",
                method: "POST",
                data: { ids }
            }),
            invalidatesTags: ['Department'],
        }),

        getDojoHiringConfigs: builder.query({
            query: () => ({
                url: "/api/departments/dojo-hiring/configs",
                method: "GET",
            }),
            providesTags: ['Department'],
        }),

        saveDojoHiringConfig: builder.mutation({
            query: (config) => ({
                url: "/api/departments/dojo-hiring/config",
                method: "POST",
                data: config
            }),
            invalidatesTags: ['Department'],
        }),

        getDailyMeetingConfig: builder.query({
            query: (departmentId) => ({
                url: `/api/daily-meeting-configs/${departmentId}`,
                method: "GET",
            }),
            providesTags: (result, error, departmentId) => [{ type: 'Department', id: `daily-meeting-config-${departmentId}` }],
        }),

        saveDailyMeetingConfig: builder.mutation({
            query: ({ departmentId, shutter, sections }) => ({
                url: `/api/daily-meeting-configs/save`,
                method: "POST",
                data: { departmentId, shutter, sections }
            }),
            invalidatesTags: (result, error, { departmentId }) => [{ type: 'Department', id: `daily-meeting-config-${departmentId}` }],
        }),

        getDailyMeetingSheet: builder.query({
            query: (sectionId) => ({
                url: `/api/daily-meeting-sheets/${sectionId}`,
                method: "GET",
            }),
            providesTags: (result, error, sectionId) => [{ type: 'Department', id: `daily-meeting-sheet-${sectionId}` }],
        }),

        saveDailyMeetingSheet: builder.mutation({
            query: ({ sectionId, sheets, activeSheet }) => ({
                url: `/api/daily-meeting-sheets/save`,
                method: "POST",
                data: { sectionId, sheets, activeSheet }
            }),
            invalidatesTags: (result, error, { sectionId }) => [{ type: 'Department', id: `daily-meeting-sheet-${sectionId}` }],
        }),

        getDailyMorningMeetings: builder.query({
            query: ({ sectionId, scope }) => ({
                url: `/api/daily-morning-meetings/section/${sectionId}${scope ? `?scope=${scope}` : ""}`,
                method: "GET",
            }),
            providesTags: (result, error, { sectionId }) => [{ type: 'Department', id: `daily-morning-meetings-${sectionId}` }],
        }),

        getDailyMorningMeetingDetail: builder.query({
            query: (meetingId) => ({
                url: `/api/daily-morning-meetings/${meetingId}`,
                method: "GET",
            }),
            providesTags: (result, error, meetingId) => [{ type: 'Department', id: `daily-morning-meeting-${meetingId}` }],
        }),

        createDailyMorningMeeting: builder.mutation({
            query: ({ sectionId, agenda, description }) => ({
                url: `/api/daily-morning-meetings`,
                method: "POST",
                data: { sectionId, agenda, description }
            }),
            invalidatesTags: (result, error, { sectionId }) => [{ type: 'Department', id: `daily-morning-meetings-${sectionId}` }],
        }),

        cloneDailyMorningMeeting: builder.mutation({
            query: ({ meetingId, agenda, description }) => ({
                url: `/api/daily-morning-meetings/${meetingId}/clone`,
                method: "POST",
                data: { agenda, description }
            }),
            invalidatesTags: (result, error, { sectionId }) => [{ type: 'Department', id: `daily-morning-meetings-${sectionId}` }],
            // The response already carries the new meeting's sheets/activeSheet (the
            // clone endpoint returns the same shape getDailyMorningMeetingDetail does) —
            // seed that query's cache directly instead of letting the UI navigate to the
            // new meeting and wait on a separate GET, which was landing on an empty sheet
            // the first time it opened.
            async onQueryStarted(arg, { dispatch, queryFulfilled }) {
                try {
                    const { data: response } = await queryFulfilled;
                    if (response?.data?.id) {
                        dispatch(
                            departmentApi.util.upsertQueryData('getDailyMorningMeetingDetail', String(response.data.id), response)
                        );
                    }
                } catch {
                    // Clone failed — nothing to seed; the error is surfaced via .unwrap() at the call site.
                }
            },
        }),

        updateDailyMorningMeeting: builder.mutation({
            query: ({ meetingId, agenda, description }) => ({
                url: `/api/daily-morning-meetings/${meetingId}`,
                method: "PUT",
                data: { agenda, description }
            }),
            invalidatesTags: (result, error, { meetingId, sectionId }) => [
                { type: 'Department', id: `daily-morning-meeting-${meetingId}` },
                { type: 'Department', id: `daily-morning-meetings-${sectionId}` }
            ],
        }),

        saveDailyMorningMeetingSheet: builder.mutation({
            query: ({ meetingId, sheets, activeSheet }) => ({
                url: `/api/daily-morning-meetings/${meetingId}/sheet`,
                method: "POST",
                data: { sheets, activeSheet }
            }),
            invalidatesTags: (result, error, { meetingId }) => [{ type: 'Department', id: `daily-morning-meeting-${meetingId}` }],
        }),

        deleteDailyMorningMeeting: builder.mutation({
            query: ({ meetingId }) => ({
                url: `/api/daily-morning-meetings/${meetingId}`,
                method: "DELETE",
            }),
            invalidatesTags: (result, error, { sectionId }) => [{ type: 'Department', id: `daily-morning-meetings-${sectionId}` }],
        }),

        migrateDailyMorningMeetingToM365: builder.mutation({
            query: ({ meetingId }) => ({
                url: `/api/daily-morning-meetings/${meetingId}/migrate-to-m365`,
                method: "POST",
            }),
            invalidatesTags: (result, error, { meetingId }) => [{ type: 'Department', id: `daily-morning-meeting-${meetingId}` }],
        }),

        refreshDailyMorningMeetingEmbedUrl: builder.mutation({
            query: ({ meetingId }) => ({
                url: `/api/daily-morning-meetings/${meetingId}/refresh-embed-url`,
                method: "POST",
            }),
            invalidatesTags: (result, error, { meetingId }) => [{ type: 'Department', id: `daily-morning-meeting-${meetingId}` }],
        }),

        // Not cached via providesTags/invalidatesTags — this is a manual, on-demand
        // "pull the latest values from Excel Online" snapshot, not part of the
        // meeting record itself.
        getDailyMorningMeetingM365Snapshot: builder.query({
            query: (meetingId) => ({
                url: `/api/daily-morning-meetings/${meetingId}/m365-snapshot`,
                method: "GET",
            }),
        }),
    }),
});

export const {
    useCreateDepartmentMutation,
    useAssignInstructorMutation,
    useRemoveInstructorMutation,
    useAddStudentToDepartmentMutation,
    useRemoveStudentFromDepartmentMutation,
    useGetAllDepartmentsQuery,
    useGetDepartmentByIdQuery,
    useGetDepartmentTraineesQuery,
    useUpdateDepartmentMutation,
    useDeleteDepartmentMutation,
    useGetDepartmentProgressQuery,
    useGetAllDepartmentsProgressQuery,
    useGetDepartmentSubmissionsQuery,
    useGetDepartmentAttemptsQuery,
    useGetSoftDeletedDepartmentsQuery,
    useRestoreDepartmentMutation,
    useCancelDepartmentMutation,
    useGetMyDepartmentsQuery,
    useLazyExportDepartmentsQuery,
    useGetHandoverSheetsMonitoringQuery,
    useDeleteHandoverSheetMutation,
    useBulkDeleteHandoverSheetsMutation,
    useGetDojoHiringConfigsQuery,
    useSaveDojoHiringConfigMutation,
    useGetDailyMeetingConfigQuery,
    useSaveDailyMeetingConfigMutation,
    useGetDailyMeetingSheetQuery,
    useSaveDailyMeetingSheetMutation,
    useGetDailyMorningMeetingsQuery,
    useGetDailyMorningMeetingDetailQuery,
    useCreateDailyMorningMeetingMutation,
    useCloneDailyMorningMeetingMutation,
    useUpdateDailyMorningMeetingMutation,
    useSaveDailyMorningMeetingSheetMutation,
    useDeleteDailyMorningMeetingMutation,
    useMigrateDailyMorningMeetingToM365Mutation,
    useRefreshDailyMorningMeetingEmbedUrlMutation,
    useLazyGetDailyMorningMeetingM365SnapshotQuery,
} = departmentApi;
