// frontend/src/components/SecretReveal.jsx

import { useState } from 'react';
import Mono from './Mono';

export default function SecretReveal({ secret, warning }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="bg-warning-muted border border-warning/30 rounded-lg p-4">
      <p className="text-sm text-warning font-medium mb-2">{warning}</p>
      <div className="flex items-center gap-2">
        <Mono className="flex-1 truncate py-1.5">{secret}</Mono>
        <button
          onClick={handleCopy}
          className="text-xs font-medium px-3 py-1.5 rounded-md bg-bg-elevated-2 hover:bg-border text-text transition-colors flex-shrink-0"
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
    </div>
  );
}