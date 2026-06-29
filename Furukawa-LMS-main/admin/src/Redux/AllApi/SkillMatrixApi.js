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
            query: ({ departmentId, sectionId, lineId, subSectionId, stationId, month }) => ({
                url: `/api/skill-matrix/fetch`, // Using a generic fetch endpoint or query params
                method: "GET",
                params: {
                    departmentId,
                    sectionId,
                    lineId,
                    subSectionId,
                    stationId,
                    ...(month ? { month } : {})
                },
            }),
            providesTags: ["SkillMatrix"],
        }),
        getSkillMatrixList: builder.query({
            query: ({ departmentId, sectionId, lineId, subSectionId, stationId, month } = {}) => ({
                url: "/api/skill-matrix/list",
                method: "GET",
                params: {
                    ...(departmentId ? { departmentId } : {}),
                    ...(sectionId ? { sectionId } : {}),
                    ...(lineId ? { lineId } : {}),
                    ...(subSectionId ? { subSectionId } : {}),
                    ...(stationId ? { stationId } : {}),
                    ...(month ? { month } : {}),
                },
            }),
            providesTags: ["SkillMatrix"],
        }),
        getSkillMatrixEfficiency: builder.query({
            query: ({ departmentId, sectionId, lineId, subSectionId } = {}) => ({
                url: "/api/skill-matrix/evaluations/efficiency",
                method: "GET",
                params: {
                    ...(departmentId ? { departmentId } : {}),
                    ...(sectionId ? { sectionId } : {}),
                    ...(lineId ? { lineId } : {}),
                    ...(subSectionId ? { subSectionId } : {}),
                },
            }),
            providesTags: ["SkillMatrix"],
        }),
        getSkillMatrixEfficiencySummary: builder.query({
            query: () => ({
                url: "/api/skill-matrix/evaluations/summary",
                method: "GET",
            }),
            providesTags: ["SkillMatrix"],
        }),
        getEvaluationList: builder.query({
            query: ({ departmentId, sectionId, lineId, subSectionId, search } = {}) => ({
                url: "/api/skill-matrix/evaluations/list",
                method: "GET",
                params: {
                    ...(departmentId ? { departmentId } : {}),
                    ...(sectionId ? { sectionId } : {}),
                    ...(lineId ? { lineId } : {}),
                    ...(subSectionId ? { subSectionId } : {}),
                    ...(search ? { search } : {}),
                },
            }),
            providesTags: ["SkillMatrix"],
        }),
        deleteEvaluationSheet: builder.mutation({
            query: (sheetId) => ({
                url: `/api/skill-matrix/evaluation/sheet/${sheetId}`,
                method: "DELETE",
            }),
            invalidatesTags: ["SkillMatrix"],
        }),
        deleteSkillMatrix: builder.mutation({
            query: (id) => ({
                url: `/api/skill-matrix/sheet/${id}`,
                method: "DELETE",
            }),
            invalidatesTags: ["SkillMatrix"],
        }),
    }),
});

export const {
    useSaveSkillMatrixMutation,
    useGetSkillMatrixQuery,
    useGetSkillMatrixListQuery,
    useGetSkillMatrixEfficiencyQuery,
    useGetSkillMatrixEfficiencySummaryQuery,
    useGetEvaluationListQuery,
    useDeleteEvaluationSheetMutation,
    useDeleteSkillMatrixMutation,
} = skillMatrixApi;
