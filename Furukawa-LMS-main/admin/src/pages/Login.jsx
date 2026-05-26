import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    let targetPath = '/';

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
      <div className="absolute inset-0 bg-black/70" aria-hidden="true" />
      <div className="relative z-10 flex min-h-screen items-center justify-center p-4">
        {/* Login Card Container */}
        <div className="w-full max-w-[430px]">
          <Card className="bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 rounded-[32px] overflow-hidden">

          <CardHeader className="text-center space-y-6 pt-12 pb-2">
            {/* Logo */}
            <div className="flex justify-center mb-2">
              <div className="w-full h-24 bg-white rounded-2xl shadow-sm border border-slate-100 flex items-center justify-center p-3 animate-fade-in">
                <img
                  src="/fme_transparent.png"
                  alt="FURUKAWA Logo"
                  className="w-full h-full object-contain"
                />
              </div>
            </div>

            <div className="space-y-1">
              <CardTitle className="text-2xl font-bold text-slate-900 tracking-tight">
                DIGITAL GATEWAY
              </CardTitle>
              {/* <CardDescription className="text-slate-500 font-medium text-sm uppercase tracking-wide">
                FURUKAWA Dashboard
              </CardDescription> */}
            </div>
          </CardHeader>

          <CardContent className="p-8 pt-6">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">

              <div className="space-y-4">
                {/* Username Field */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="userName"
                    className="text-[11px] font-bold text-slate-400 uppercase tracking-wider ml-1"
                  >
                    Username
                  </label>
                  <div className={`relative group transition-all duration-200 rounded-xl bg-slate-50 border ${errors.userName ? 'border-red-300 ring-2 ring-red-100' : 'border-slate-200 focus-within:border-blue-500 focus-within:bg-white focus-within:ring-4 focus-within:ring-blue-500/10'}`}>
                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors">
                      <User className="h-4 w-4" />
                    </div>
                    <input
                      id="userName"
                      {...register('userName')}
                      type="text"
                      placeholder="username"
                      className="w-full bg-transparent h-11 pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
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
                    className="text-[11px] font-bold text-slate-400 uppercase tracking-wider ml-1"
                  >
                    Password
                  </label>
                  <div className={`relative group transition-all duration-200 rounded-xl bg-slate-50 border ${errors.password ? 'border-red-300 ring-2 ring-red-100' : 'border-slate-200 focus-within:border-blue-500 focus-within:bg-white focus-within:ring-4 focus-within:ring-blue-500/10'}`}>
                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors">
                      <Lock className="h-4 w-4" />
                    </div>
                    <input
                      id="password"
                      {...register('password')}
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      className="w-full bg-transparent h-11 pl-10 pr-10 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={isLoading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
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
                <Button
                  type="submit"
                  className="w-full h-12 bg-[#1a56db] hover:bg-[#1546b3] text-white font-semibold rounded-xl text-[15px] shadow-[0_4px_14px_0_rgba(26,86,219,0.39)] transition-all duration-200 hover:shadow-[0_6px_20px_rgba(26,86,219,0.23)] hover:-translate-y-0.5 active:translate-y-0 active:scale-95 disabled:opacity-70 disabled:hover:translate-y-0 disabled:hover:shadow-none"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <div className="flex items-center justify-center gap-2">
                      Login Securely
                      <ArrowRight className="w-4 h-4 opacity-80" />
                    </div>
                  )}
                </Button>
              </div>

            </form>

            <div className="mt-8 text-center">
              <p className="text-slate-400 text-[11px] uppercase tracking-wide">
                Contact FME IT support for  access issues
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
    </div>
  );
};

export default Login;
