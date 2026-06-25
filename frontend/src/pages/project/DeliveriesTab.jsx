// frontend/src/pages/project/DeliveriesTab.jsx

import { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { deliveriesApi } from '../../services/deliveries.api';
import { socket, joinProjectRoom } from '../../services/socket';
import { Table, THead, TH, TBody, TR, TD } from '../../components/Table';
import StatusBadge from '../../components/StatusBadge';
import Spinner from '../../components/Spinner';
import EmptyState from '../../components/EmptyState';
import Card from '../../components/Card';
import Pagination from '../../components/Pagination';
import DeliveryDetailModal from '../../components/DeliveryDetailModal';

const STATUS_OPTIONS = ['', 'PENDING', 'DELIVERING', 'SUCCESS', 'DEAD_LETTERED'];

export default function DeliveriesTab({ projectId }) {
  const [data, setData] = useState(null);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [selectedId, setSelectedId] = useState(null);

  const load = useCallback(() => {
    deliveriesApi
      .list(projectId, { page, limit: 25, ...(status ? { status } : {}) })
      .then(setData)
      .catch(() => toast.error('Could not load deliveries'));
  }, [projectId, page, status]);

  useEffect(() => {
    load();
  }, [load]);

  // Live updates: join this project's room and patch matching rows in place
  // as the worker actually processes them, rather than polling.
  useEffect(() => {
    joinProjectRoom(projectId);

    function handleUpdate(payload) {
      setData((prev) => {
        if (!prev) return prev;
        const exists = prev.data.some((d) => d.id === payload.deliveryId);
        if (!exists) return prev; // belongs to a delivery not on the current page
        return {
          ...prev,
          data: prev.data.map((d) => (d.id === payload.deliveryId ? { ...d, status: payload.status } : d)),
        };
      });
    }

    socket.on('delivery_update', handleUpdate);
    return () => socket.off('delivery_update', handleUpdate);
  }, [projectId]);

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className="bg-bg-elevated border border-border rounded-lg px-3 py-1.5 text-sm text-text"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>
              {opt || 'All statuses'}
            </option>
          ))}
        </select>
      </div>

      {data === null && (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      )}

      {data?.data.length === 0 && (
        <Card>
          <EmptyState
            title="No deliveries yet"
            description="Deliveries appear here once events are sent to this project's endpoints."
          />
        </Card>
      )}

      {data?.data.length > 0 && (
        <>
          <Table>
            <THead>
              <TH>Event</TH>
              <TH>Endpoint</TH>
              <TH>Status</TH>
              <TH>Attempts</TH>
              <TH>Created</TH>
            </THead>
            <TBody>
              {data.data.map((delivery) => (
                <TR key={delivery.id} onClick={() => setSelectedId(delivery.id)}>
                  <TD className="font-mono text-xs">{delivery.event?.eventType}</TD>
                  <TD className="max-w-[16rem] truncate font-mono text-xs text-text-muted">
                    {delivery.endpoint?.url}
                  </TD>
                  <TD>
                    <StatusBadge status={delivery.status} />
                  </TD>
                  <TD className="text-text-faint text-xs">{delivery.attemptCount}</TD>
                  <TD className="text-text-faint text-xs">{new Date(delivery.createdAt).toLocaleString()}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
          <Pagination page={data.pagination.page} totalPages={data.pagination.totalPages} onChange={setPage} />
        </>
      )}

      <DeliveryDetailModal
        open={!!selectedId}
        onClose={() => setSelectedId(null)}
        deliveryId={selectedId}
        onReplayed={load}
      />
    </div>
  );
}