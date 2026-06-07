import { createApi } from "@reduxjs/toolkit/query/react";
import axiosBaseQuery from "@/Helper/axiosBaseQuery";

export const LineApi = createApi({
    reducerPath: "LineApi",
    baseQuery: axiosBaseQuery,
    tagTypes: ["Line"],
    endpoints: (builder) => ({
        // Create Line
        createLine: builder.mutation({
            query: (data) => ({
                url: "/api/lines",
                method: "POST",
                data,
            }),
            invalidatesTags: ["Line"],
        }),

        // Get Lines by Section
        getLinesBySection: builder.query({
            query: (sectionId) => ({
                url: `/api/lines/section/${sectionId}`,
                method: "GET",
            }),
            providesTags: (result, error, sectionId) => [{ type: 'Line', id: `section-${sectionId}` }],
        }),

        // Get Lines by Department
        getLinesByDepartment: builder.query({
            query: (departmentId) => ({
                url: `/api/lines/department/${departmentId}`,
                method: "GET",
            }),
            providesTags: (result, error, departmentId) => [{ type: 'Line', id: `dept-${departmentId}` }],
        }),

        // Get All Lines
        getLines: builder.query({
            query: () => ({
                url: "/api/lines",
                method: "GET",
            }),
            providesTags: ["Line"],
        }),

        // Update Line
        updateLine: builder.mutation({
            query: ({ id, ...data }) => ({
                url: `/api/lines/${id}`,
                method: "PUT",
                data,
            }),
            invalidatesTags: ["Line"],
        }),

        // Delete Line
        deleteLine: builder.mutation({
            query: (id) => ({
                url: `/api/lines/${id}`,
                method: "DELETE",
            }),
            invalidatesTags: ["Line"],
        }),
    }),
});

export const {
    useCreateLineMutation,
    useGetLinesBySectionQuery,
    useGetLinesByDepartmentQuery,
    useGetLinesQuery,
    useUpdateLineMutation,
    useDeleteLineMutation,
} = LineApi;
