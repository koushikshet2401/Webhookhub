// frontend/src/components/EndpointDetailModal.jsx

import { useState } from 'react';
import toast from 'react-hot-toast';
import { endpointsApi } from '../services/endpoints.api';
import Modal from './Modal';
import Input from './Input';
import Button from './Button';
import SecretReveal from './SecretReveal';
import RoleGate from './RoleGate';
import TestEventPanel from './TestEventPanel';

export default function EndpointDetailModal({ open, onClose, endpoint, onUpdated, onDeleted }) {
  const [url, setUrl] = useState(endpoint?.url || '');
  const [eventTypes, setEventTypes] = useState(endpoint?.eventTypes?.join(', ') || '*');
  const [isActive, setIsActive] = useState(endpoint?.isActive ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [pinging, setPinging] = useState(false);
  const [pingResult, setPingResult] = useState(null);
  const [regenerated, setRegenerated] = useState(null);
  const [busy, setBusy] = useState('');
  const [showTestPanel, setShowTestPanel] = useState(false);

  if (!endpoint) return null;

  async function handleSave(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const types = eventTypes.split(',').map((t) => t.trim()).filter(Boolean);
      const updated = await endpointsApi.update(endpoint.id, { url, eventTypes: types.length ? types : ['*'], isActive });
      onUpdated(updated);
      toast.success('Endpoint updated');
    } catch (err) {
      const details = err.response?.data?.details;
      setError(details?.[0]?.message || err.response?.data?.error || 'Could not save changes');
    } finally {
      setSaving(false);
    }
  }

  async function handlePing() {
    setPinging(true);
    setPingResult(null);
    try {
      const result = await endpointsApi.ping(endpoint.id);
      setPingResult(result);
    } catch {
      setPingResult({ reachable: false, error: 'Ping request failed' });
    } finally {
      setPinging(false);
    }
  }

  async function handleRegenerate() {
    if (!window.confirm('The current secret will stop working immediately. Continue?')) return;
    setBusy('regenerate');
    try {
      const result = await endpointsApi.regenerateSecret(endpoint.id);
      setRegenerated(result);
    } catch {
      toast.error('Could not regenerate secret');
    } finally {
      setBusy('');
    }
  }

  async function handleReplayFailed() {
    setBusy('replay');
    try {
      const result = await endpointsApi.replayFailed(endpoint.id);
      toast.success(`Replaying ${result.replayedCount} dead-lettered deliveries`);
    } catch {
      toast.error('Could not replay deliveries');
    } finally {
      setBusy('');
    }
  }

  async function handleDelete() {
    if (!window.confirm(`Delete this endpoint? This cannot be undone.`)) return;
    setBusy('delete');
    try {
      await endpointsApi.remove(endpoint.id);
      onDeleted(endpoint.id);
      onClose();
    } catch {
      toast.error('Could not delete endpoint');
      setBusy('');
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Endpoint" width="max-w-lg">
      <div className="flex flex-col gap-6">
        {regenerated && <SecretReveal secret={regenerated.secret} warning={regenerated.warning} />}

        <form onSubmit={handleSave} className="flex flex-col gap-4">
          <Input label="Endpoint URL" required value={url} onChange={(e) => setUrl(e.target.value)} />
          <Input
            label="Event types"
            value={eventTypes}
            onChange={(e) => setEventTypes(e.target.value)}
            hint='Comma-separated, or "*" for every event type.'
          />
          <label className="flex items-center gap-2 text-sm text-text-muted">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="accent-accent" />
            Active (receives new deliveries)
          </label>
          {error && <p className="text-sm text-danger">{error}</p>}
          <RoleGate allow={['ADMIN', 'DEVELOPER']}>
            <Button type="submit" loading={saving} size="sm" className="self-start">
              Save changes
            </Button>
          </RoleGate>
        </form>

        <div className="border-t border-border pt-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-text-muted">Test connectivity</span>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={() => setShowTestPanel(p => !p)}>
                {showTestPanel ? 'Hide test event' : 'Send test event'}
              </Button>
              <Button variant="secondary" size="sm" onClick={handlePing} loading={pinging}>
                Send test ping
              </Button>
            </div>
          </div>
          {pingResult && (
            <div className="text-xs">
              {pingResult.reachable ? (
                <p className="text-success">
                  Reachable - {pingResult.statusCode} in {pingResult.latencyMs}ms
                </p>
              ) : (
                <p className="text-danger">
                  Not reachable{pingResult.statusCode ? ` - ${pingResult.statusCode}` : ''}
                  {pingResult.error ? `: ${pingResult.error}` : ''}
                </p>
              )}
            </div>
          )}

          <RoleGate allow={['ADMIN', 'DEVELOPER']}>
            <div className="flex items-center justify-between">
              <span className="text-sm text-text-muted">Signing secret leaked or rotated?</span>
              <Button variant="secondary" size="sm" onClick={handleRegenerate} loading={busy === 'regenerate'}>
                Regenerate secret
              </Button>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-text-muted">Replay every dead-lettered delivery</span>
              <Button variant="secondary" size="sm" onClick={handleReplayFailed} loading={busy === 'replay'}>
                Replay failed
              </Button>
            </div>
          </RoleGate>
        </div>

        {showTestPanel && <TestEventPanel endpoint={endpoint} />}

        <RoleGate allow={['ADMIN', 'DEVELOPER']}>
          <div className="border-t border-border pt-4">
            <Button variant="danger" size="sm" onClick={handleDelete} loading={busy === 'delete'}>
              Delete endpoint
            </Button>
          </div>
        </RoleGate>
      </div>
    </Modal>
  );
}