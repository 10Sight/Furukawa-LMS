import { userApi } from "./UserApi";

export const designationApi = userApi.injectEndpoints({
    endpoints: (builder) => ({
        getUniqueDesignations: builder.query({
            query: () => ({
                url: "/api/designations/unique",
                method: "GET"
            }),
            providesTags: ['User'],
        }),

        getDesignationsWithCounts: builder.query({
            query: () => ({
                url: "/api/designations/counts",
                method: "GET"
            }),
            providesTags: ['User'],
        }),

        shutterDesignation: builder.mutation({
            query: (designation) => ({
                url: "/api/designations/shutter",
                method: "POST",
                data: { designation },
            }),
            invalidatesTags: ['User'],
        }),

        unshutterDesignation: builder.mutation({
            query: (designation) => ({
                url: "/api/designations/unshutter",
                method: "POST",
                data: { designation },
            }),
            invalidatesTags: ['User'],
        }),
    }),
});

export const {
    useGetUniqueDesignationsQuery,
    useGetDesignationsWithCountsQuery,
    useShutterDesignationMutation,
    useUnshutterDesignationMutation,
} = designationApi;
