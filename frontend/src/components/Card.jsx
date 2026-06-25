// frontend/src/components/Card.jsx

export default function Card({ className = '', children, ...props }) {
  return (
    <div
      className={`bg-bg-elevated border border-border rounded-xl ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}