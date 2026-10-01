import axiosBaseQuery from "@/Helper/axiosBaseQuery";
import { createApi } from "@reduxjs/toolkit/query/react";

export const leftRequestApi = createApi({
  reducerPath: "leftRequestApi",
  baseQuery: axiosBaseQuery,
  tagTypes: ["LeftRequest", "LeftRequestCount"],
  endpoints: (builder) => ({
    getAllLeftRequests: builder.query({
      query: ({ status = "", departmentId = "", sectionId = "", lineId = "", search = "", page = 1, limit = 25 } = {}) => ({
        url: "/api/left-requests",
        method: "GET",
        params: { status, departmentId, sectionId, lineId, search, page, limit },
      }),
      providesTags: ["LeftRequest"],
    }),

    getLeftRequestById: builder.query({
      query: (id) => ({
        url: `/api/left-requests/${id}`,
        method: "GET",
      }),
      providesTags: (result, error, id) => [{ type: "LeftRequest", id }],
    }),

    getPendingLeftRequestCount: builder.query({
      query: (departmentId) => ({
        url: "/api/left-requests/pending-count",
        method: "GET",
        params: departmentId ? { departmentId } : {},
      }),
      providesTags: ["LeftRequestCount"],
    }),

    applyLeftRequest: builder.mutation({
      query: (data) => ({
        url: "/api/left-requests",
        method: "POST",
        data,
      }),
      invalidatesTags: ["LeftRequest", "LeftRequestCount"],
    }),

    bulkApplyLeftRequest: builder.mutation({
      query: (data) => ({
        url: "/api/left-requests/bulk",
        method: "POST",
        data,
      }),
      invalidatesTags: ["LeftRequest", "LeftRequestCount"],
    }),

    approveLeftRequest: builder.mutation({
      query: ({ id, reasonOfLeavingByHr }) => ({
        url: `/api/left-requests/${id}/approve`,
        method: "PATCH",
        data: { reasonOfLeavingByHr },
      }),
      invalidatesTags: ["LeftRequest", "LeftRequestCount"],
    }),

    rejectLeftRequest: builder.mutation({
      query: ({ id, rejectionReason }) => ({
        url: `/api/left-requests/${id}/reject`,
        method: "PATCH",
        data: { rejectionReason },
      }),
      invalidatesTags: ["LeftRequest", "LeftRequestCount"],
    }),

    bulkApproveLeftRequest: builder.mutation({
      query: ({ ids, reasonOfLeavingByHr }) => ({
        url: "/api/left-requests/bulk-approve",
        method: "PATCH",
        data: { ids, reasonOfLeavingByHr },
      }),
      invalidatesTags: ["LeftRequest", "LeftRequestCount"],
    }),

    bulkRejectLeftRequest: builder.mutation({
      query: ({ ids, rejectionReason }) => ({
        url: "/api/left-requests/bulk-reject",
        method: "PATCH",
        data: { ids, rejectionReason },
      }),
      invalidatesTags: ["LeftRequest", "LeftRequestCount"],
    }),

    cancelLeftRequest: builder.mutation({
      query: (id) => ({
        url: `/api/left-requests/${id}/cancel`,
        method: "DELETE",
      }),
      invalidatesTags: ["LeftRequest", "LeftRequestCount"],
    }),
  }),
});

export const {
  useGetAllLeftRequestsQuery,
  useLazyGetAllLeftRequestsQuery,
  useGetLeftRequestByIdQuery,
  useGetPendingLeftRequestCountQuery,
  useApplyLeftRequestMutation,
  useBulkApplyLeftRequestMutation,
  useApproveLeftRequestMutation,
  useRejectLeftRequestMutation,
  useBulkApproveLeftRequestMutation,
  useBulkRejectLeftRequestMutation,
  useCancelLeftRequestMutation,
} = leftRequestApi;

export default leftRequestApi;
