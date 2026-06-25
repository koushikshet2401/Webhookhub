// frontend/src/components/Input.jsx

export default function Input({ label, error, hint, className = '', id, ...props }) {
  const inputId = id || props.name;
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-text-muted">
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={`bg-bg-elevated border rounded-lg px-3 py-2 text-text placeholder:text-text-faint focus:border-accent transition-colors ${
          error ? 'border-danger' : 'border-border'
        } ${className}`}
        {...props}
      />
      {hint && !error && <p className="text-xs text-text-faint">{hint}</p>}
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}