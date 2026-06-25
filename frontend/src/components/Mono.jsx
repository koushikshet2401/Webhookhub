// frontend/src/components/Mono.jsx

// Used for anything technical - IDs, key prefixes, URLs, signatures.
// Consistent monospace treatment is part of the design identity, not
// just a code-block afterthought: this is infrastructure, and looking
// like it was built by people who write infrastructure is the point.
export default function Mono({ children, className = '' }) {
  return (
    <code
      className={`font-mono text-xs bg-mono-bg border border-border-subtle rounded px-1.5 py-0.5 text-text-muted ${className}`}
    >
      {children}
    </code>
  );
}