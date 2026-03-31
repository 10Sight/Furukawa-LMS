import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';

const PublicRoute = ({ children }) => {
  const location = useLocation();
  const { isLoggedIn, user } = useSelector((state) => state.auth);

  // Get the intended destination from location state, default to dashboard
  const from = location.state?.from?.pathname || '/';

  // If user is authenticated, redirect to the intended destination or dashboard
  if (isLoggedIn && user) {
    return <Navigate to={from} replace />;
  }

  // If not authenticated, render the public component (login page)
  return children;
};

export default PublicRoute;
