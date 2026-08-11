import axiosBaseQuery from "@/Helper/axiosBaseQuery";
import { createApi } from "@reduxjs/toolkit/query/react";

export const sectionApi = createApi({
    reducerPath: "sectionApi",
    baseQuery: axiosBaseQuery,
    tagTypes: ['Section'],
    endpoints: (builder) => ({
        createSection: builder.mutation({
            query: (data) => ({
                url: "/api/sections",
                method: "POST",
                data
            }),
            invalidatesTags: ['Section'],
        }),

        getSectionsByDepartment: builder.query({
            query: (departmentId) => ({
                url: `/api/sections/department/${departmentId}`,
                method: "GET",
            }),
            providesTags: (result, error, departmentId) => [{ type: 'Section', id: `dept-${departmentId}` }],
        }),

        getAllSections: builder.query({
            query: (departmentId) => ({
                url: "/api/sections",
                method: "GET",
                params: departmentId && departmentId !== "ALL" ? { departmentId } : {},
            }),
            providesTags: ['Section'],
        }),

        updateSection: builder.mutation({
            query: ({ id, ...data }) => ({
                url: `/api/sections/${id}`,
                method: "PUT",
                data
            }),
            invalidatesTags: ['Section'],
        }),

        deleteSection: builder.mutation({
            query: (id) => ({
                url: `/api/sections/${id}`,
                method: "DELETE",
            }),
            invalidatesTags: ['Section'],
        }),
    }),
});

export const {
    useCreateSectionMutation,
    useGetSectionsByDepartmentQuery,
    useGetAllSectionsQuery,
    useUpdateSectionMutation,
    useDeleteSectionMutation,
} = sectionApi;
