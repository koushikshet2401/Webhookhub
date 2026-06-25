// frontend/src/components/DeliveryDetailModal.jsx

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { deliveriesApi } from '../services/deliveries.api';
import Modal from './Modal';
import Button from './Button';
import StatusBadge from './StatusBadge';
import Mono from './Mono';
import Spinner from './Spinner';
import RoleGate from './RoleGate';

export default function DeliveryDetailModal({ open, onClose, deliveryId, onReplayed }) {
  const [delivery, setDelivery] = useState(null);
  const [replaying, setReplaying] = useState(false);

  useEffect(() => {
    if (!open || !deliveryId) {
      setDelivery(null);
      return;
    }
    deliveriesApi
      .get(deliveryId)
      .then(setDelivery)
      .catch(() => toast.error('Could not load delivery'));
  }, [open, deliveryId]);

  async function handleReplay() {
    setReplaying(true);
    try {
      await deliveriesApi.replay(deliveryId);
      toast.success('Delivery queued for replay');
      onReplayed?.();
      onClose();
    } catch {
      toast.error('Could not replay delivery');
    } finally {
      setReplaying(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Delivery" width="max-w-xl">
      {!delivery && (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      )}

      {delivery && (
        <div className="flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-text-muted">{delivery.event?.eventType}</p>
              <Mono className="mt-1">{delivery.endpoint?.url}</Mono>
            </div>
            <StatusBadge status={delivery.status} />
          </div>

          {delivery.status === 'DEAD_LETTERED' && (
            <RoleGate allow={['ADMIN', 'DEVELOPER']}>
              <Button size="sm" onClick={handleReplay} loading={replaying} className="self-start">
                Replay this delivery
              </Button>
            </RoleGate>
          )}

          <div>
            <p className="text-xs font-medium text-text-muted uppercase tracking-wide mb-2">Payload</p>
            <pre className="bg-mono-bg border border-border-subtle rounded-lg p-3 text-xs text-text-muted overflow-x-auto font-mono">
              {JSON.stringify(JSON.parse(delivery.event?.payload || '{}'), null, 2)}
            </pre>
          </div>

          <div>
            <p className="text-xs font-medium text-text-muted uppercase tracking-wide mb-2">
              Attempt history ({delivery.attemptLogs?.length || 0})
            </p>
            {delivery.attemptLogs?.length === 0 && <p className="text-sm text-text-faint">No attempts yet.</p>}
            <div className="flex flex-col gap-2">
              {delivery.attemptLogs?.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between bg-bg-elevated-2 rounded-lg px-3 py-2 text-xs"
                >
                  <span className="font-mono text-text-muted">#{log.attemptNumber}</span>
                  <span className={log.responseStatusCode && log.responseStatusCode < 300 ? 'text-success' : 'text-danger'}>
                    {log.responseStatusCode || log.errorMessage || 'No response'}
                  </span>
                  <span className="text-text-faint">{log.durationMs}ms</span>
                  <span className="text-text-faint">{new Date(log.attemptedAt).toLocaleTimeString()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}