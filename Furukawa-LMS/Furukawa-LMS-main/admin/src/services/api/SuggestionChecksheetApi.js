import axiosBaseQuery from "@/services/requests/axiosBaseQuery.js";
import { createApi } from "@reduxjs/toolkit/query/react";

export const suggestionChecksheetApi = createApi({
    reducerPath: "suggestionChecksheetApi",
    baseQuery: axiosBaseQuery,
    tagTypes: ['SuggestionChecksheet'],
    endpoints: (builder) => ({
        getSuggestionChecksheets: builder.query({
            query: ({ unit = "", search = "", status = "" } = {}) => ({
                url: "/api/suggestion-checksheet",
                method: "GET",
                params: { unit, search, status }
            }),
            providesTags: ['SuggestionChecksheet'],
        }),

        getSuggestionChecksheetById: builder.query({
            query: (id) => ({
                url: `/api/suggestion-checksheet/${id}`,
                method: "GET",
            }),
            providesTags: (result, error, id) => [{ type: 'SuggestionChecksheet', id }],
        }),

        createSuggestionChecksheet: builder.mutation({
            query: (data) => ({
                url: "/api/suggestion-checksheet",
                method: "POST",
                data
            }),
            invalidatesTags: ['SuggestionChecksheet'],
        }),

        updateSuggestionChecksheet: builder.mutation({
            query: ({ id, ...data }) => ({
                url: `/api/suggestion-checksheet/${id}`,
                method: "PUT",
                data
            }),
            invalidatesTags: ['SuggestionChecksheet'],
        }),

        deleteSuggestionChecksheet: builder.mutation({
            query: (id) => ({
                url: `/api/suggestion-checksheet/${id}`,
                method: "DELETE",
            }),
            invalidatesTags: ['SuggestionChecksheet'],
        }),
    }),
});

export const {
    useGetSuggestionChecksheetsQuery,
    useGetSuggestionChecksheetByIdQuery,
    useCreateSuggestionChecksheetMutation,
    useUpdateSuggestionChecksheetMutation,
    useDeleteSuggestionChecksheetMutation,
} = suggestionChecksheetApi;

