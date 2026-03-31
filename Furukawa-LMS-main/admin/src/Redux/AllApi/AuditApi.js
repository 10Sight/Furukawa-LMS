import axiosBaseQuery from "@/Helper/axiosBaseQuery";
import { createApi } from "@reduxjs/toolkit/query/react";

export const auditApi = createApi({
    reducerPath: "auditApi",
    baseQuery: axiosBaseQuery,
    tagTypes: ['Audit'],
    endpoints: (builder) => ({
        getAllAudits: builder.query({
            query: ({ 
                page = 1, 
                limit = 20, 
                userId = "", 
                action = "", 
                sortBy = "createdAt",
                order = "desc",
                search = "",
                dateFrom = null,
                dateTo = null,
                ipAddress = "",
                userAgent = ""
            } = {}) => {
                const params = { page, limit };
                
                // Only add non-empty parameters
                if (userId) params.userId = userId;
                if (action) params.action = action;
                if (sortBy) params.sortBy = sortBy;
                if (order) params.order = order;
                if (search) params.search = search;
                if (dateFrom) params.dateFrom = dateFrom;
                if (dateTo) params.dateTo = dateTo;
                if (ipAddress) params.ipAddress = ipAddress;
                if (userAgent) params.userAgent = userAgent;
                
                return {
                    url: "/api/audits",
                    method: "GET",
                    params
                };
            },
            providesTags: ['Audit'],
        }),

        getAuditById: builder.query({
            query: (id) => ({
                url: `/api/audits/${id}`,
                method: "GET",
            }),
            providesTags: (result, error, id) => [{ type: 'Audit', id }],
        }),

        deleteAudit: builder.mutation({
            query: (id) => ({
                url: `/api/audits/${id}`,
                method: "DELETE",
            }),
            invalidatesTags: ['Audit'],
        }),
    }),
});

export const {
    useGetAllAuditsQuery,
    useGetAuditByIdQuery,
    useDeleteAuditMutation,
} = auditApi;
