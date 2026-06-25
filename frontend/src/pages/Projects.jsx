// frontend/src/pages/Projects.jsx

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { projectsApi } from '../services/projects.api';
import Button from '../components/Button';
import Input from '../components/Input';
import Modal from '../components/Modal';
import Card from '../components/Card';
import Spinner from '../components/Spinner';
import EmptyState from '../components/EmptyState';
import RoleGate from '../components/RoleGate';

export default function Projects() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    projectsApi
      .list()
      .then(setProjects)
      .catch(() => toast.error('Could not load projects'));
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    setError('');
    setCreating(true);
    try {
      const project = await projectsApi.create({ name });
      setProjects((prev) => [project, ...prev]);
      setModalOpen(false);
      setName('');
      toast.success('Project created');
    } catch (err) {
      setError(err.response?.data?.error || 'Could not create project');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-semibold text-text">Projects</h1>
          <p className="text-sm text-text-muted mt-1">Each project has its own endpoints, API keys, and delivery history.</p>
        </div>
        <RoleGate allow={['ADMIN']}>
          <Button onClick={() => setModalOpen(true)}>New project</Button>
        </RoleGate>
      </div>

      {projects === null && (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      )}

      {projects?.length === 0 && (
        <Card>
          <EmptyState
            title="No projects yet"
            description="Create a project to start registering endpoints and sending events."
            action={
              <RoleGate allow={['ADMIN']}>
                <Button onClick={() => setModalOpen(true)}>New project</Button>
              </RoleGate>
            }
          />
        </Card>
      )}

      {projects?.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => (
            <Card
              key={project.id}
              className="p-5 cursor-pointer hover:border-accent transition-colors"
              onClick={() => navigate(`/projects/${project.id}`)}
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-display font-semibold text-text truncate">{project.name}</h3>
                <span
                  className={`h-2 w-2 rounded-full flex-shrink-0 ${project.isActive ? 'bg-success' : 'bg-text-faint'}`}
                  title={project.isActive ? 'Active' : 'Inactive'}
                />
              </div>
              <p className="text-xs text-text-faint font-mono">
                Created {new Date(project.createdAt).toLocaleDateString()}
              </p>
            </Card>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New project">
        <form onSubmit={handleCreate} className="flex flex-col gap-4">
          <Input
            label="Project name"
            autoFocus
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Production"
          />
          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex justify-end gap-2 mt-1">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={creating}>
              Create project
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}