// frontend/src/components/CreateApiKeyModal.jsx

import { useState } from 'react';
import { apiKeysApi } from '../services/apiKeys.api';
import Modal from './Modal';
import Input from './Input';
import Button from './Button';
import SecretReveal from './SecretReveal';

export default function CreateApiKeyModal({ open, onClose, projectId, onCreated }) {
  const [label, setLabel] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState(null);

  function handleClose() {
    if (created) onCreated(created);
    setLabel('');
    setExpiresAt('');
    setError('');
    setCreated(null);
    onClose();
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setCreating(true);
    try {
      const key = await apiKeysApi.create(projectId, {
        label: label || undefined,
        expiresAt: expiresAt || undefined,
      });
      setCreated(key);
    } catch (err) {
      const details = err.response?.data?.details;
      setError(details?.[0]?.message || err.response?.data?.error || 'Could not create API key');
    } finally {
      setCreating(false);
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title={created ? 'API key created' : 'New API key'}>
      {created ? (
        <div className="flex flex-col gap-4">
          <SecretReveal secret={created.key} warning={created.warning} />
          <Button onClick={handleClose}>Done</Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label="Label (optional)"
            autoFocus
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. CI pipeline"
          />
          <Input
            label="Expires (optional)"
            type="date"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
          />
          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex justify-end gap-2 mt-1">
            <Button type="button" variant="secondary" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" loading={creating}>
              Create key
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}