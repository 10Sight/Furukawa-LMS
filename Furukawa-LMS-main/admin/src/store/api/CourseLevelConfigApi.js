import { createApi } from "@reduxjs/toolkit/query/react";
import axiosBaseQuery from "@/Helper/axiosBaseQuery";

const CourseLevelConfigApi = createApi({
  reducerPath: "courseLevelConfig",
  baseQuery: axiosBaseQuery,
  tagTypes: ["CourseLevelConfig"],
  endpoints: (builder) => ({
    // Get active configuration
    getActiveConfig: builder.query({
      query: () => ({
        url: "/api/course-level-config/active",
        method: "GET",
      }),
      providesTags: ["CourseLevelConfig"],
    }),
    
    // Get all configurations
    getAllConfigs: builder.query({
      query: () => ({
        url: "/api/course-level-config",
        method: "GET",
      }),
      providesTags: ["CourseLevelConfig"],
    }),
    
    // Get configuration by ID
    getConfigById: builder.query({
      query: (id) => ({
        url: `/api/course-level-config/${id}`,
        method: "GET",
      }),
      providesTags: (result, error, id) => [{ type: "CourseLevelConfig", id }],
    }),
    
    // Create new configuration
    createConfig: builder.mutation({
      query: (data) => ({
        url: "/api/course-level-config",
        method: "POST",
        data: data,
      }),
      invalidatesTags: ["CourseLevelConfig"],
    }),
    
    // Update configuration
    updateConfig: builder.mutation({
      query: ({ id, ...data }) => ({
        url: `/api/course-level-config/${id}`,
        method: "PATCH",
        data: data,
      }),
      invalidatesTags: (result, error, { id }) => [
        "CourseLevelConfig",
        { type: "CourseLevelConfig", id },
      ],
    }),
    
    // Delete configuration
    deleteConfig: builder.mutation({
      query: (id) => ({
        url: `/api/course-level-config/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["CourseLevelConfig"],
    }),
    
    // Set configuration as default
    setAsDefault: builder.mutation({
      query: (id) => ({
        url: `/api/course-level-config/${id}/set-default`,
        method: "PATCH",
      }),
      invalidatesTags: ["CourseLevelConfig"],
    }),
    
    // Validate compatibility
    validateCompatibility: builder.mutation({
      query: (data) => ({
        url: "/api/course-level-config/validate-compatibility",
        method: "POST",
        data: data,
      }),
    }),
    
    // Migrate levels
    migrateLevels: builder.mutation({
      query: (data) => ({
        url: "/api/course-level-config/migrate-levels",
        method: "POST",
        data: data,
      }),
      invalidatesTags: ["CourseLevelConfig"],
    }),
  }),
});

export const {
  useGetActiveConfigQuery,
  useGetAllConfigsQuery,
  useGetConfigByIdQuery,
  useCreateConfigMutation,
  useUpdateConfigMutation,
  useDeleteConfigMutation,
  useSetAsDefaultMutation,
  useValidateCompatibilityMutation,
  useMigrateLevelsMutation,
} = CourseLevelConfigApi;

export default CourseLevelConfigApi;
