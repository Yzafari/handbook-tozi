
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
