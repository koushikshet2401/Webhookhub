// frontend/src/components/ProtectedRoute.jsx

import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getAccessToken } from '../services/api';

export default function ProtectedRoute({ children }) {
  const { loading } = useAuth();
  const location = useLocation();

  if (loading) return null;

  if (!getAccessToken()) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}