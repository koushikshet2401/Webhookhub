// frontend/src/pages/Users.jsx

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { usersApi } from '../services/users.api';
import { useAuth } from '../context/AuthContext';
import { Table, THead, TH, TBody, TR, TD } from '../components/Table';
import StatusBadge from '../components/StatusBadge';
import Spinner from '../components/Spinner';

const ROLES = ['ADMIN', 'DEVELOPER', 'VIEWER'];

export default function Users() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState(null);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    usersApi
      .list()
      .then(setUsers)
      .catch(() => toast.error('Could not load team members'));
  }, []);

  async function handleRoleChange(id, role) {
    setBusyId(id);
    try {
      await usersApi.updateRole(id, role);
      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, role } : u)));
      toast.success('Role updated');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not update role');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-text mb-1">Team</h1>
      <p className="text-sm text-text-muted mb-6">Manage who has access and what they can do.</p>

      {users === null && (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      )}

      {users && (
        <Table>
          <THead>
            <TH>Name</TH>
            <TH>Email</TH>
            <TH>Role</TH>
            <TH>Joined</TH>
          </THead>
          <TBody>
            {users.map((u) => (
              <TR key={u.id}>
                <TD>{u.name}</TD>
                <TD className="text-text-muted">{u.email}</TD>
                <TD>
                  {u.id === currentUser.id ? (
                    <StatusBadge status={u.role} />
                  ) : (
                    <select
                      value={u.role}
                      disabled={busyId === u.id}
                      onChange={(e) => handleRoleChange(u.id, e.target.value)}
                      className="bg-bg-elevated-2 border border-border rounded-md px-2 py-1 text-xs text-text font-mono"
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  )}
                </TD>
                <TD className="text-text-faint text-xs">{new Date(u.createdAt).toLocaleDateString()}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </div>
  );
}