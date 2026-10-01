import axiosBaseQuery from "@/Helper/axiosBaseQuery";
import { createApi } from "@reduxjs/toolkit/query/react";

export const authApi = createApi({
    reducerPath: "authApi",
    baseQuery: axiosBaseQuery,
    tagTypes: ['Auth', 'User'],
    endpoints: (builder) => ({
        /**
         * User registration mutation
         * @param {Object} userData - Registration data
         * @param {string} userData.fullName - Full name (required)
         * @param {string} userData.userName - Username (required)
         * @param {string} userData.email - Email address (required)
         * @param {string} userData.phoneNumber - Phone number (required)
         * @param {string} userData.password - Password (required)
         * @param {string} userData.unit - Unit (required)
         * @param {string} [userData.role] - User role (default: "STUDENT")
         * @param {string} [userData.empId] - Employee ID
         * @param {boolean} [userData.isEmployee] - Is employee flag
         * @param {boolean} [userData.isAdmin] - Is admin flag
         * @param {boolean} [userData.isTrainer] - Is trainer flag
         * @param {string} [userData.shift] - Work shift
         * @param {string} [userData.idCard] - ID card number
         * @param {string} [userData.privileges] - User privileges
         * @param {string} [userData.joiningDate] - Joining date
         * @param {string} [userData.leavingDate] - Leaving date
         */
        userRegister: builder.mutation({
            query: (userData) => ({
                url: "/api/v1/auth/register",
                method: "POST",
                data: userData
            }),
            invalidatesTags: ['User'],
        }),

        userLogin: builder.mutation({
            query: ({ email, userName, password }) => ({
                url: "/api/v1/auth/login",
                method: "POST",
                data: email
                    ? { email, password }
                    : { userName, password }
            }),
            invalidatesTags: ['Auth'],
        }),

        userLogout: builder.mutation({
            query: () => ({
                url: "/api/v1/auth/logout",
                method: "GET",
            }),
            invalidatesTags: ['Auth'],
        }),

        getUserProfile: builder.query({
            query: () => ({
                url: "/api/v1/auth/profile",
                method: "GET",
            }),
            providesTags: ['Auth'],
        }),

        forgotPassword: builder.mutation({
            query: ({ email }) => ({
                url: "/api/v1/auth/forgot-password",
                method: "POST",
                data: { email }
            }),
        }),

        resetPassword: builder.mutation({
            query: ({ token, password }) => ({
                url: `/api/v1/auth/reset-password/${token}`,
                method: "POST",
                data: { password }
            }),
        }),
    }),
});

export const {
    useUserRegisterMutation,
    useUserLoginMutation,
    useUserLogoutMutation,
    useGetUserProfileQuery,
    useForgotPasswordMutation,
    useResetPasswordMutation,
} = authApi;