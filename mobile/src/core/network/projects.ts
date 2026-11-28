
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

  startDate?: string | null;
  expectedEndDate?: string | null;

  organizationName?: string | null;
  employerName?: string | null;
  contractorName?: string | null;

  createdById?: string;
  projectManagerUserId?: string | null;
  employerUserId?: string | null;
  supervisorUserId?: string | null;
  contractorUserId?: string | null;
  technicalLeadUserId?: string | null;

  province?: string | null;
  county?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;

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

export type ConversationMessage = {
  id: string;
  conversationId: string;
  content: string | null;
  createdAt: string;
  editedAt: string | null;
  deletedAt: string | null;
  isDeleted?: boolean;
  sender: {
    id: string;
    name: string | null;
    avatarUrl: string | null;
    jobRole: string | null;
  };
};

export type ConversationMessagesPage = {
  items: ConversationMessage[];
  nextCursor: string | null;
  hasMore: boolean;
};

// وضعیت عضویت کاربر در گفت‌وگوی پروژه
export type ConversationMembershipStatus = 'ACTIVE' | 'LEFT';

export type ConversationMembership = {
  projectId: string;
  conversationId: string;
  status: ConversationMembershipStatus;
  isMember: boolean;
  joinedAt: string | null;
  leftAt: string | null;
  projectMembershipPreserved: boolean;
};

export async function getConversationMessages(
  projectId: string,
  options?: {
    cursor?: string;
    limit?: number;
  }
): Promise<ConversationMessagesPage> {
  const response = await api.get(
    `/projects/${encodeURIComponent(projectId)}/conversation/messages`,
    {
      params: {
        ...(options?.cursor ? { cursor: options.cursor } : {}),
        limit: options?.limit ?? 20,
      },
    }
  );

  const data = response.data?.data;
  const meta = response.data?.meta;

  if (
    !Array.isArray(data) ||
    !meta ||
    typeof meta.hasMore !== 'boolean' ||
    !(
      typeof meta.nextCursor === 'string' ||
      meta.nextCursor === null
    )
  ) {
    throw new Error(
      'ساختار تاریخچه گفت‌وگو معتبر نیست. لطفاً دوباره تلاش کنید.'
    );
  }

  return {
    items: data as ConversationMessage[],
    nextCursor: meta.nextCursor,
    hasMore: meta.hasMore,
  };
}

export async function sendConversationMessage(
  projectId: string,
  content: string
): Promise<ConversationMessage> {
  const normalizedContent = content.trim();

  if (!normalizedContent) {
    throw new Error('متن پیام نمی‌تواند خالی باشد.');
  }

  if (normalizedContent.length > 10000) {
    throw new Error('متن پیام نباید بیشتر از ۱۰۰۰۰ کاراکتر باشد.');
  }

  const response = await api.post(
    `/projects/${encodeURIComponent(projectId)}/conversation/messages`,
    {
      content: normalizedContent,
    }
  );

  const message = response.data?.data;

  if (
    !message ||
    typeof message.id !== 'string' ||
    typeof message.conversationId !== 'string' ||
    typeof message.createdAt !== 'string' ||
    !message.sender
  ) {
    throw new Error(
      'پیام ثبت شد اما اطلاعات دریافتی معتبر نیست. تاریخچه را تازه‌سازی کنید.'
    );
  }

  return message as ConversationMessage;
}

export async function leaveProjectConversation(
  projectId: string
): Promise<void> {
  await api.post(
    `/projects/${encodeURIComponent(projectId)}/conversation/leave`
  );
}

// دریافت وضعیت واقعی عضویت کاربر در گفت‌وگوی پروژه از سرور
export async function getProjectConversationMembership(
  projectId: string
): Promise<ConversationMembership> {
  if (!projectId?.trim()) {
    throw new Error(
      'شناسه پروژه معتبر نیست. لطفاً دوباره وارد صفحه پروژه شوید.'
    );
  }

  const response = await api.get(
    `/projects/${encodeURIComponent(projectId)}/conversation/membership`
  );

  const data = response.data?.data;

  if (
    !data ||
    typeof data.projectId !== 'string' ||
    typeof data.conversationId !== 'string' ||
    !['ACTIVE', 'LEFT'].includes(data.status) ||
    typeof data.isMember !== 'boolean' ||
    !(typeof data.joinedAt === 'string' || data.joinedAt === null) ||
    !(typeof data.leftAt === 'string' || data.leftAt === null) ||
    typeof data.projectMembershipPreserved !== 'boolean'
  ) {
    throw new Error(
      'ساختار وضعیت عضویت گفت‌وگو معتبر نیست. لطفاً صفحه را تازه‌سازی کنید.'
    );
  }

  if (data.isMember !== (data.status === 'ACTIVE')) {
    throw new Error(
      'وضعیت عضویت دریافتی از سرور با اطلاعات عضویت مطابقت ندارد. لطفاً دوباره تلاش کنید.'
    );
  }

  return data as ConversationMembership;
}
