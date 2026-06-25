// frontend/src/pages/project/EndpointsTab.jsx

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { endpointsApi } from '../../services/endpoints.api';
import { Table, THead, TH, TBody, TR, TD } from '../../components/Table';
import StatusBadge from '../../components/StatusBadge';
import Mono from '../../components/Mono';
import Button from '../../components/Button';
import Spinner from '../../components/Spinner';
import EmptyState from '../../components/EmptyState';
import Card from '../../components/Card';
import RoleGate from '../../components/RoleGate';
import CreateEndpointModal from '../../components/CreateEndpointModal';
import EndpointDetailModal from '../../components/EndpointDetailModal';

export default function EndpointsTab({ projectId }) {
  const [endpoints, setEndpoints] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    endpointsApi
      .list(projectId)
      .then(setEndpoints)
      .catch(() => toast.error('Could not load endpoints'));
  }, [projectId]);

  function handleCreated(endpoint) {
    setEndpoints((prev) => [endpoint, ...prev]);
  }

  function handleUpdated(updated) {
    setEndpoints((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
    setSelected(updated);
  }

  function handleDeleted(id) {
    setEndpoints((prev) => prev.filter((e) => e.id !== id));
  }

  return (
    <div>
      <div className="flex justify-end mb-4">
        <RoleGate allow={['ADMIN', 'DEVELOPER']}>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            New endpoint
          </Button>
        </RoleGate>
      </div>

      {endpoints === null && (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      )}

      {endpoints?.length === 0 && (
        <Card>
          <EmptyState
            title="No endpoints yet"
            description="Register a URL to start receiving events sent to this project."
          />
        </Card>
      )}

      {endpoints?.length > 0 && (
        <Table>
          <THead>
            <TH>URL</TH>
            <TH>Event types</TH>
            <TH>Status</TH>
            <TH>Created</TH>
          </THead>
          <TBody>
            {endpoints.map((endpoint) => (
              <TR key={endpoint.id} onClick={() => setSelected(endpoint)}>
                <TD className="max-w-xs truncate font-mono text-xs">{endpoint.url}</TD>
                <TD>
                  <Mono>{endpoint.eventTypes.join(', ')}</Mono>
                </TD>
                <TD>
                  <StatusBadge status={endpoint.isActive ? 'ACTIVE' : 'INACTIVE'} />
                </TD>
                <TD className="text-text-faint text-xs">{new Date(endpoint.createdAt).toLocaleDateString()}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      <CreateEndpointModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        projectId={projectId}
        onCreated={handleCreated}
      />

      <EndpointDetailModal
        open={!!selected}
        onClose={() => setSelected(null)}
        endpoint={selected}
        onUpdated={handleUpdated}
        onDeleted={handleDeleted}
      />
    </div>
  );
}