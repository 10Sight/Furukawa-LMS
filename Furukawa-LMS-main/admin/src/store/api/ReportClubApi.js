import axiosBaseQuery from "@/Helper/axiosBaseQuery";
import { createApi } from "@reduxjs/toolkit/query/react";

export const reportClubApi = createApi({
    reducerPath: "reportClubApi",
    baseQuery: axiosBaseQuery,
    tagTypes: ['ReportClub'],
    endpoints: (builder) => ({
        createClub: builder.mutation({
            query: (data) => ({
                url: "/api/report-clubs",
                method: "POST",
                data
            }),
            invalidatesTags: ['ReportClub'],
        }),

        getAllClubs: builder.query({
            query: () => ({
                url: "/api/report-clubs",
                method: "GET",
            }),
            providesTags: ['ReportClub'],
        }),

        deleteClub: builder.mutation({
            query: (id) => ({
                url: `/api/report-clubs/${id}`,
                method: "DELETE",
            }),
            invalidatesTags: ['ReportClub'],
        }),
        updateClub: builder.mutation({
            query: ({ id, ...data }) => ({
                url: `/api/report-clubs/${id}`,
                method: "PATCH",
                data
            }),
            invalidatesTags: ['ReportClub'],
        }),
    }),
});

export const {
    useCreateClubMutation,
    useGetAllClubsQuery,
    useDeleteClubMutation,
    useUpdateClubMutation,
} = reportClubApi;
