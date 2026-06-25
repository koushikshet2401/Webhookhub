// frontend/src/pages/project/ApiKeysTab.jsx

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { apiKeysApi } from '../../services/apiKeys.api';
import { Table, THead, TH, TBody, TR, TD } from '../../components/Table';
import Mono from '../../components/Mono';
import Button from '../../components/Button';
import Spinner from '../../components/Spinner';
import EmptyState from '../../components/EmptyState';
import Card from '../../components/Card';
import RoleGate from '../../components/RoleGate';
import CreateApiKeyModal from '../../components/CreateApiKeyModal';

export default function ApiKeysTab({ projectId }) {
  const [keys, setKeys] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    apiKeysApi
      .list(projectId)
      .then(setKeys)
      .catch(() => toast.error('Could not load API keys'));
  }, [projectId]);

  function handleCreated(key) {
    setKeys((prev) => [
      { id: key.id, label: key.label, prefix: key.prefix, expiresAt: key.expiresAt, revokedAt: null, lastUsedAt: null, createdAt: key.createdAt },
      ...prev,
    ]);
  }

  async function handleRevoke(id) {
    if (!window.confirm('Revoke this key? Any service using it will immediately stop being able to authenticate.')) return;
    setBusyId(id);
    try {
      const updated = await apiKeysApi.revoke(id);
      setKeys((prev) => prev.map((k) => (k.id === id ? { ...k, revokedAt: updated.revokedAt } : k)));
      toast.success('Key revoked');
    } catch {
      toast.error('Could not revoke key');
    } finally {
      setBusyId(null);
    }
  }

  async function handleRegenerate(id) {
    if (!window.confirm('This replaces the key - the old one stops working immediately.')) return;
    setBusyId(id);
    try {
      const newKey = await apiKeysApi.regenerate(id);
      setKeys((prev) => [
        { id: newKey.id, label: newKey.label, prefix: newKey.prefix, expiresAt: newKey.expiresAt, revokedAt: null, lastUsedAt: null, createdAt: newKey.createdAt },
        ...prev.map((k) => (k.id === id ? { ...k, revokedAt: new Date().toISOString() } : k)),
      ]);
      toast.success(
        () => (
          <div>
            <p className="font-medium mb-1">New key created</p>
            <code className="text-xs break-all">{newKey.key}</code>
          </div>
        ),
        { duration: 15000 }
      );
    } catch {
      toast.error('Could not regenerate key');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <div className="flex justify-end mb-4">
        <RoleGate allow={['ADMIN', 'DEVELOPER']}>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            New API key
          </Button>
        </RoleGate>
      </div>

      {keys === null && (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      )}

      {keys?.length === 0 && (
        <Card>
          <EmptyState
            title="No API keys yet"
            description="Generate a key to authenticate event ingestion requests for this project."
          />
        </Card>
      )}

      {keys?.length > 0 && (
        <Table>
          <THead>
            <TH>Label</TH>
            <TH>Key</TH>
            <TH>Last used</TH>
            <TH>Status</TH>
            <TH></TH>
          </THead>
          <TBody>
            {keys.map((key) => {
              const expired = key.expiresAt && new Date(key.expiresAt) < new Date();
              const revoked = !!key.revokedAt;
              return (
                <TR key={key.id}>
                  <TD>{key.label || <span className="text-text-faint">Untitled</span>}</TD>
                  <TD>
                    <Mono>whsk_{key.prefix}...</Mono>
                  </TD>
                  <TD className="text-xs text-text-faint">
                    {key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleString() : 'Never'}
                  </TD>
                  <TD>
                    {revoked ? (
                      <span className="text-xs text-danger font-mono">Revoked</span>
                    ) : expired ? (
                      <span className="text-xs text-text-faint font-mono">Expired</span>
                    ) : (
                      <span className="text-xs text-success font-mono">Active</span>
                    )}
                  </TD>
                  <TD>
                    <RoleGate allow={['ADMIN', 'DEVELOPER']}>
                      {!revoked && (
                        <div className="flex gap-2 justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRegenerate(key.id)}
                            loading={busyId === key.id}
                          >
                            Regenerate
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRevoke(key.id)}
                            loading={busyId === key.id}
                            className="text-danger"
                          >
                            Revoke
                          </Button>
                        </div>
                      )}
                    </RoleGate>
                  </TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      )}

      <CreateApiKeyModal open={createOpen} onClose={() => setCreateOpen(false)} projectId={projectId} onCreated={handleCreated} />
    </div>
  );
}