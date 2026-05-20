import { createApi } from "@reduxjs/toolkit/query/react";
import axiosBaseQuery from "@/Helper/axiosBaseQuery";

export const SubSectionApi = createApi({
    reducerPath: "subSectionApi",
    baseQuery: axiosBaseQuery,
    tagTypes: ["SubSection"],
    endpoints: (builder) => ({
        // Create Sub-Section
        createSubSection: builder.mutation({
            query: (data) => ({
                url: "/api/sub-sections",
                method: "POST",
                data,
            }),
            invalidatesTags: ["SubSection"],
        }),

        // Get Sub-Sections (with optional filters)
        getSubSections: builder.query({
            query: (params) => ({
                url: "/api/sub-sections",
                method: "GET",
                params,
            }),
            providesTags: ["SubSection"],
        }),

        // Get Sub-Sections by Line (Legacy)
        getSubSectionsByLine: builder.query({
            query: (lineId) => ({
                url: `/api/sub-sections/line/${lineId}`,
                method: "GET",
            }),
            providesTags: (result, error, lineId) => [{ type: 'SubSection', id: `line-${lineId}` }],
        }),

        // Get Sub-Section by ID
        getSubSectionById: builder.query({
            query: (id) => ({
                url: `/api/sub-sections/${id}`,
                method: "GET",
            }),
            providesTags: (result, error, id) => [{ type: "SubSection", id }],
        }),

        // Update Sub-Section
        updateSubSection: builder.mutation({
            query: ({ id, ...data }) => ({
                url: `/api/sub-sections/${id}`,
                method: "PUT",
                data,
            }),
            invalidatesTags: ["SubSection"],
        }),

        // Delete Sub-Section
        deleteSubSection: builder.mutation({
            query: (id) => ({
                url: `/api/sub-sections/${id}`,
                method: "DELETE",
            }),
            invalidatesTags: ["SubSection"],
        }),
    }),
});

export const {
    useCreateSubSectionMutation,
    useGetSubSectionsQuery,
    useGetSubSectionsByLineQuery,
    useGetSubSectionByIdQuery,
    useUpdateSubSectionMutation,
    useDeleteSubSectionMutation,
} = SubSectionApi;
