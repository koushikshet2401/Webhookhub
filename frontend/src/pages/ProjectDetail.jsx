// frontend/src/pages/ProjectDetail.jsx

import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { projectsApi } from '../services/projects.api';
import Tabs from '../components/Tabs';
import Spinner from '../components/Spinner';
import EndpointsTab from './project/EndpointsTab';
import ApiKeysTab from './project/ApiKeysTab';
import DeliveriesTab from './project/DeliveriesTab';

const TABS = [
  { value: 'endpoints', label: 'Endpoints' },
  { value: 'api-keys', label: 'API keys' },
  { value: 'deliveries', label: 'Deliveries' },
];

export default function ProjectDetail() {
  const { projectId } = useParams();
  const [project, setProject] = useState(null);
  const [tab, setTab] = useState('endpoints');

  useEffect(() => {
    projectsApi
      .get(projectId)
      .then(setProject)
      .catch(() => toast.error('Could not load project'));
  }, [projectId]);

  if (!project) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }

  return (
    <div>
      <Link to="/projects" className="text-xs text-text-faint hover:text-accent transition-colors">
        ← All projects
      </Link>
      <h1 className="font-display text-2xl font-semibold text-text mt-2 mb-6">{project.name}</h1>

      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      {tab === 'endpoints' && <EndpointsTab projectId={projectId} />}
      {tab === 'api-keys' && <ApiKeysTab projectId={projectId} />}
      {tab === 'deliveries' && <DeliveriesTab projectId={projectId} />}
    </div>
  );
}