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
            query: ({ page = 1, limit = 20, search = "" } = {}) => ({
                url: "/api/departments",
                method: "GET",
                params: { page, limit, search }
            }),
            providesTags: ['Department'],
        }),

        getDepartmentById: builder.query({
            query: (id) => ({
                url: `/api/departments/${id}`,
                method: "GET",
            }),
            providesTags: (result, error, id) => [{ type: 'Department', id }],
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
            query: (departmentId) => ({
                url: `/api/departments/${departmentId}/progress`,
                method: "GET",
            }),
            providesTags: (result, error, departmentId) => [{ type: 'Department', id: `progress-${departmentId}` }],
        }),

        getAllDepartmentsProgress: builder.query({
            query: () => ({
                url: "/api/departments/progress/all",
                method: "GET",
            }),
            providesTags: ['Department'],
        }),

        getDepartmentSubmissions: builder.query({
            query: (departmentId) => ({
                url: `/api/departments/${departmentId}/submissions`,
                method: "GET",
            }),
            providesTags: (result, error, departmentId) => [{ type: 'Department', id: `submissions-${departmentId}` }],
        }),

        getDepartmentAttempts: builder.query({
            query: (departmentId) => ({
                url: `/api/departments/${departmentId}/attempts`,
                method: "GET",
            }),
            providesTags: (result, error, departmentId) => [{ type: 'Department', id: `attempts-${departmentId}` }],
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
} = departmentApi;
