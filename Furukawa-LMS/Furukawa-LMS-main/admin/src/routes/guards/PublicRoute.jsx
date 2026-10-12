import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';

const PublicRoute = ({ children }) => {
  const location = useLocation();
  const { isLoggedIn, user } = useSelector((state) => state.auth);

  // Logins start at the Digital Gateway unless the user was sent here from a deep link.
  if (isLoggedIn && user) {
    const from = location.state?.from;
    const target = from ? `${from.pathname || ''}${from.search || ''}${from.hash || ''}` : '';
    const isSafe = target.startsWith('/') && !target.startsWith('//') && !target.startsWith('/login');
    return <Navigate to={isSafe ? target : '/'} replace />;
  }

  // If not authenticated, render the public component (login page)
  return children;
};

export default PublicRoute;
