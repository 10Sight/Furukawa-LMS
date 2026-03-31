import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { toast } from "sonner";
import axiosInstance from "@/Helper/axiosInstance";
import { redirect } from "react-router-dom";

const initialState = {
    user: null,
    isLoggedIn: localStorage.getItem("isLoggedIn") === "true",
    isLoading: false,
    error: null,
    redirectUrl: null,
}
export const login = createAsyncThunk("api/v1/auth/login", async (data, { rejectWithValue }) => {
    try {
        const res = await axiosInstance.post("/api/v1/auth/login", data)
        return res?.data
    } catch (err) {
        const errorMessage = err.response?.data?.message || "Login failed. Please check your credentials."
        return rejectWithValue(errorMessage)
    }
})

export const register = createAsyncThunk("api/v1/auth/register", async (data, { rejectWithValue }) => {
    try {
        const res = await axiosInstance.post("/api/v1/auth/register", data)
        return res?.data
    } catch (err) {
        const errorMessage = err.response?.data?.message || "Registration failed. Please try again."
        return rejectWithValue(errorMessage)
    }
});

export const logout = createAsyncThunk("auth/logout", async (_, { rejectWithValue }) => {
    try {
        const res = await axiosInstance.get("/api/v1/auth/logout")
        return res?.data
    } catch (err) {
        const errorMessage = err.response?.data?.message || "Logout failed"
        return rejectWithValue(errorMessage)
    }
});

export const forgotPassword = createAsyncThunk("api/v1/auth/forgot-password", async (data) => {
    try {
        const res = await axiosInstance.post("/api/v1/auth/forgot-password", data)
        return res?.data
    } catch (err) {
        return toast.error(err.response.data.message)
    }
});

export const resetPassword = createAsyncThunk("api/v1/auth/reset-password", async ({ token, newPassword }) => {
    try {
        const res = await axiosInstance.post(`/api/v1/auth/reset-password/${token}`, newPassword)
        return res?.data
    } catch (err) {
        return toast.error(err.response.data.message)
    }
});

export const profile = createAsyncThunk("api/v1/auth/profile", async (_, { rejectWithValue }) => {
    try {
        const res = await axiosInstance.get("/api/v1/auth/profile")
        return res?.data
    } catch (err) {
        const errorMessage = err.response?.data?.message || "Authentication failed"
        return rejectWithValue(errorMessage)
    }
});

const authSlice = createSlice({
    name: "auth",
    initialState,
    reducers: {
        clearRedirectUrl: (state) => {
            state.redirectUrl = null
        }
    },
    extraReducers: (builder) => {
        builder
            // Login cases
            .addCase(login.pending, (state) => {
                state.isLoading = true
                state.error = null
            })
            .addCase(login.fulfilled, (state, action) => {
                state.isLoading = false
                state.user = action?.payload?.data?.user || null
                state.isLoggedIn = !!state.user
                state.error = null
                state.redirectUrl = action?.payload?.data?.redirectUrl
                localStorage.setItem("isLoggedIn", state.isLoggedIn ? "true" : "false")
                
                // Show success toast
                const userName = state.user?.fullName || state.user?.userName || 'User'
                toast.success('Login Successful!', {
                    description: `Welcome back, ${userName}!`,
                    duration: 4000,
                })
            })
            .addCase(login.rejected, (state, action) => {
                state.isLoading = false
                state.error = action.payload
                state.user = null
                state.isLoggedIn = false
                localStorage.setItem("isLoggedIn", "false")
                
                // Show error toast
                toast.error('Login Failed', {
                    description: action.payload || 'An error occurred during login',
                    duration: 4000,
                })
            })
            // Register cases  
            .addCase(register.pending, (state) => {
                state.isLoading = true
                state.error = null
            })
            .addCase(register.fulfilled, (state, action) => {
                state.isLoading = false
                state.user = action?.payload?.data?.user || null
                state.isLoggedIn = !!state.user
                state.error = null
                localStorage.setItem("isLoggedIn", state.isLoggedIn ? "true" : "false")
                
                // Show success toast
                const userName = state.user?.fullName || state.user?.userName || 'User'
                toast.success('Registration Successful!', {
                    description: `Welcome, ${userName}!`,
                    duration: 4000,
                })
            })
            .addCase(register.rejected, (state, action) => {
                state.isLoading = false
                state.error = action.payload
                state.user = null
                state.isLoggedIn = false
                localStorage.setItem("isLoggedIn", "false")
                
                // Show error toast
                toast.error('Registration Failed', {
                    description: action.payload || 'An error occurred during registration',
                    duration: 4000,
                })
            })
            // Logout cases
            .addCase(logout.pending, (state) => {
                state.isLoading = true
                state.error = null
            })
            .addCase(logout.fulfilled, (state) => {
                state.isLoading = false
                state.user = null
                state.isLoggedIn = false
                state.error = null
                localStorage.setItem("isLoggedIn", "false")
                
                // Show success toast
                toast.success('Logged Out Successfully', {
                    description: 'You have been safely logged out.',
                    duration: 3000,
                })
            })
            .addCase(logout.rejected, (state, action) => {
                state.isLoading = false
                // Even if logout API fails, clear local state
                state.user = null
                state.isLoggedIn = false
                localStorage.setItem("isLoggedIn", "false")
                
                // Show warning toast
                toast.warning('Session Cleared', {
                    description: 'You have been logged out locally.',
                    duration: 3000,
                })
            })
            .addCase(profile.fulfilled, (state, action) => {
                state.user = action?.payload?.data || null
                state.isLoggedIn = !!state.user
                localStorage.setItem("isLoggedIn", state.isLoggedIn ? "true" : "false")
            })
            .addCase(profile.rejected, (state) => {
                state.user = null
                state.isLoggedIn = false
                localStorage.setItem("isLoggedIn", "false")
            })
    },
})

export const { clearRedirectUrl } = authSlice.actions

export default authSlice.reducer

