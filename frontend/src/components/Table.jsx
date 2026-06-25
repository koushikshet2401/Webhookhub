// frontend/src/components/Table.jsx

export function Table({ children }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-sm">{children}</table>
    </div>
  );
}

export function THead({ children }) {
  return (
    <thead className="bg-bg-elevated-2 text-text-muted text-xs uppercase tracking-wide">
      <tr>{children}</tr>
    </thead>
  );
}

export function TH({ children, className = '' }) {
  return <th className={`text-left font-medium px-4 py-3 ${className}`}>{children}</th>;
}

export function TBody({ children }) {
  return <tbody className="divide-y divide-border bg-bg-elevated">{children}</tbody>;
}

export function TR({ children, onClick, className = '' }) {
  return (
    <tr
      onClick={onClick}
      className={`${onClick ? 'cursor-pointer hover:bg-bg-elevated-2 transition-colors' : ''} ${className}`}
    >
      {children}
    </tr>
  );
}

export function TD({ children, className = '' }) {
  return <td className={`px-4 py-3 text-text ${className}`}>{children}</td>;
}