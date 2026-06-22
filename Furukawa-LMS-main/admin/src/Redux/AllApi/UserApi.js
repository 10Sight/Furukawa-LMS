import axiosBaseQuery from "@/Helper/axiosBaseQuery";
import { createApi } from "@reduxjs/toolkit/query/react";

export const userApi = createApi({
    reducerPath: "userApi",
    baseQuery: axiosBaseQuery,
    tagTypes: ['User', 'ImportLog'],
    endpoints: (builder) => ({
        getAllUsers: builder.query({
            query: ({ page = 1, limit = 20, sortBy = "createdAt", order = "desc", search = "", role = "", unit = "", customRoleId = "", isEmployee = "", isStaff = "", excludeCustomRoles = "", excludeTrainers = "", excludeAdmins = "", departmentId = "", sectionId = "", lineId = "", subSectionId = "", stationId = "", passedQuizOnly = "", includeTemporary = "", dojoHandoverPassedOnly = "", designation = "" } = {}) => ({
                url: "/api/users",
                method: "GET",
                params: { page, limit, sortBy, order, search, role, unit, customRoleId, isEmployee, isStaff, excludeCustomRoles, excludeTrainers, excludeAdmins, departmentId, sectionId, lineId, subSectionId, stationId, passedQuizOnly, includeTemporary, dojoHandoverPassedOnly, designation }
            }),
            providesTags: ['User'],
        }),

        getUniqueDesignations: builder.query({
            query: () => ({
                url: "/api/users/designations/unique",
                method: "GET"
            }),
            providesTags: ['User'],
        }),

        getDesignationsWithCounts: builder.query({
            query: () => ({
                url: "/api/users/designations/counts",
                method: "GET"
            }),
            providesTags: ['User'],
        }),

        getUserById: builder.query({
            query: (id) => ({
                url: `/api/users/${id}`,
                method: "GET",
            }),
            providesTags: (result, error, id) => [{ type: 'User', id }],
        }),

        updateProfile: builder.mutation({
            query: ({ fullName, phoneNumber, email }) => ({
                url: "/api/users/profile",
                method: "PATCH",
                data: { fullName, phoneNumber, email }
            }),
            invalidatesTags: ['User'],
        }),

        changePassword: builder.mutation({
            query: (data) => ({
                url: "/api/v1/auth/change-password",
                method: "PATCH",
                data,
            }),
        }),

        updateAvatar: builder.mutation({
            query: (formData) => ({
                url: "/api/users/avatar",
                method: "PATCH",
                data: formData,

            }),
            invalidatesTags: ['User'],
        }),

        /**
         * Update user mutation
         * @param {Object} params - Update parameters
         * @param {string} params.id - User ID
         * @param {string} [params.fullName] - Full name
         * @param {string} [params.userName] - Username
         * @param {string} [params.email] - Email address
         * @param {string} [params.phoneNumber] - Phone number
         * @param {string} [params.role] - User role
         * @param {string} [params.status] - User status
         * @param {string} [params.unit] - Unit
         * @param {string} [params.empId] - Employee ID
         * @param {boolean} [params.isEmployee] - Is employee flag
         * @param {boolean} [params.isAdmin] - Is admin flag
         * @param {boolean} [params.isTrainer] - Is trainer flag
         * @param {string} [params.shift] - Work shift
         * @param {string} [params.idCard] - ID card number
         * @param {string} [params.privileges] - User privileges
         * @param {string} [params.joiningDate] - Joining date
         * @param {string} [params.leavingDate] - Leaving date
         */
        updateUser: builder.mutation({
            query: ({ id, ...userData }) => ({
                url: `/api/users/${id}`,
                method: "PATCH",
                data: userData
            }),
            invalidatesTags: ['User'],
        }),

        /**
         * Create user mutation
         * @param {Object} userData - User data
         * @param {string} userData.fullName - Full name (required)
         * @param {string} userData.userName - Username (required)
         * @param {string} userData.email - Email address (required)
         * @param {string} userData.phoneNumber - Phone number (required)
         * @param {string} userData.password - Password (required)
         * @param {string} userData.unit - Unit (required)
         * @param {string} [userData.role] - User role (default: "STUDENT")
         * @param {string} [userData.empId] - Employee ID
         * @param {boolean} [userData.isEmployee] - Is employee flag
         * @param {boolean} [userData.isAdmin] - Is admin flag
         * @param {boolean} [userData.isTrainer] - Is trainer flag
         * @param {string} [userData.shift] - Work shift
         * @param {string} [userData.idCard] - ID card number
         * @param {string} [userData.privileges] - User privileges
         * @param {string} [userData.joiningDate] - Joining date
         * @param {string} [userData.leavingDate] - Leaving date
         */
        createUser: builder.mutation({
            query: (userData) => ({
                url: "/api/users",
                method: "POST",
                data: userData
            }),
            invalidatesTags: ['User'],
        }),

        deleteUser: builder.mutation({
            query: (id) => ({
                url: `/api/users/${id}`,
                method: "DELETE",
            }),
            invalidatesTags: ['User'],
        }),

        bulkDeleteUsers: builder.mutation({
            query: (data) => ({
                url: "/api/users/bulk",
                method: "DELETE",
                data: data // This will now accept { ids: [...] } or { isAllSelected: true, ... }
            }),
            invalidatesTags: ['User'],
        }),

        // Super Admin functions
        getSoftDeletedUsers: builder.query({
            query: ({ page = 1, limit = 20, sortBy = "updatedAt", order = "desc", search = "", role = "" } = {}) => ({
                url: "/api/users/deleted/all",
                method: "GET",
                params: { page, limit, sortBy, order, search, role }
            }),
            providesTags: ['User'],
        }),

        restoreUser: builder.mutation({
            query: (id) => ({
                url: `/api/users/deleted/${id}/restore`,
                method: "PATCH",
            }),
            invalidatesTags: ['User'],
        }),

        exportStudents: builder.query({
            query: ({ format = 'excel', search = '', status = '', departmentId = '', sectionId = '', lineId = '', subSectionId = '', stationId = '' } = {}) => ({
                url: `/api/exports/students`,
                method: "GET",
                params: { format, search, status, departmentId, sectionId, lineId, subSectionId, stationId },
                responseHandler: (response) => response.data
            }),
            keepUnusedDataFor: 0,
        }),

        importEmployees: builder.mutation({
            query: (formData) => ({
                url: "/api/import/employees",
                method: "POST",
                data: formData,
            }),
            invalidatesTags: ['User', 'ImportLog'],
        }),
        importDojoCandidates: builder.mutation({
            query: (formData) => ({
                url: "/api/import/dojo-candidates",
                method: "POST",
                data: formData,
            }),
            invalidatesTags: ['User', 'ImportLog'],
        }),

        getImportLogs: builder.query({
            query: () => ({
                url: "/api/import/employees/logs",
                method: "GET",
            }),
            providesTags: ['ImportLog'],
        }),

        getImportLogDetails: builder.query({
            query: (id) => ({
                url: `/api/import/employees/logs/${id}`,
                method: "GET",
            }),
        }),

        getImportTemplate: builder.query({
            queryFn: async (arg, api, extraOptions, baseQuery) => {
                const result = await baseQuery({
                    url: "/api/import/employees/template",
                    method: "GET",
                    responseHandler: (response) => response.data,
                });

                if (result.error) return { error: result.error };

                // Convert Blob to Base64 string to make it serializable for Redux
                const blob = result.data;
                const base64 = await new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result);
                    reader.readAsDataURL(blob);
                });

                return { data: { fileData: base64 } };
            },
        }),
        getDojoImportTemplate: builder.query({
            queryFn: async (arg, api, extraOptions, baseQuery) => {
                const result = await baseQuery({
                    url: "/api/import/dojo-candidates/template",
                    method: "GET",
                    responseHandler: (response) => response.data,
                });

                if (result.error) return { error: result.error };

                const blob = result.data;
                const base64 = await new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result);
                    reader.readAsDataURL(blob);
                });

                return { data: { fileData: base64 } };
            },
        }),
        getTemporaryUsers: builder.query({
            query: ({ page = 1, limit = 20, search = "", gender = "", today = "" } = {}) => ({
                url: "/api/users/temporary",
                method: "GET",
                params: { page, limit, search, gender, today }
            }),
            providesTags: ['User'],
        }),

        getNextTemporaryId: builder.query({
            query: (prefix) => ({
                url: "/api/users/temporary/next-id",
                method: "GET",
                params: { prefix }
            }),
        }),

        dojoRegister: builder.mutation({
            query: (userData) => ({
                url: "/api/v1/auth/dojo-register",
                method: "POST",
                data: userData
            }),
            invalidatesTags: ['User'],
        }),

        shutterDesignation: builder.mutation({
            query: (designation) => ({
                url: "/api/users/designations/shutter",
                method: "POST",
                data: { designation },
            }),
            invalidatesTags: ['User'],
        }),

        unshutterDesignation: builder.mutation({
            query: (designation) => ({
                url: "/api/users/designations/unshutter",
                method: "POST",
                data: { designation },
            }),
            invalidatesTags: ['User'],
        }),
    }),
});

export const {
    useGetAllUsersQuery,
    useLazyGetAllUsersQuery,
    useGetUserByIdQuery,
    useUpdateProfileMutation,
    useUpdateAvatarMutation,
    useUpdateUserMutation,
    useCreateUserMutation,
    useDeleteUserMutation,
    useBulkDeleteUsersMutation,
    useGetSoftDeletedUsersQuery,
    useRestoreUserMutation,
    useLazyExportStudentsQuery,
    useImportEmployeesMutation,
    useImportDojoCandidatesMutation,
    useLazyGetImportTemplateQuery,
    useLazyGetDojoImportTemplateQuery,
    useGetImportLogsQuery,
    useGetImportLogDetailsQuery,
    useGetTemporaryUsersQuery,
    useLazyGetTemporaryUsersQuery,
    useLazyGetNextTemporaryIdQuery,
    useChangePasswordMutation,
    useDojoRegisterMutation,
    useGetUniqueDesignationsQuery,
    useGetDesignationsWithCountsQuery,
    useShutterDesignationMutation,
    useUnshutterDesignationMutation,
} = userApi;
