import axiosBaseQuery from "@/Helper/axiosBaseQuery";
import { createApi } from "@reduxjs/toolkit/query/react";

export const moduleApi = createApi({
    reducerPath: "moduleApi",
    baseQuery: axiosBaseQuery,
    tagTypes: ["Module"],
    endpoints: (builder) => ({
        createModule: builder.mutation({
            query: ({ courseId, title, description, order }) => ({
                url: "/api/modules",
                method: "POST",
                data: { courseId, title, description, order },
            }),
            invalidatesTags: ["Module"],
        }),

        getModulesByCourse: builder.query({
      query: (courseId) => ({
        url: `/api/modules/course/${courseId}`,
        method: "GET",
      }),
      providesTags: ["Module"],
    }),

    getModuleById: builder.query({
      query: (moduleId) => ({
        url: `/api/modules/${moduleId}`,
        method: "GET",
      }),
      providesTags: (result, error, id) => [{ type: 'Module', id }],
    }),

        updateModule: builder.mutation({
            query: ({ moduleId, title, description, order }) => ({
                url: `/api/modules/${moduleId}`,
                method: "PUT",
                data: { title, description, order },
            }),
            invalidatesTags: ["Module"],
        }),

        deleteModule: builder.mutation({
            query: (moduleId) => ({
                url: `/api/modules/${moduleId}`,
                method: "DELETE",
            }),
            invalidatesTags: ["Module"],
        }),
    }),
});

export const {
    useCreateModuleMutation,
    useGetModulesByCourseQuery,
    useGetModuleByIdQuery,
    useUpdateModuleMutation,
    useDeleteModuleMutation,
} = moduleApi;
