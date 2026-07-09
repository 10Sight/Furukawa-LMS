import { createApi } from "@reduxjs/toolkit/query/react";
import axiosBaseQuery from "@/Helper/axiosBaseQuery";
import { userApi } from "./UserApi";
import { instructorApi } from "./InstructorApi";

// MachineApi, userApi and instructorApi are separate RTK Query slices with
// independent tag registries, so invalidatesTags here only clears MachineApi's
// own cache. Dispatch the other slices' invalidation actions directly so the
// Students/StudentDetail screens (which read from userApi/instructorApi) don't
// keep showing stale station/hierarchy assignments after a machine assign/remove.
const invalidateUserCaches = (userId) => (dispatch) => {
    dispatch(userApi.util.invalidateTags([
        { type: "User", id: userId },
        { type: "User", id: "LIST" },
        "User",
    ]));
    dispatch(instructorApi.util.invalidateTags([
        "Instructor",
        "InstructorStudent",
        { type: "InstructorStudent", id: userId },
    ]));
};

export const MachineApi = createApi({
    reducerPath: "MachineApi",
    baseQuery: axiosBaseQuery,
    tagTypes: ["Machine", "MachineEmployees"],
    endpoints: (builder) => ({
        // Create Machine
        createMachine: builder.mutation({
            query: (data) => ({
                url: "/api/machines",
                method: "POST",
                data,
            }),
            invalidatesTags: ["Machine", "SubSection", "Line", "Section"],
        }),

        // Get Machines by Sub-Section
        getMachinesBySubSection: builder.query({
            query: (subSectionId) => ({
                url: `/api/machines/sub-section/${subSectionId}`,
                method: "GET",
            }),
            providesTags: (result, error, subSectionId) => [{ type: 'Machine', id: `sub-${subSectionId}` }],
        }),

        // Get Machines by Line (Backward Compatibility)
        getMachinesByLine: builder.query({
            query: (lineId) => ({
                url: `/api/machines/line/${lineId}`,
                method: "GET",
            }),
            providesTags: (result, error, lineId) => [{ type: 'Machine', id: `line-${lineId}` }],
        }),
        
        // Get Machines by Section
        getMachinesBySection: builder.query({
            query: (sectionId) => ({
                url: `/api/machines/section/${sectionId}`,
                method: "GET",
            }),
            providesTags: (result, error, sectionId) => [{ type: 'Machine', id: `section-${sectionId}` }],
        }),

        // Get Machines by Department
        getMachinesByDepartment: builder.query({
            query: (departmentId) => ({
                url: `/api/machines/department/${departmentId}`,
                method: "GET",
            }),
            providesTags: (result, error, departmentId) => [{ type: 'Machine', id: `dept-${departmentId}` }],
        }),

        // Update Machine
        updateMachine: builder.mutation({
            query: ({ id, ...data }) => ({
                url: `/api/machines/${id}`,
                method: "PUT",
                data,
            }),
            invalidatesTags: ["Machine", "SubSection", "Line", "Section"],
        }),

        // Delete Machine
        updateMachineStatus: builder.mutation({
            query: ({ id, isActive }) => ({
                url: `/api/machines/${id}`,
                method: "PUT",
                data: { isActive },
            }),
            invalidatesTags: ["Machine", "SubSection", "Line", "Section"],
        }),

        deleteMachine: builder.mutation({
            query: (id) => ({
                url: `/api/machines/${id}`,
                method: "DELETE",
            }),
            invalidatesTags: ["Machine", "SubSection", "Line", "Section"],
        }),

        // Get Machine By ID
        getMachineById: builder.query({
            query: (id) => ({
                url: `/api/machines/${id}`,
                method: "GET",
            }),
            providesTags: ["Machine"],
        }),

        // Assign Employee
        assignEmployee: builder.mutation({
            query: ({ machineId, userId }) => ({
                url: `/api/machines/${machineId}/employees`,
                method: "POST",
                data: { userId },
            }),
            invalidatesTags: (result, error, { userId }) => [
                "MachineEmployees",
                { type: "User", id: userId },
                { type: "User", id: "LIST" },
                "User",
                "SubSection",
                "Line",
                "Section"
            ],
            async onQueryStarted({ userId }, { dispatch, queryFulfilled }) {
                try {
                    await queryFulfilled;
                    dispatch(invalidateUserCaches(userId));
                } catch { /* mutation failed, nothing to invalidate */ }
            },
        }),

        // Remove Employee
        removeEmployee: builder.mutation({
            query: ({ machineId, userId }) => ({
                url: `/api/machines/${machineId}/employees/${userId}`,
                method: "DELETE",
            }),
            invalidatesTags: (result, error, { userId }) => [
                "MachineEmployees",
                { type: "User", id: userId },
                { type: "User", id: "LIST" },
                "User",
                "SubSection",
                "Line",
                "Section"
            ],
            async onQueryStarted({ userId }, { dispatch, queryFulfilled }) {
                try {
                    await queryFulfilled;
                    dispatch(invalidateUserCaches(userId));
                } catch { /* mutation failed, nothing to invalidate */ }
            },
        }),

        // Get Machine Employees
        getMachineEmployees: builder.query({
            query: (machineId) => ({
                url: `/api/machines/${machineId}/employees`,
                method: "GET",
            }),
            providesTags: ["MachineEmployees"],
        }),
    }),
});

export const {
    useCreateMachineMutation,
    useGetMachinesBySubSectionQuery,
    useGetMachinesByLineQuery,
    useGetMachinesBySectionQuery,
    useGetMachinesByDepartmentQuery,
    useUpdateMachineMutation,
    useUpdateMachineStatusMutation,
    useDeleteMachineMutation,
    useAssignEmployeeMutation,
    useRemoveEmployeeMutation,
    useGetMachineEmployeesQuery,
    useGetMachineByIdQuery,
} = MachineApi;
