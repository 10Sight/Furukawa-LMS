import axiosBaseQuery from "@/Helper/axiosBaseQuery";
import { createApi } from "@reduxjs/toolkit/query/react";

export const lessonApi = createApi({
  reducerPath: "lessonApi",
  baseQuery: axiosBaseQuery,
  tagTypes: ["Lesson"],
  endpoints: (builder) => ({
    createLesson: builder.mutation({
      query: ({ moduleId, title, content, duration, order, slides }) => ({
        url: `/api/modules/${moduleId}/lessons`,
        method: "POST",
        data: { title, content, duration, order, slides },
      }),
      invalidatesTags: ["Lesson"],
    }),

    getLessonsByModule: builder.query({
      query: (moduleId) => ({
        url: `/api/modules/${moduleId}/lessons`,
        method: "GET",
      }),
      providesTags: ["Lesson"],
    }),

    getLessonById: builder.query({
      query: ({ moduleId, lessonId }) => ({
        url: `/api/modules/${moduleId}/lessons/${lessonId}`,
        method: "GET",
      }),
      providesTags: ["Lesson"],
    }),

    updateLesson: builder.mutation({
      query: ({ moduleId, lessonId, title, content, duration, order, slides }) => ({
        url: `/api/modules/${moduleId}/lessons/${lessonId}`,
        method: "PUT",
        data: { title, content, duration, order, slides },
      }),
      invalidatesTags: ["Lesson"],
    }),

    deleteLesson: builder.mutation({
      query: ({ moduleId, lessonId }) => ({
        url: `/api/modules/${moduleId}/lessons/${lessonId}`,
        method: "DELETE",
      }),
      invalidatesTags: ["Lesson"],
    }),

    // Slide-level endpoints
    addLessonSlide: builder.mutation({
      query: ({ moduleId, lessonId, slide }) => ({
        url: `/api/modules/${moduleId}/lessons/${lessonId}/slides`,
        method: "POST",
        data: slide,
      }),
      invalidatesTags: ["Lesson"],
    }),

    updateLessonSlide: builder.mutation({
      query: ({ moduleId, lessonId, slideId, updates }) => ({
        url: `/api/modules/${moduleId}/lessons/${lessonId}/slides/${slideId}`,
        method: "PUT",
        data: updates,
      }),
      invalidatesTags: ["Lesson"],
    }),

    deleteLessonSlide: builder.mutation({
      query: ({ moduleId, lessonId, slideId }) => ({
        url: `/api/modules/${moduleId}/lessons/${lessonId}/slides/${slideId}`,
        method: "DELETE",
      }),
      invalidatesTags: ["Lesson"],
    }),

    reorderLessonSlides: builder.mutation({
      query: ({ moduleId, lessonId, order, slides }) => ({
        url: `/api/modules/${moduleId}/lessons/${lessonId}/slides/reorder`,
        method: "PATCH",
        data: order ? { order } : { slides },
      }),
      invalidatesTags: ["Lesson"],
    }),
  }),
});

export const {
  useCreateLessonMutation,
  useGetLessonsByModuleQuery,
  useGetLessonByIdQuery,
  useUpdateLessonMutation,
  useDeleteLessonMutation,
  useAddLessonSlideMutation,
  useUpdateLessonSlideMutation,
  useDeleteLessonSlideMutation,
  useReorderLessonSlidesMutation,
} = lessonApi;
