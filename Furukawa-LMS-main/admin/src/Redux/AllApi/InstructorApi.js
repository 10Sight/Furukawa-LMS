import axiosBaseQuery from "@/Helper/axiosBaseQuery";
import { createApi } from "@reduxjs/toolkit/query/react";

export const instructorApi = createApi({
    reducerPath: "instructorApi",
    baseQuery: axiosBaseQuery,
    tagTypes: ['Instructor', 'InstructorCourse', 'InstructorDepartment', 'InstructorStudent', 'InstructorQuiz', 'InstructorAssignment'],
    endpoints: (builder) => ({
        // Get all instructors with pagination, search and filters
        getAllInstructors: builder.query({
            query: ({ page = 1, limit = 10, search = "", status = "", unit = "", sortBy = "createdAt", order = "desc", departmentId = "" } = {}) => ({
                url: "/api/users/instructors",
                method: "GET",
                params: { page, limit, search, status, unit, sortBy, order, departmentId }
            }),
            providesTags: ['Instructor'],
        }),

        getAllStudents: builder.query({
            query: ({ page = 1, limit = 10, search = "", status = "", unit = "", sortBy = "createdAt", order = "desc", departmentId = "", sectionId = "", lineId = "", sixteenDayApprovedOnly = "" } = {}) => ({
                url: `/api/users/students`,
                method: "GET",
                params: { page, limit, search, status, unit, sortBy, order, departmentId, sectionId, lineId, sixteenDayApprovedOnly }
            }),
            providesTags: ['Instructor'],
        }),
        getAllMentors: builder.query({
            query: ({ page = 1, limit = 10, search = "", status = "", unit = "" } = {}) => ({
                url: "/api/users/mentors",
                method: "GET",
                params: { page, limit, search, status, unit }
            }),
            providesTags: ['Instructor'],
        }),
        getAllSupervisors: builder.query({
            query: ({ page = 1, limit = 10, search = "", status = "", unit = "" } = {}) => ({
                url: "/api/users/supervisors",
                method: "GET",
                params: { page, limit, search, status, unit }
            }),
            providesTags: ['Instructor'],
        }),
        getAllIncharges: builder.query({
            query: ({ page = 1, limit = 10, search = "", status = "", unit = "" } = {}) => ({
                url: "/api/users/incharges",
                method: "GET",
                params: { page, limit, search, status, unit }
            }),
            providesTags: ['Instructor'],
        }),

        // Get instructor by ID
        getInstructorById: builder.query({
            query: (id) => ({
                url: `/api/users/${id}`,
                method: "GET",
            }),
            providesTags: (result, error, id) => [{ type: 'Instructor', id }],
        }),

        // Create new instructor
        createInstructor: builder.mutation({
            query: (instructorData) => ({
                url: "/api/users",
                method: "POST",
                data: { ...instructorData, role: "INSTRUCTOR" }
            }),
            invalidatesTags: ['Instructor'],
        }),

        // Update instructor
        updateInstructor: builder.mutation({
            query: ({ id, ...instructorData }) => ({
                url: `/api/users/${id}`,
                method: "PATCH",
                data: instructorData
            }),
            invalidatesTags: ['Instructor'],
        }),

        // Delete instructor
        deleteInstructor: builder.mutation({
            query: (id) => ({
                url: `/api/users/${id}`,
                method: "DELETE",
            }),
            invalidatesTags: ['Instructor'],
        }),

        bulkDeleteInstructors: builder.mutation({
            query: (data) => ({
                url: "/api/users/bulk",
                method: "DELETE",
                data: data
            }),
            invalidatesTags: ['Instructor'],
        }),

        // Update instructor status
        updateInstructorStatus: builder.mutation({
            query: ({ id, status }) => ({
                url: `/api/users/${id}`,
                method: "PATCH",
                data: { status }
            }),
            invalidatesTags: ['Instructor'],
        }),

        // =============== INSTRUCTOR PORTAL ENDPOINTS ===============

        // Dashboard stats for instructor
        getInstructorDashboardStats: builder.query({
            query: () => ({
                url: "/api/instructor/dashboard/stats",
                method: "GET",
            }),
            providesTags: ['InstructorCourse', 'InstructorDepartment', 'InstructorStudent'],
        }),

        // Get courses assigned to instructor
        getInstructorAssignedCourses: builder.query({
            query: ({ page = 1, limit = 12, search = "" } = {}) => ({
                url: "/api/instructor/courses",
                method: "GET",
                params: { page, limit, search }
            }),
            providesTags: ['InstructorCourse'],
        }),

        // Get course details for instructor
        getInstructorCourseDetails: builder.query({
            query: (courseId) => ({
                url: `/api/instructor/courses/${courseId}`,
                method: "GET",
            }),
            providesTags: (result, error, courseId) => [{ type: 'InstructorCourse', id: courseId }],
        }),

        // Get departments assigned to instructor
        getInstructorAssignedDepartments: builder.query({
            query: ({ page = 1, limit = 10, search = "" } = {}) => ({
                url: "/api/instructor/departments",
                method: "GET",
                params: { page, limit, search }
            }),
            providesTags: ['InstructorDepartment'],
        }),

        // Get department details for instructor
        getInstructorDepartmentDetails: builder.query({
            query: (departmentId) => ({
                url: `/api/instructor/departments/${departmentId}`,
                method: "GET",
            }),
            providesTags: (result, error, departmentId) => [{ type: 'InstructorDepartment', id: departmentId }],
        }),

        // Get department students for instructor
        getInstructorDepartmentStudents: builder.query({
            query: (departmentId) => ({
                url: `/api/instructor/departments/${departmentId}/students`,
                method: "GET",
            }),
            providesTags: (result, error, departmentId) => [{ type: 'InstructorStudent', id: departmentId }],
        }),

        // Get student progress
        getInstructorStudentProgress: builder.query({
            query: ({ studentId, courseId }) => ({
                url: `/api/instructor/students/${studentId}/progress`,
                method: "GET",
                params: { courseId }
            }),
            providesTags: (result, error, { studentId }) => [{ type: 'InstructorStudent', id: studentId }],
        }),

        // Get department quiz attempts
        getInstructorDepartmentQuizAttempts: builder.query({
            query: ({ departmentId, page = 1, limit = 10 } = {}) => ({
                url: `/api/instructor/departments/${departmentId}/quiz-attempts`,
                method: "GET",
                params: { page, limit }
            }),
            providesTags: ['InstructorQuiz'],
        }),

        // Get quiz details for instructor
        getInstructorQuizDetails: builder.query({
            query: (quizId) => ({
                url: `/api/instructor/quizzes/${quizId}`,
                method: "GET",
            }),
            providesTags: (result, error, quizId) => [{ type: 'InstructorQuiz', id: quizId }],
        }),

        // Get student quiz attempts
        getInstructorStudentQuizAttempts: builder.query({
            query: ({ studentId, quizId }) => ({
                url: `/api/instructor/students/${studentId}/quiz-attempts/${quizId}`,
                method: "GET",
            }),
            providesTags: (result, error, { studentId, quizId }) => [
                { type: 'InstructorQuiz', id: quizId },
                { type: 'InstructorStudent', id: studentId }
            ],
        }),

        // Get department assignment submissions
        getInstructorDepartmentAssignmentSubmissions: builder.query({
            query: ({ departmentId, page = 1, limit = 10 } = {}) => ({
                url: `/api/instructor/departments/${departmentId}/assignment-submissions`,
                method: "GET",
                params: { page, limit }
            }),
            providesTags: ['InstructorAssignment'],
        }),

        // Get assignment details for instructor
        getInstructorAssignmentDetails: builder.query({
            query: (assignmentId) => ({
                url: `/api/instructor/assignments/${assignmentId}`,
                method: "GET",
            }),
            providesTags: (result, error, assignmentId) => [{ type: 'InstructorAssignment', id: assignmentId }],
        }),

        // Get student assignment submissions
        getInstructorStudentAssignmentSubmissions: builder.query({
            query: ({ studentId, assignmentId }) => ({
                url: `/api/instructor/students/${studentId}/assignment-submissions/${assignmentId}`,
                method: "GET",
            }),
            providesTags: (result, error, { studentId, assignmentId }) => [
                { type: 'InstructorAssignment', id: assignmentId },
                { type: 'InstructorStudent', id: studentId }
            ],
        }),

        // Get submission details with files and grading info
        getInstructorSubmissionDetails: builder.query({
            query: (submissionId) => ({
                url: `/api/instructor/submissions/${submissionId}`,
                method: "GET",
            }),
            providesTags: (result, error, submissionId) => [
                { type: 'InstructorAssignment', id: submissionId }
            ],
        }),

        // Grade a submission
        gradeInstructorSubmission: builder.mutation({
            query: ({ submissionId, grade, feedback }) => ({
                url: `/api/instructor/submissions/${submissionId}/grade`,
                method: "PATCH",
                data: { grade, feedback }
            }),
            invalidatesTags: (result, error, { submissionId }) => [
                { type: 'InstructorAssignment', id: submissionId },
                'InstructorAssignment'
            ],
        }),

        // Download submission file
        downloadInstructorSubmissionFile: builder.query({
            query: ({ submissionId, fileIndex }) => ({
                url: `/api/instructor/submissions/${submissionId}/files/${fileIndex}`,
                method: "GET",
                responseHandler: (response) => response.data,
            }),
            keepUnusedDataFor: 0, // Don't cache file downloads
        }),

        // Import instructors
        importInstructors: builder.mutation({
            query: (formData) => ({
                url: "/api/import/instructors",
                method: "POST",
                data: formData,
            }),
            invalidatesTags: ['Instructor'],
        }),

        // Get instructor import template
        getInstructorImportTemplate: builder.query({
            queryFn: async (arg, api, extraOptions, baseQuery) => {
                const result = await baseQuery({
                    url: "/api/import/instructors/template",
                    method: "GET",
                    responseHandler: (response) => response.data,
                });

                if (result.error) return { error: result.error };

                // Convert Blob to Base64 string to make it serializable for Redux
                const blob = result.data;
                const base64 = await new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result);
                    reader.readAsDataURL(blob);
                });

                return { data: { fileData: base64 } };
            },
        }),
    }),
});

