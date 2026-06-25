// frontend/src/components/CreateEndpointModal.jsx

import { useState } from 'react';
import { endpointsApi } from '../services/endpoints.api';
import Modal from './Modal';
import Input from './Input';
import Button from './Button';
import SecretReveal from './SecretReveal';

export default function CreateEndpointModal({ open, onClose, projectId, onCreated }) {
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [eventTypes, setEventTypes] = useState('*');
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState(null);

  function reset() {
    setUrl('');
    setDescription('');
    setEventTypes('*');
    setError('');
    setCreated(null);
  }

  function handleClose() {
    if (created) onCreated(created);
    reset();
    onClose();
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setCreating(true);
    try {
      const types = eventTypes
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      const endpoint = await endpointsApi.create(projectId, {
        url,
        description: description || undefined,
        eventTypes: types.length ? types : ['*'],
      });
      setCreated(endpoint);
    } catch (err) {
      const details = err.response?.data?.details;
      setError(details?.[0]?.message || err.response?.data?.error || 'Could not create endpoint');
    } finally {
      setCreating(false);
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title={created ? 'Endpoint created' : 'New endpoint'}>
      {created ? (
        <div className="flex flex-col gap-4">
          <SecretReveal secret={created.secret} warning={created.warning} />
          <Button onClick={handleClose}>Done</Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label="Endpoint URL"
            autoFocus
            required
            type="url"
            placeholder="https://example.com/webhooks/incoming"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            hint="Must be a public URL - private/internal addresses are rejected."
          />
          <Input
            label="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Production order pipeline"
          />
          <Input
            label="Event types"
            value={eventTypes}
            onChange={(e) => setEventTypes(e.target.value)}
            hint='Comma-separated, or "*" for every event type.'
          />
          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex justify-end gap-2 mt-1">
            <Button type="button" variant="secondary" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" loading={creating}>
              Create endpoint
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}