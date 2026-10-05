import { authSession } from "@/utils/authSession.js";
import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { profile } from "@/context/state/slices/AuthSlice.js";

const AuthProvider = ({ children }) => {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);

  useEffect(() => {
    const initializeAuth = async () => {
      // Check if user should be logged in based on the active portal session
      const isLoggedInFromSession = authSession.getItem('isLoggedIn') === 'true';
      
      // If the active portal session indicates user should be logged in but we don't have user data
      if (isLoggedInFromSession && !user) {
        try {
          await dispatch(profile()).unwrap();
        } catch (error) {
          // Clear the active portal session if authentication fails
          authSession.setItem('isLoggedIn', 'false');
        }
      }
    };

    initializeAuth();
  }, [dispatch, user]);

  return children;
};

export default AuthProvider;
