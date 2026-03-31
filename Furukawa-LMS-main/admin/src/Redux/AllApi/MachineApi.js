import { createApi } from "@reduxjs/toolkit/query/react";
import axiosBaseQuery from "@/Helper/axiosBaseQuery";

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
            invalidatesTags: ["Machine"],
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

        // Update Machine
        updateMachine: builder.mutation({
            query: ({ id, ...data }) => ({
                url: `/api/machines/${id}`,
                method: "PUT",
                data,
            }),
            invalidatesTags: ["Machine"],
        }),

        // Delete Machine
        updateMachineStatus: builder.mutation({
            query: ({ id, isActive }) => ({
                url: `/api/machines/${id}`,
                method: "PUT",
                data: { isActive },
            }),
            invalidatesTags: ["Machine"],
        }),

        deleteMachine: builder.mutation({
            query: (id) => ({
                url: `/api/machines/${id}`,
                method: "DELETE",
            }),
            invalidatesTags: ["Machine"],
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
                "User"
            ],
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
                "User"
            ],
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
    useUpdateMachineMutation,
    useUpdateMachineStatusMutation,
    useDeleteMachineMutation,
    useAssignEmployeeMutation,
    useRemoveEmployeeMutation,
    useGetMachineEmployeesQuery,
    useGetMachineByIdQuery,
} = MachineApi;
