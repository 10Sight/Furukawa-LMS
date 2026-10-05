import React from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";

const NotFound = () => {
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
    <div className="min-h-screen bg-white text-gray-900 flex flex-col items-center justify-center p-6 font-sans">
      <div className="max-w-xl w-full flex flex-col items-center text-center animate-fade-in">
        {/* Giant 404 Text with low-poly textured pattern */}
        <div className="w-full flex justify-center mb-4">
          <svg
            viewBox="0 0 350 150"
            className="w-full max-w-sm md:max-w-md h-auto select-none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              {/* Gray-to-Silver Gradient */}
              <linearGradient id="grayGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#e5e7eb" />
                <stop offset="50%" stopColor="#d1d5db" />
                <stop offset="100%" stopColor="#9ca3af" />
              </linearGradient>

              {/* Low-Poly Facet Texture Pattern */}
              <pattern
                id="polyPattern"
                width="35"
                height="35"
                patternUnits="userSpaceOnUse"
                patternTransform="rotate(25)"
              >
                <polygon points="0,0 17.5,0 8.75,17.5" fill="#ffffff" fillOpacity="0.45" />
                <polygon points="17.5,0 35,0 26.25,17.5" fill="#000000" fillOpacity="0.04" />
                <polygon points="8.75,17.5 26.25,17.5 17.5,35" fill="#ffffff" fillOpacity="0.25" />
                <polygon points="0,0 8.75,17.5 0,35" fill="#000000" fillOpacity="0.07" />
                <polygon points="17.5,35 35,35 26.25,17.5" fill="#ffffff" fillOpacity="0.3" />
                <polygon points="26.25,17.5 35,17.5 35,35" fill="#000000" fillOpacity="0.04" />
              </pattern>
            </defs>

            {/* Base Text with Gradient */}
            <text
              x="50%"
              y="115"
              textAnchor="middle"
              fill="url(#grayGrad)"
              fontSize="145"
              fontWeight="900"
              fontStyle="italic"
              fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
              letterSpacing="-6"
            >
              404
            </text>

            {/* Overlay Text with Low-Poly Pattern */}
            <text
              x="50%"
              y="115"
              textAnchor="middle"
              fill="url(#polyPattern)"
              fontSize="145"
              fontWeight="900"
              fontStyle="italic"
              fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
              letterSpacing="-6"
            >
              404
            </text>
          </svg>
        </div>

        {/* Title */}
        <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 mb-4 tracking-tight">
          Oops! This Page Could Not Be Found
        </h1>

        {/* Subtitle / Description */}
        <p className="text-gray-500 text-xs md:text-sm font-semibold max-w-md leading-relaxed tracking-wider mb-8 uppercase px-4">
          Sorry but the page you are looking for does not exist, have been removed. name changed or is temporarily unavailable
        </p>

        {/* Action Button */}
        <button
          onClick={handleGoHome}
          className="bg-[#4f83f6] hover:bg-[#3b6fe2] text-white font-bold uppercase tracking-wider text-xs px-6 py-3.5 rounded transition-colors duration-200 shadow-sm"
        >
          Go To Homepage
        </button>
      </div>
    </div>
  );
};

export default NotFound;
