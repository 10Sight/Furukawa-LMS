import axiosBaseQuery from "@/Helper/axiosBaseQuery";
import { createApi } from "@reduxjs/toolkit/query/react";

export const certificateApi = createApi({
    reducerPath: "certificateApi",
    baseQuery: axiosBaseQuery,
    tagTypes: ['Certificate'],
    endpoints: (builder) => ({
        issueCertificate: builder.mutation({
            query: ({ courseId, studentId }) => ({
                url: "/api/certificates",
                method: "POST",
                data: { courseId, studentId }
            }),
            invalidatesTags: ['Certificate'],
        }),

        getCertificateById: builder.query({
            query: (id) => ({
                url: `/api/certificates/${id}`,
                method: "GET",
            }),
            providesTags: (result, error, id) => [{ type: 'Certificate', id }],
        }),

        getStudentCertificates: builder.query({
            query: () => ({
                url: "/api/certificates/student",
                method: "GET",
            }),
            providesTags: ['Certificate'],
        }),

        getCourseCertificates: builder.query({
            query: (courseId) => ({
                url: `/api/certificates/course/${courseId}`,
                method: "GET",
            }),
            providesTags: (result, error, courseId) => [{ type: 'Certificate', id: courseId }],
        }),

        revokeCertificate: builder.mutation({
            query: (id) => ({
                url: `/api/certificates/${id}`,
                method: "DELETE",
            }),
            invalidatesTags: ['Certificate'],
        }),

        // New instructor workflow endpoints
        checkCertificateEligibility: builder.query({
            query: ({ studentId, courseId }) => ({
                url: `/api/certificates/check-eligibility/${studentId}/${courseId}`,
                method: "GET",
            }),
        }),

        issueCertificateWithTemplate: builder.mutation({
            query: ({ studentId, courseId, grade, templateId }) => ({
                url: "/api/certificates/issue-with-template",
                method: "POST",
                data: { studentId, courseId, grade, templateId }
            }),
            invalidatesTags: ['Certificate'],
        }),

        generateCertificatePreview: builder.mutation({
            query: ({ studentId, courseId, templateId }) => ({
                url: "/api/certificates/preview",
                method: "POST",
                data: { studentId, courseId, templateId }
            }),
        }),
    }),
});

export const {
    useIssueCertificateMutation,
    useGetCertificateByIdQuery,
    useGetStudentCertificatesQuery,
    useGetCourseCertificatesQuery,
    useRevokeCertificateMutation,
    useCheckCertificateEligibilityQuery,
    useIssueCertificateWithTemplateMutation,
    useGenerateCertificatePreviewMutation,
} = certificateApi;
