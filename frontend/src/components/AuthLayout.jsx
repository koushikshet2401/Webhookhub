// frontend/src/components/AuthLayout.jsx

import React from 'react';

export default function AuthLayout({ children }) {
  return (
    <div className="min-h-screen bg-[var(--color-bg)] flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center items-center gap-3 mb-6">
          <div className="w-8 h-8 rounded-md bg-[var(--color-accent)] animate-signal-pulse"></div>
          <h2 className="text-center text-3xl font-extrabold text-[var(--color-text)] tracking-tight font-display">
            WebhookHub
          </h2>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-[var(--color-bg-elevated)] py-8 px-4 shadow-xl border border-[var(--color-border)] sm:rounded-xl sm:px-10">
          {children}
        </div>
      </div>
    </div>
  );
}