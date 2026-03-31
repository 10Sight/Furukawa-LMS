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

        // Get Sub-Sections by Line
        getSubSectionsByLine: builder.query({
            query: (lineId) => ({
                url: `/api/sub-sections/line/${lineId}`,
                method: "GET",
            }),
            providesTags: (result, error, lineId) => [{ type: 'SubSection', id: `line-${lineId}` }],
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
    useGetSubSectionsByLineQuery,
    useUpdateSubSectionMutation,
    useDeleteSubSectionMutation,
} = SubSectionApi;
