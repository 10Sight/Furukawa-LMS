import React, { useState } from 'react';
import { User, Lock, Eye, EyeOff, ArrowRight, AlertCircle, ShieldCheck, Users } from 'lucide-react';
import { authApi } from '../../services/api';

// Pre-configured credentials for quick testing and client-side fallback
const DEMO_ACCOUNTS = [
  {
    type: 'Admin',
    username: 'ST080014',
    password: 'ST080014@FME',
    employeeId: 'EMP0080',
    department: 'Assembly',
    name: 'ST080014',
    role: 'admin',
  },
  {
    type: 'Employee',
    username: 'Shivampanday',
    password: 'ST080796',
    employeeId: 'EMP0089',
    department: 'C&C Quality',
    name: 'Shivam Panday',
    role: 'employee',
  },
  {
    type: 'Dummy 1',
    username: 'AS081215',
    password: 'AS081215@FME',
    employeeId: 'EMP0091',
    department: 'SRC Quality',
    name: 'Yogesh Kumar',
    role: 'employee',
  },
  {
    type: 'Dummy 2',
    username: 'BW041920',
    password: 'BW041920@FME',
    employeeId: 'EMP0092',
    department: 'Die Casting',
    name: 'Rahul Sharma',
    role: 'employee',
  },
  {
    type: 'Dummy 3',
    username: 'GJ092311',
    password: 'GJ092311@FME',
    employeeId: 'EMP0093',
    department: 'EHS Safety',
    name: 'Amit Patel',
    role: 'employee',
  },
  {
    type: 'Dummy 4',
    username: 'BW071562',
    password: 'BW071562@FME',
    employeeId: 'EMP0094',
    department: 'Plant Maintenance',
    name: 'Sandeep Verma',
    role: 'employee',
  },
  {
    type: 'Dummy 5',
    username: 'GJ018442',
    password: 'GJ018442@FME',
    employeeId: 'EMP0095',
    department: 'Wiring Harness',
    name: 'Priya Nair',
    role: 'employee',
  },
];

export default function LoginPage({ onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('Please enter both username and password.');
      return;
    }

    setLoading(true);
    setError('');

    const trimmedUser = username.trim();
    const trimmedPass = password.trim();

    try {
      const res = await authApi.login(trimmedUser, trimmedPass);
      if (res && res.success && res.user) {
        localStorage.setItem('ptm_auth_user', JSON.stringify(res.user));
        onLoginSuccess(res.user);
        return;
      } else {
        setError(res?.message || 'Invalid username or password.');
      }
    } catch (err) {
      // Local fallback in case network / backend server is initializing
      const match = DEMO_ACCOUNTS.find(
        (acc) =>
          acc.username.toLowerCase() === trimmedUser.toLowerCase() &&
          acc.password === trimmedPass
      );

      if (match) {
        localStorage.setItem('ptm_auth_user', JSON.stringify(match));
        onLoginSuccess(match);
        return;
      }

      setError('Invalid User ID or Password. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  const fillAccount = (account) => {
    setUsername(account.username);
    setPassword(account.password);
    setError('');
  };

  return (
    <div 
      className="relative min-h-screen w-full flex items-center justify-center p-4 bg-slate-100 bg-cover bg-center select-none"
      style={{
        backgroundImage: `linear-gradient(rgba(240, 245, 250, 0.40), rgba(240, 245, 250, 0.40)), url('/login-bg.jpg')`,
      }}
    >
      {/* Background industrial soft blur overlay matching screenshot */}
      <div className="absolute inset-0 backdrop-blur-[2px] pointer-events-none" />

      {/* Login Card */}
      <div className="relative z-10 w-full max-w-[420px] bg-white/95 backdrop-blur-md rounded-3xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.28)] border border-white/80 p-8 sm:p-9 transition-all">
        {/* Logo and Titles matching reference screenshot */}
        <div className="text-center mb-7">
          <div className="inline-flex items-center justify-center mb-3">
            <img 
              src="/fme-logo.png" 
              alt="Furukawa Minda Electric (Fme)" 
              className="h-12 w-auto object-contain"
              onError={(e) => {
                e.target.style.display = 'none';
                e.target.nextSibling.style.display = 'inline-flex';
              }}
            />
            {/* Crisp SVG Logo Fallback */}
            <div className="hidden items-center text-3xl font-black italic tracking-tight font-sans">
              <span className="text-[#004B9B] mr-0.5">F</span>
              <span className="text-[#FF7900]">me</span>
            </div>
          </div>
          <h1 className="text-xl font-extrabold text-[#1E3A8A] tracking-wider uppercase">
            DIGITAL GATEWAY
          </h1>
          <p className="text-[11px] font-semibold text-slate-400 tracking-widest uppercase mt-0.5">
            LEARNING MANAGEMENT SYSTEM
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
            <span>{error}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5 ml-1">
              USERNAME
            </label>
            <div className="relative flex items-center">
              <span className="absolute left-3.5 text-slate-400 pointer-events-none">
                <User className="w-4 h-4" />
              </span>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="username"
                className="w-full bg-[#F8FAFC] border border-slate-200 rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all font-medium"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5 ml-1">
              PASSWORD
            </label>
            <div className="relative flex items-center">
              <span className="absolute left-3.5 text-slate-400 pointer-events-none">
                <Lock className="w-4 h-4" />
              </span>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-[#F8FAFC] border border-slate-200 rounded-xl pl-10 pr-10 py-2.5 text-sm text-slate-800 placeholder-slate-400 outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all font-medium"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 text-slate-400 hover:text-slate-600 cursor-pointer focus:outline-none"
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3 px-5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25 active:scale-[0.99] transition-all cursor-pointer disabled:opacity-70"
          >
            <span>{loading ? 'Logging in...' : 'Login Securely'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* Quick Demo Switcher Buttons */}
        <div className="mt-5 pt-4 border-t border-slate-100 flex flex-col items-center gap-2.5 text-center">
          <div className="w-full flex items-center justify-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => fillAccount(DEMO_ACCOUNTS[0])}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
              title="Admin: ST080014 / ST080014@FME"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
              <span>Admin (ST080014)</span>
            </button>

            <button
              type="button"
              onClick={() => fillAccount(DEMO_ACCOUNTS[1])}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
              title="Employee: Shivampanday / ST080796"
            >
              <User className="w-3.5 h-3.5 text-blue-600" />
              <span>Employee (Shivampanday)</span>
            </button>
          </div>

          <div className="w-full flex items-center justify-center gap-1.5 flex-wrap">
            <span className="text-[10px] text-slate-400 font-semibold mr-1 flex items-center gap-1">
              <Users className="w-3 h-3" /> Dummy:
            </span>
            {DEMO_ACCOUNTS.slice(2, 6).map((acc, index) => (
              <button
                key={acc.username}
                type="button"
                onClick={() => fillAccount(acc)}
                className="text-[10px] font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 px-1.5 py-0.5 rounded transition-colors cursor-pointer"
                title={`${acc.name} (${acc.username}) - ${acc.department}`}
              >
                {acc.name.split(' ')[0]}
              </button>
            ))}
          </div>
          
          <p className="text-[10px] text-slate-400 font-semibold tracking-wider uppercase mt-1">
            CONTACT FME IT SUPPORT FOR ACCESS ISSUES
          </p>
        </div>
      </div>
    </div>
  );
}