export const {
    useGetAllInstructorsQuery,
    useGetInstructorByIdQuery,
    useGetAllStudentsQuery,
    useCreateInstructorMutation,
    useUpdateInstructorMutation,
    useDeleteInstructorMutation,
    useUpdateInstructorStatusMutation,
    useBulkDeleteInstructorsMutation,
    useGetAllMentorsQuery,
    useGetAllSupervisorsQuery,
    useGetAllInchargesQuery,
    useLazyGetAllMentorsQuery,
    useLazyGetAllSupervisorsQuery,
    useLazyGetAllInchargesQuery,
    // Instructor Portal Hooks
    useGetInstructorDashboardStatsQuery,
    useGetInstructorAssignedCoursesQuery,
    useGetInstructorCourseDetailsQuery,
    useGetInstructorAssignedDepartmentsQuery,
    useGetInstructorDepartmentDetailsQuery,
    useGetInstructorDepartmentStudentsQuery,
    useGetInstructorStudentProgressQuery,
    useGetInstructorDepartmentQuizAttemptsQuery,
    useGetInstructorQuizDetailsQuery,
    useGetInstructorStudentQuizAttemptsQuery,
    useGetInstructorDepartmentAssignmentSubmissionsQuery,
    useGetInstructorAssignmentDetailsQuery,
    useGetInstructorStudentAssignmentSubmissionsQuery,
    useGetInstructorSubmissionDetailsQuery,
    useGradeInstructorSubmissionMutation,
    useImportInstructorsMutation,
    useLazyGetInstructorImportTemplateQuery,
    useLazyGetAllStudentsQuery,
    useLazyGetAllInstructorsQuery,
} = instructorApi;
