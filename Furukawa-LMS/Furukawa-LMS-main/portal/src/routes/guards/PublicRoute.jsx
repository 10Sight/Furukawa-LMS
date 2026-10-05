import React from 'react';
import { Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';

const PublicRoute = ({ children }) => {
  const { isLoggedIn, user } = useSelector((state) => state.auth);

  // Every successful login starts at the Digital Gateway.
  if (isLoggedIn && user) {
    return <Navigate to="/" replace />;
  }

  // If not authenticated, render the public component (login page)
  return children;
};

export default PublicRoute;
