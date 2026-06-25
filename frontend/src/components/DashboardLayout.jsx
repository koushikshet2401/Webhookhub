// frontend/src/components/DashboardLayout.jsx

import { Outlet, NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import RoleGate from './RoleGate';

const navItems = [
  {
    to: '/projects',
    label: 'Projects',
    icon: (
      <path d="M4 7a2 2 0 012-2h3l2 2h7a2 2 0 012 2v7a2 2 0 01-2 2H6a2 2 0 01-2-2V7z" />
    ),
  },
];

export default function DashboardLayout() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen flex bg-bg">
      <aside className="w-60 flex-shrink-0 border-r border-border flex flex-col">
        <div className="flex items-center gap-2 px-5 py-5">
          <div className="h-2 w-2 rounded-full bg-accent animate-signal-pulse" />
          <span className="font-display font-semibold text-text">WebhookHub</span>
        </div>

        <nav className="flex-1 px-3 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? 'bg-accent-muted text-accent' : 'text-text-muted hover:bg-bg-elevated hover:text-text'
                }`
              }
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                {item.icon}
              </svg>
              {item.label}
            </NavLink>
          ))}

          <RoleGate allow={['ADMIN']}>
            <NavLink
              to="/users"
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? 'bg-accent-muted text-accent' : 'text-text-muted hover:bg-bg-elevated hover:text-text'
                }`
              }
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14c-4.4 0-8 1.8-8 5v1h16v-1c0-3.2-3.6-5-8-5z" />
              </svg>
              Team
            </NavLink>
          </RoleGate>
        </nav>

        <div className="px-3 pb-4 pt-2 border-t border-border">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="h-7 w-7 rounded-full bg-accent-muted text-accent flex items-center justify-center text-xs font-semibold font-display">
              {user?.name?.[0]?.toUpperCase() || '?'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-text truncate">{user?.name}</p>
              <p className="text-xs text-text-faint truncate font-mono">{user?.role}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full text-left px-3 py-2 text-sm text-text-muted hover:text-danger transition-colors rounded-lg hover:bg-bg-elevated"
          >
            Log out
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-8 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}