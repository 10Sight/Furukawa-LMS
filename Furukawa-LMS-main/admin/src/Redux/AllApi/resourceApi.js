import axiosBaseQuery from "@/Helper/axiosBaseQuery";
import { createApi } from "@reduxjs/toolkit/query/react";

export const resourceApi = createApi({
    reducerPath: "resourceApi",
    baseQuery: axiosBaseQuery,
    tagTypes: ['Resource'],
    endpoints: (builder) => ({
        createResource: builder.mutation({
            query: (data) => ({
                url: "/api/resources",
                method: "POST",
                data: data,
            }),
            invalidatesTags: ['Resource'],
        }),
        getResourcesByModule: builder.query({
            query: (moduleId) => ({
                url: `/api/resources/module/${moduleId}`,
                method: "GET"
            }),
            providesTags: (result, error, moduleId) => [
                { type: 'Resource', id: `module-${moduleId}` },
            ],
        }),
        getResourceById: builder.query({
            query: (resourceId) => ({
                url: `/api/resources/${resourceId}`,
                method: "GET"
            }),
            providesTags: (result, error, resourceId) => [
                { type: 'Resource', id: resourceId },
            ],
        }),
        getResourcesByCourse: builder.query({
            query: (courseId) => ({
                url: `/api/resources/course/${courseId}`,
                method: "GET"
            }),
            providesTags: (result, error, courseId) => [
                { type: 'Resource', id: `course-${courseId}` },
            ],
        }),
        getResourcesByLesson: builder.query({
            query: (lessonId) => ({
                url: `/api/resources/lesson/${lessonId}`,
                method: "GET"
            }),
            providesTags: (result, error, lessonId) => [
                { type: 'Resource', id: `lesson-${lessonId}` },
            ],
        }),
        deleteResource: builder.mutation({
            query: (resourceId) => ({
                url: `/api/resources/${resourceId}`,
                method: "DELETE",
            }),
            invalidatesTags: ['Resource'],
        }),
        updateResource: builder.mutation({
            query: ({ resourceId, data }) => ({
                url: `/api/resources/${resourceId}`,
                method: "PUT",
                data: data,
            }),
            invalidatesTags: ['Resource'],
        }),
    }),
});

export const {
    useCreateResourceMutation,
    useGetResourcesByModuleQuery,
    useGetResourcesByCourseQuery,
    useGetResourcesByLessonQuery,
    useDeleteResourceMutation,
    useUpdateResourceMutation,
    useGetResourceByIdQuery,
} = resourceApi;
