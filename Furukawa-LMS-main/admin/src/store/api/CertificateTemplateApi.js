import axiosBaseQuery from "@/Helper/axiosBaseQuery";
import { createApi } from "@reduxjs/toolkit/query/react";

export const certificateTemplateApi = createApi({
    reducerPath: "certificateTemplateApi",
    baseQuery: axiosBaseQuery,
    tagTypes: ['CertificateTemplate'],
    endpoints: (builder) => ({
        // Admin endpoints
        createCertificateTemplate: builder.mutation({
            query: (templateData) => ({
                url: "/api/certificate-templates",
                method: "POST",
                data: templateData
            }),
            invalidatesTags: ['CertificateTemplate'],
        }),

        getCertificateTemplates: builder.query({
            query: () => ({
                url: "/api/certificate-templates",
                method: "GET",
            }),
            providesTags: ['CertificateTemplate'],
        }),

        getCertificateTemplateById: builder.query({
            query: (id) => ({
                url: `/api/certificate-templates/${id}`,
                method: "GET",
            }),
            providesTags: (result, error, id) => [{ type: 'CertificateTemplate', id }],
        }),

        getDefaultCertificateTemplate: builder.query({
            query: () => ({
                url: "/api/certificate-templates/default",
                method: "GET",
            }),
            providesTags: [{ type: 'CertificateTemplate', id: 'DEFAULT' }],
        }),

        updateCertificateTemplate: builder.mutation({
            query: ({ id, ...templateData }) => ({
                url: `/api/certificate-templates/${id}`,
                method: "PUT",
                data: templateData
            }),
            invalidatesTags: (result, error, { id }) => [
                { type: 'CertificateTemplate', id },
                'CertificateTemplate'
            ],
        }),

        deleteCertificateTemplate: builder.mutation({
            query: (id) => ({
                url: `/api/certificate-templates/${id}`,
                method: "DELETE",
            }),
            invalidatesTags: ['CertificateTemplate'],
        }),

        setDefaultCertificateTemplate: builder.mutation({
            query: (id) => ({
                url: `/api/certificate-templates/${id}/set-default`,
                method: "PATCH",
            }),
            invalidatesTags: ['CertificateTemplate'],
        }),
    }),
});

export const {
    useCreateCertificateTemplateMutation,
    useGetCertificateTemplatesQuery,
    useGetCertificateTemplateByIdQuery,
    useGetDefaultCertificateTemplateQuery,
    useUpdateCertificateTemplateMutation,
    useDeleteCertificateTemplateMutation,
    useSetDefaultCertificateTemplateMutation,
} = certificateTemplateApi;
