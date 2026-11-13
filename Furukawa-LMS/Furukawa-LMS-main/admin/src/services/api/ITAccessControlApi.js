import axiosBaseQuery from "@/services/requests/axiosBaseQuery.js";
import { createApi } from "@reduxjs/toolkit/query/react";

// IT Access Control Register (server/routes/itAccessControl.routes.js).
// Every response is the server's ApiResponse: { statuscode, data, message, success }.
const BASE = "/api/v1/it-access-control";

export const itAccessControlApi = createApi({
    reducerPath: "itAccessControlApi",
    baseQuery: axiosBaseQuery,
    tagTypes: ["ItAccessRegister", "ItAccessHistory"],
    endpoints: (builder) => ({
        // { fields, groups, empIdPrefix, rows }
        getItAccessRegister: builder.query({
            query: () => ({ url: BASE, method: "GET" }),
            providesTags: ["ItAccessRegister"],
        }),

        // rows: [{ userId, version, values: { field: value } }] — only changed fields.
        // source (optional): where the changes came from, e.g. "import:Access_Q3.xlsx".
        saveItAccessRegister: builder.mutation({
            query: ({ rows, source = null }) => ({ url: BASE, method: "PUT", data: { rows, source } }),
            invalidatesTags: ["ItAccessRegister", "ItAccessHistory"],
        }),

        getItAccessHistory: builder.query({
            query: (userId) => ({ url: `${BASE}/history/${userId}`, method: "GET" }),
            providesTags: (result, error, userId) => [{ type: "ItAccessHistory", id: userId }],
        }),
    }),
});

export const {
    useGetItAccessRegisterQuery,
    useSaveItAccessRegisterMutation,
    useGetItAccessHistoryQuery,
} = itAccessControlApi;
