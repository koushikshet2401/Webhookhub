// frontend/src/components/RoleGate.jsx

import { useAuth } from '../context/AuthContext';

// Wraps any control that mutates data (create/edit/delete buttons) so it's
// only rendered for roles actually allowed to perform that action - mirrors
// the backend's requireRole() middleware, so the UI never dangles a button
// in front of a Viewer that the API would reject anyway with a 403.
export default function RoleGate({ allow, children }) {
  const { user } = useAuth();
  if (!user || !allow.includes(user.role)) return null;
  return children;
}