// frontend/src/components/EmptyState.jsx

export default function EmptyState({ title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6">
      <h3 className="font-display text-lg font-semibold text-text mb-1">{title}</h3>
      {description && <p className="text-sm text-text-muted max-w-sm mb-4">{description}</p>}
      {action}
    </div>
  );
}