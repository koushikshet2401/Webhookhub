// frontend/src/components/StatusBadge.jsx

const STATUS_CONFIG = {
  // Delivery statuses
  PENDING: { color: 'pending', label: 'Pending', pulse: false },
  DELIVERING: { color: 'warning', label: 'Delivering', pulse: true },
  SUCCESS: { color: 'success', label: 'Success', pulse: false },
  FAILED: { color: 'danger', label: 'Failed', pulse: false },
  DEAD_LETTERED: { color: 'danger', label: 'Dead-lettered', pulse: false },
  // Endpoint state
  ACTIVE: { color: 'success', label: 'Active', pulse: false },
  INACTIVE: { color: 'pending', label: 'Inactive', pulse: false },
  // Roles
  ADMIN: { color: 'accent', label: 'Admin', pulse: false },
  DEVELOPER: { color: 'pending', label: 'Developer', pulse: false },
  VIEWER: { color: 'pending', label: 'Viewer', pulse: false },
};

const colorClasses = {
  success: 'bg-success-muted text-success',
  warning: 'bg-warning-muted text-warning',
  danger: 'bg-danger-muted text-danger',
  pending: 'bg-pending-muted text-text-muted',
  accent: 'bg-accent-muted text-accent',
};

const dotClasses = {
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  pending: 'bg-text-faint',
  accent: 'bg-accent',
};

export default function StatusBadge({ status }) {
  const config = STATUS_CONFIG[status] || { color: 'pending', label: status, pulse: false };
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium font-mono ${colorClasses[config.color]}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${dotClasses[config.color]} ${config.pulse ? 'animate-signal-pulse' : ''}`}
      />
      {config.label}
    </span>
  );
}