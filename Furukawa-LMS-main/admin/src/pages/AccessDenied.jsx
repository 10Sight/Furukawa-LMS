import React from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { IconArrowLeft, IconLock } from "@tabler/icons-react";

const AccessDenied = () => {
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.auth);

  const handleGoHome = () => {
    if (!user) {
      navigate("/login");
      return;
    }
    if (user.isAdmin || user.role === "SUPERADMIN") {
      navigate("/admin");
    } else if (user.isTrainer) {
      navigate("/trainer");
    } else if (user.isEmployee) {
      navigate("/student");
    } else if (user.role === "CUSTOM") {
      navigate("/portal");
    } else {
      navigate("/");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-950 to-black text-gray-100 flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background ambient warning glows */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-red-600/10 rounded-full blur-3xl pointer-events-none animate-pulse"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-amber-600/10 rounded-full blur-3xl pointer-events-none animate-pulse duration-5000"></div>

      {/* Main Glassmorphic Card */}
      <div className="max-w-md w-full bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl flex flex-col items-center text-center relative z-10">
        {/* Furukawa Minda Electric Logo */}
        <div className="mb-8">
          <img
            src="/fme_transparent.png"
            alt="Furukawa Minda Electric"
            className="h-10 w-auto object-contain drop-shadow-[0_2px_8px_rgba(255,255,255,0.15)]"
          />
        </div>

        {/* High-Fidelity Access Denied Character SVG Illustration */}
        <div className="w-64 h-64 mb-6 relative group">
          <svg
            viewBox="0 0 250 250"
            className="w-full h-full drop-shadow-[0_10px_15px_rgba(239,68,68,0.2)]"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Warning Rings */}
            <circle cx="125" cy="125" r="110" stroke="#ef4444" strokeWidth="1" strokeDasharray="6 8" opacity="0.3" className="animate-spin duration-30000" />
            <circle cx="125" cy="125" r="85" stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="4 4" opacity="0.3" />

            {/* Glowing Red Warning Light behind Shield */}
            <circle cx="70" cy="135" r="45" fill="url(#warningGlow)" opacity="0.25" />

            {/* Character - Dark Skinned Flat Vector making Stop gesture */}
            {/* Head & Neck */}
            <path d="M150 105 C146 105 144 101 144 97 L144 82 C144 78 146 74 150 74 C154 74 156 78 156 82 L156 97 C156 101 154 105 150 105 Z" fill="#4d2f24" />
            <circle cx="150" cy="74" r="22" fill="#4d2f24" /> {/* Dark Skin head */}

            {/* Hair */}
            <path d="M128 74 C128 60 137 50 150 50 C163 50 172 60 172 74 C172 76 170 78 168 78 C160 78 160 70 150 70 C140 70 140 78 132 78 C130 78 128 76 128 74 Z" fill="#111827" />

            {/* Eyes (Serious/Firm) */}
            <ellipse cx="143" cy="73" rx="2" ry="2.5" fill="#ffffff" />
            <circle cx="143" cy="73" r="1" fill="#111827" />
            <ellipse cx="157" cy="73" rx="2" ry="2.5" fill="#ffffff" />
            <circle cx="157" cy="73" r="1" fill="#111827" />

            {/* Eyebrows (Serious/Frowning slightly) */}
            <path d="M138 68 Q143 66 147 69" stroke="#111827" strokeWidth="1.8" strokeLinecap="round" fill="none" />
            <path d="M153 69 Q157 66 162 68" stroke="#111827" strokeWidth="1.8" strokeLinecap="round" fill="none" />

            {/* Neutral Mouth */}
            <path d="M146 87 L154 87" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" fill="none" />

            {/* Torso & Clothing */}
            {/* Dark Grey Jacket / Uniform */}
            <path d="M125 135 L175 135 L169 105 L131 105 Z" fill="#374151" />
            {/* Inner T-shirt (Amber) */}
            <path d="M142 105 C142 110 158 110 158 105 Z" fill="#f59e0b" />

            {/* Right Arm (Extended forward in Stop/Barrier gesture) */}
            {/* Sleeve */}
            <path d="M127 110 L105 118 L111 128 L129 120 Z" fill="#374151" />
            {/* Hand showing palm (Stop gesture) */}
            <path d="M105 118 L90 120 C85 120 83 115 87 112 L97 105 Z" fill="#4d2f24" opacity="0.9" />
            {/* Raised fingers */}
            <path d="M86 112 Q83 95 86 95 C88 95 90 98 90 105" stroke="#4d2f24" strokeWidth="3" strokeLinecap="round" fill="none" />
            <path d="M90 110 Q90 93 93 93 C95 93 97 96 97 105" stroke="#4d2f24" strokeWidth="3" strokeLinecap="round" fill="none" />
            <path d="M95 112 Q97 95 99 95 C101 95 102 98 102 108" stroke="#4d2f24" strokeWidth="3" strokeLinecap="round" fill="none" />

            {/* Left Arm (Relaxed) */}
            <path d="M173 110 L188 126 L180 135 L165 120 Z" fill="#374151" />
            <path d="M188 126 L196 138 C198 141 203 137 200 134 L192 122 Z" fill="#4d2f24" />

            {/* Glowing Shield & Padlock (Barrier on left side) */}
            <g className="animate-bounce duration-5000">
              {/* Outer Shield Outline */}
              <path d="M70 90 C100 90 110 100 110 130 C110 165 70 190 70 190 C70 190 30 165 30 130 C30 100 40 90 70 90 Z" fill="#ef4444" fillOpacity="0.1" stroke="#ef4444" strokeWidth="3" />
              {/* Inner Shield */}
              <path d="M70 100 C92 100 100 108 100 130 C100 157 70 178 70 178 C70 178 40 157 40 130 C40 108 48 100 70 100 Z" fill="#ef4444" fillOpacity="0.2" />

              {/* Padlock inside shield */}
              {/* Shackle */}
              <path d="M58 132 V122 C58 115 62 111 70 111 C78 111 82 115 82 122 V132" stroke="#f59e0b" strokeWidth="3.5" strokeLinecap="round" fill="none" />
              {/* Body */}
              <rect x="52" y="130" width="36" height="26" rx="6" fill="#f59e0b" />
              {/* Keyhole */}
              <circle cx="70" cy="140" r="3" fill="#111827" />
              <path d="M70 143 L73 151 H67 Z" fill="#111827" />
            </g>

            {/* Definitions */}
            <defs>
              <radialGradient id="warningGlow" cx="0.5" cy="0.5" r="0.5" fx="0.5" fy="0.5">
                <stop offset="0%" stopColor="#ef4444" stopOpacity="0.5" />
                <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
              </radialGradient>
            </defs>
          </svg>

          {/* Floating lock badge */}
          <div className="absolute top-4 left-4 bg-red-500 text-white rounded-full p-2 shadow-lg animate-bounce">
            <IconLock size={20} stroke={2} />
          </div>
        </div>

        {/* Error Info */}
        <h1 className="text-5xl font-extrabold tracking-tight mb-3 text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-amber-500 drop-shadow-[0_2px_10px_rgba(239,68,68,0.3)]">
          403
        </h1>
        <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
        <p className="text-gray-400 text-sm mb-8 max-w-xs leading-relaxed">
          You do not have the required permissions to view this resource. Please contact your system administrator.
        </p>

        {/* Navigation Button */}
        <button
          onClick={handleGoHome}
          className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white font-semibold transition-all duration-300 hover:scale-[1.02] shadow-lg shadow-red-500/25 flex items-center justify-center gap-2 group"
        >
          <IconArrowLeft size={18} className="transition-transform group-hover:-translate-x-1" />
          Back to Dashboard
        </button>
      </div>
    </div>
  );
};

export default AccessDenied;
