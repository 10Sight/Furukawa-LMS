import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, useLocation } from 'react-router-dom';
import { Loader2, User, Lock, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import { login } from '@/Redux/Slice/AuthSlice';
import { getFirstAllowedPage } from '@/constants/pageRegistry';

const loginSchema = z.object({
  userName: z
    .string()
    .min(1, 'Username is required')
    .min(3, 'Username must be at least 3 characters'),
  password: z
    .string()
    .min(1, 'Password is required')
    .min(6, 'Password must be at least 6 characters')
});

const Login = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();

  const { isLoading, isLoggedIn, user } = useSelector((state) => state.auth);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      userName: '',
      password: ''
    }
  });

  useEffect(() => {
    if (!isLoggedIn || !user) return;

    // Redirect based on role
    const from = location.state?.from;
    let targetPath = (from && from.pathname && from.pathname !== '/login')
      ? (from.pathname + (from.search || ""))
      : null;

    if (!targetPath) {
      if (user.role === 'SUPERADMIN' || (user.isAdmin && user.role !== 'CUSTOM')) {
        targetPath = '/';
      } else if (user.isTrainer && user.role !== 'CUSTOM') {
        targetPath = '/trainer';
      } else if (user.role === 'CUSTOM') {
        const allowed = user.customRole?.allowedPages || [];
        const allowedPages = typeof allowed === 'string' ? JSON.parse(allowed) : allowed;
        const hasLandingAccess = allowedPages.includes('landing-page');

        const layout = user.customRole?.targetLayout?.toLowerCase() || 'custom';

        if (hasLandingAccess) {
          targetPath = '/';
        } else {
          // Find the first actually allowed page for this layout to prevent flash
          const firstPage = getFirstAllowedPage(layout, user, (key, def) => def);
          targetPath = firstPage || (layout === 'custom' ? '/portal' : `/${layout}`);
        }
      } else {
        // Students/Employees go to Student Dashboard
        targetPath = '/student';
      }
    }

    if (location.pathname !== targetPath) {
      navigate(targetPath, { replace: true });
    }
  }, [isLoggedIn, user, navigate, location]);

  const onSubmit = async (data) => {
    const loginData = {
      userName: data.userName.toLowerCase(),
      password: data.password
    };
    dispatch(login(loginData));
  };

  return (
    <div
      className="relative min-h-screen bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: "url('/Furukawa_Minda.jpg')" }}
    >
      {/* Light overlay */}
      <div
        className="absolute inset-0 bg-gradient-to-br from-white/60 via-blue-50/50 to-slate-100/60 backdrop-blur-[2px]"
        aria-hidden="true"
      />

      {/* Soft ambient circles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        <div className="absolute -top-24 -left-24 w-80 h-80 bg-blue-200/40 rounded-full blur-3xl" />
        <div className="absolute -bottom-24 -right-24 w-80 h-80 bg-indigo-200/40 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 flex min-h-screen items-center justify-center p-4">
        {/* Light glass card */}
        <div className="w-full max-w-[430px] rounded-[32px] overflow-hidden bg-white/75 backdrop-blur-2xl border border-white/90 shadow-[0_20px_60px_-10px_rgba(0,0,0,0.18)]">

          {/* Header */}
          <div className="text-center space-y-5 pt-12 pb-4 px-8">
            {/* Logo container */}
            <div className="flex justify-center">
              <div className="w-full h-32 rounded-2xl flex items-center justify-center p-3">
                <img
                  src="/fme_transparent.png"
                  alt="FURUKAWA Logo"
                  className="w-full h-full object-contain"
                />
              </div>
            </div>

            <div className="space-y-1">
              <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-slate-800 via-blue-700 to-indigo-700 bg-clip-text text-transparent">
                DIGITAL GATEWAY
              </h1>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.2em]">
                Learning Management System
              </p>
            </div>
          </div>

          {/* Form body */}
          <div className="p-8 pt-4">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">

              <div className="space-y-4">
                {/* Username Field */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="userName"
                    className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1 cursor-pointer"
                  >
                    Username
                  </label>
                  <div className={`relative group transition-all duration-200 rounded-xl border ${errors.userName ? 'bg-red-50 border-red-300 ring-2 ring-red-100' : 'bg-slate-50/80 border-slate-200 focus-within:border-blue-400 focus-within:bg-white focus-within:ring-4 focus-within:ring-blue-500/10'}`}>
                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors duration-200">
                      <User className="h-4 w-4" />
                    </div>
                    <input
                      id="userName"
                      {...register('userName')}
                      type="text"
                      placeholder="username"
                      className="w-full bg-transparent h-11 pl-10 pr-4 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed cursor-text"
                      disabled={isLoading}
                    />
                  </div>
                  {errors.userName && (
                    <p className="text-xs text-red-500 font-medium ml-1 animate-slide-up">
                      {errors.userName.message}
                    </p>
                  )}
                </div>

                {/* Password Field */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="password"
                    className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1 cursor-pointer"
                  >
                    Password
                  </label>
                  <div className={`relative group transition-all duration-200 rounded-xl border ${errors.password ? 'bg-red-50 border-red-300 ring-2 ring-red-100' : 'bg-slate-50/80 border-slate-200 focus-within:border-blue-400 focus-within:bg-white focus-within:ring-4 focus-within:ring-blue-500/10'}`}>
                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors duration-200">
                      <Lock className="h-4 w-4" />
                    </div>
                    <input
                      id="password"
                      {...register('password')}
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      className="w-full bg-transparent h-11 pl-10 pr-10 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed cursor-text"
                      disabled={isLoading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none transition-colors duration-150 cursor-pointer"
                      tabIndex={-1}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="text-xs text-red-500 font-medium ml-1 animate-slide-up">
                      {errors.password.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full h-12 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold rounded-xl text-[15px] shadow-[0_4px_20px_rgba(99,102,241,0.35)] hover:shadow-[0_6px_28px_rgba(99,102,241,0.5)] transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-[0_4px_20px_rgba(99,102,241,0.35)] cursor-pointer flex items-center justify-center gap-2"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      Login Securely
                      <ArrowRight className="w-4 h-4 opacity-80" />
                    </>
                  )}
                </button>
              </div>

            </form>

            <div className="mt-8 text-center">
              <p className="text-slate-400 text-[11px] uppercase tracking-wide">
                Contact FME IT support for access issues
              </p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default Login;
