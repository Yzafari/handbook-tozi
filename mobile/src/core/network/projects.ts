
import { api } from './api';

export type ProjectStatus =
  | 'PLANNING'
  | 'ACTIVE'
  | 'ON_HOLD'
  | 'COMPLETED'
  | 'ARCHIVED';

export type Project = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  type: string;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
};

export type CreateProjectInput = {
  name: string;
  description?: string | null;
  type: string;
};

function readProject(data: any): Project {
  if (
    !data ||
    typeof data.id !== 'string' ||
    typeof data.name !== 'string'
  ) {
    throw new Error('ساختار اطلاعات پروژه دریافتی از سرور معتبر نیست');
  }

  return data as Project;
}

export async function getProjects(): Promise<Project[]> {
  const response = await api.get('/projects');
  const data = response.data?.data;

  if (!Array.isArray(data)) {
    throw new Error('فهرست پروژه‌های دریافتی از سرور معتبر نیست');
  }

  return data.map(readProject);
}

export async function createProject(
  input: CreateProjectInput
): Promise<Project> {
  const response = await api.post('/projects', input);
  const data = response.data?.data;

  return readProject(data);
}

export type ProjectMember = {
  id: string;
  userId: string;
  status: string;
  joinedAt: string;
  user: {
    id: string;
    name: string | null;
    avatarUrl: string | null;
    jobRole: string | null;
  };
  projectRole: {
    id: string;
    key: string;
    name: string;
  };
};

export type ProjectRole = {
  id: string;
  key: string;
  name: string;
  isSystem: boolean;
  permissions: string[];
};

export type ProjectDetail = Project & {
  createdBy: {
    id: string;
    name: string | null;
  };
  members: ProjectMember[];
  workspace: {
    id: string;
    createdAt: string;
  } | null;
  conversation: {
    id: string;
    title: string;
    createdAt: string;
  } | null;
  roles: ProjectRole[];
};

export async function getProjectDetail(
  projectId: string
): Promise<ProjectDetail> {
  const response = await api.get(
    `/projects/${encodeURIComponent(projectId)}`
  );

  const data = response.data?.data;

  if (
    !data ||
    typeof data.id !== 'string' ||
    !Array.isArray(data.members) ||
    !Array.isArray(data.roles)
  ) {
    throw new Error('ساختار جزئیات پروژه دریافتی از سرور معتبر نیست');
  }

  return data as ProjectDetail;
}

