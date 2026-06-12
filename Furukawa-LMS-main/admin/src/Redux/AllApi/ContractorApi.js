import axiosBaseQuery from "@/Helper/axiosBaseQuery";
import { createApi } from "@reduxjs/toolkit/query/react";

export const contractorApi = createApi({
    reducerPath: "contractorApi",
    baseQuery: axiosBaseQuery,
    tagTypes: ["Contractor"],
    endpoints: (builder) => ({
        getAllContractors: builder.query({
            query: () => ({ url: "/api/contractors", method: "GET" }),
            providesTags: ["Contractor"],
        }),

        getContractorById: builder.query({
            query: (id) => ({ url: `/api/contractors/${id}`, method: "GET" }),
            providesTags: (result, error, id) => [{ type: "Contractor", id }],
        }),

        createContractor: builder.mutation({
            query: (data) => ({ url: "/api/contractors", method: "POST", data }),
            invalidatesTags: ["Contractor"],
        }),

        updateContractor: builder.mutation({
            query: ({ id, ...data }) => ({ url: `/api/contractors/${id}`, method: "PATCH", data }),
            invalidatesTags: ["Contractor"],
        }),

        deleteContractor: builder.mutation({
            query: (id) => ({ url: `/api/contractors/${id}`, method: "DELETE" }),
            invalidatesTags: ["Contractor"],
        }),
    }),
});

export const {
    useGetAllContractorsQuery,
    useGetContractorByIdQuery,
    useCreateContractorMutation,
    useUpdateContractorMutation,
    useDeleteContractorMutation,
} = contractorApi;
