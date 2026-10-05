import { authSession } from "@/utils/authSession.js";
import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { toast } from "sonner";
import axiosInstance from "@/services/requests/axiosInstance.js";
import { redirect } from "react-router-dom";

const getStoredUser = () => {
    try {
        const stored = authSession.getItem("user");
        return stored ? JSON.parse(stored) : null;
    } catch {
        return null;
    }
};

const initialState = {
    user: getStoredUser(),
    isLoggedIn: authSession.getItem("isLoggedIn") === "true",
    isLoading: false,
    error: null,
    redirectUrl: null,
}
export const login = createAsyncThunk("api/v1/auth/login", async (data, { rejectWithValue }) => {
    try {
        const res = await axiosInstance.post("/api/v1/auth/login", data);
        if (res?.data?.data?.user) {
            authSession.setItem("user", JSON.stringify(res.data.data.user));
            if (res.data.data.accessToken) {
                authSession.setItem("token", res.data.data.accessToken);
            }
        }
        return res?.data;
    } catch (err) {
        const inputUser = (data?.userName || "").trim().toLowerCase();
        

        const errorMessage = err.response?.data?.message || "Login failed. Please check your credentials.";
        return rejectWithValue(errorMessage);
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

export const dojoRegister = createAsyncThunk("api/v1/auth/dojo-register", async (data, { rejectWithValue }) => {
    try {
        const res = await axiosInstance.post("/api/v1/auth/dojo-register", data)
        return res?.data
    } catch (err) {
        const errorMessage = err.response?.data?.message || "Dojo candidate registration failed."
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
        const res = await axiosInstance.get("/api/v1/auth/profile");
        if (res?.data?.data) {
            authSession.setItem("user", JSON.stringify(res.data.data));
        }
        return res?.data;
    } catch (err) {
        const storedUser = authSession.getItem("user");
        if (storedUser) {
            try {
                return {
                    statusCode: 200,
                    data: JSON.parse(storedUser),
                    message: "User profile loaded from session"
                };
            } catch (e) {}
        }
        const errorMessage = err.response?.data?.message || "Authentication failed";
        return rejectWithValue(errorMessage);
    }
});

const authSlice = createSlice({
    name: "auth",
    initialState,
    reducers: {
        restoreSession: (state) => {
            state.user = getStoredUser();
            state.isLoggedIn = authSession.getItem('isLoggedIn') === 'true' && !!authSession.getItem('token') && !!state.user;
            if (!state.isLoggedIn) state.user = null;
        },
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
                authSession.setItem("isLoggedIn", state.isLoggedIn ? "true" : "false")
                if (state.user) {
                    authSession.setItem("user", JSON.stringify(state.user))
                }
                
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
                authSession.setItem("isLoggedIn", "false")
                authSession.removeItem("user")
                
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
                authSession.setItem("isLoggedIn", state.isLoggedIn ? "true" : "false")
                
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
                authSession.setItem("isLoggedIn", "false")
                
                // Show error toast
                toast.error('Registration Failed', {
                    description: action.payload || 'An error occurred during registration',
                    duration: 4000,
                })
            })
            // Dojo Register cases  
            .addCase(dojoRegister.pending, (state) => {
                state.isLoading = true
                state.error = null
            })
            .addCase(dojoRegister.fulfilled, (state, action) => {
                state.isLoading = false
                state.error = null
                
                // Show success toast (do not update user or isLoggedIn state)
                const candidateName = action?.payload?.data?.user?.fullName || 'Candidate'
                toast.success('Dojo Candidate Registered Successfully!', {
                    description: `${candidateName} has been added to the pipeline.`,
                    duration: 4000,
                })
            })
            .addCase(dojoRegister.rejected, (state, action) => {
                state.isLoading = false
                state.error = action.payload
                
                // Show error toast
                toast.error('Dojo Candidate Registration Failed', {
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
                authSession.setItem("isLoggedIn", "false")
                authSession.removeItem("user")
                authSession.removeItem("token")
                
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
                authSession.setItem("isLoggedIn", "false")
                authSession.removeItem("user")
                authSession.removeItem("token")
                
                // Show warning toast
                toast.warning('Session Cleared', {
                    description: 'You have been logged out locally.',
                    duration: 3000,
                })
            })
            .addCase(profile.pending, (state) => {
                state.isLoading = true;
            })
            .addCase(profile.fulfilled, (state, action) => {
                state.isLoading = false;
                state.user = action?.payload?.data || null;
                state.isLoggedIn = !!state.user;
                authSession.setItem("isLoggedIn", state.isLoggedIn ? "true" : "false");
            })
            .addCase(profile.rejected, (state) => {
                state.isLoading = false;
                state.user = null;
                state.isLoggedIn = false;
                authSession.setItem("isLoggedIn", "false");
            })
    },
})

export const { clearRedirectUrl, restoreSession } = authSlice.actions

export default authSlice.reducer

