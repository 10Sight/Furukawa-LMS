import { authSession } from "@/utils/authSession.js";
import React, { useEffect, useRef } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { profile } from "@/context/state/slices/AuthSlice.js";

const ProtectedRoute = ({ children }) => {
  const dispatch = useDispatch();
  const location = useLocation();
  const { isLoggedIn, user } = useSelector((state) => state.auth);
  const wasAuthenticated = useRef(false);
  if (isLoggedIn && user) wasAuthenticated.current = true;

  // Check if user is authenticated on component mount
  useEffect(() => {
    const checkAuthStatus = async () => {
      // Only check profile if the active portal session indicates user should be logged in
      // but Redux state doesn't have user data
      const isLoggedInFromSession = authSession.getItem('isLoggedIn') === 'true';
      
      if (isLoggedInFromSession && !user) {
        try {
          await dispatch(profile()).unwrap();
        } catch (error) {
          // If profile check fails, user will be redirected to login
        }
      }
    };

    checkAuthStatus();
  }, [dispatch, user]);

  // Show loading while checking authentication
  if (authSession.getItem('isLoggedIn') === 'true' && !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Verifying authentication...</p>
        </div>
      </div>
    );
  }

  // If not authenticated, redirect to login with the current location
  if (!isLoggedIn || !user) {
    // Only remember the destination for visitors who arrived logged out (e.g. email links), not on logout.
    const state = wasAuthenticated.current ? undefined : { from: location };
    return <Navigate to="/login" state={state} replace />;
  }

  // If authenticated, render the protected component
  return children;
};

export default ProtectedRoute;
