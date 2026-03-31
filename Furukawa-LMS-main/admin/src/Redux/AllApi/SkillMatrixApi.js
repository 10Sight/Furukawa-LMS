import { createApi } from "@reduxjs/toolkit/query/react";
import axiosBaseQuery from "@/Helper/axiosBaseQuery";

export const skillMatrixApi = createApi({
    reducerPath: "skillMatrixApi",
    baseQuery: axiosBaseQuery,
    tagTypes: ["SkillMatrix"],
    endpoints: (builder) => ({
        saveSkillMatrix: builder.mutation({
            query: (data) => ({
                url: "/api/skill-matrix/save",
                method: "POST",
                data: data,
            }),
            invalidatesTags: ["SkillMatrix"],
        }),
        getSkillMatrix: builder.query({
            query: ({ departmentId, lineId, month }) => ({
                url: `/api/skill-matrix/${departmentId}/${lineId}`,
                method: "GET",
                params: month ? { month } : undefined,
            }),
            providesTags: ["SkillMatrix"],
        }),
        getSkillMatrixList: builder.query({
            query: ({ departmentId, lineId, month } = {}) => ({
                url: "/api/skill-matrix/list",
                method: "GET",
                params: {
                    ...(departmentId ? { departmentId } : {}),
                    ...(lineId ? { lineId } : {}),
                    ...(month ? { month } : {}),
                },
            }),
            providesTags: ["SkillMatrix"],
        }),
    }),
});

export const { useSaveSkillMatrixMutation, useGetSkillMatrixQuery, useGetSkillMatrixListQuery } = skillMatrixApi;
