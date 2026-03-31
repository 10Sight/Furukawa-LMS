import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { profile } from '@/Redux/Slice/AuthSlice';

const AuthProvider = ({ children }) => {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);

  useEffect(() => {
    const initializeAuth = async () => {
      // Check if user should be logged in based on localStorage
      const isLoggedInFromStorage = localStorage.getItem('isLoggedIn') === 'true';
      
      // If localStorage indicates user should be logged in but we don't have user data
      if (isLoggedInFromStorage && !user) {
        try {
          await dispatch(profile()).unwrap();
        } catch (error) {
          // Clear localStorage if authentication fails
          localStorage.setItem('isLoggedIn', 'false');
        }
      }
    };

    initializeAuth();
  }, [dispatch, user]);

  return children;
};

export default AuthProvider;
