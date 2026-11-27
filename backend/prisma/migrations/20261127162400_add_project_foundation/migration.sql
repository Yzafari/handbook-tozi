CREATE TYPE "ProjectStatus" AS ENUM (
  'PLANNING',
  'ACTIVE',
  'ON_HOLD',
  'COMPLETED',
  'ARCHIVED'
);

CREATE TYPE "ProjectMemberStatus" AS ENUM (
  'ACTIVE',
  'SUSPENDED',
  'REMOVED'
);

CREATE TABLE "Project" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "type" TEXT NOT NULL,
  "status" "ProjectStatus" NOT NULL DEFAULT 'PLANNING',
  "startDate" TIMESTAMP(3),
  "expectedEndDate" TIMESTAMP(3),
  "organizationName" TEXT,
  "employerName" TEXT,
  "contractorName" TEXT,
  "createdById" TEXT NOT NULL,
  "projectManagerUserId" TEXT,
  "employerUserId" TEXT,
  "supervisorUserId" TEXT,
  "contractorUserId" TEXT,
  "technicalLeadUserId" TEXT,
  "province" TEXT,
  "county" TEXT,
  "address" TEXT,
  "latitude" DOUBLE PRECISION,
  "longitude" DOUBLE PRECISION,
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProjectRole" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "isSystem" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ProjectRole_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProjectMember" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "roleId" TEXT NOT NULL,
  "status" "ProjectMemberStatus" NOT NULL DEFAULT 'ACTIVE',
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ProjectMember_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProjectRolePermission" (
  "id" TEXT NOT NULL,
  "projectRoleId" TEXT NOT NULL,
  "permission" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ProjectRolePermission_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProjectWorkspace" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ProjectWorkspace_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Conversation" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Project_code_key"
ON "Project"("code");

CREATE INDEX "Project_createdById_status_createdAt_idx"
ON "Project"("createdById", "status", "createdAt");

CREATE INDEX "Project_projectManagerUserId_status_idx"
ON "Project"("projectManagerUserId", "status");

CREATE INDEX "Project_status_updatedAt_idx"
ON "Project"("status", "updatedAt");

CREATE INDEX "Project_province_county_idx"
ON "Project"("province", "county");

CREATE UNIQUE INDEX "ProjectRole_projectId_key_key"
ON "ProjectRole"("projectId", "key");

CREATE INDEX "ProjectRole_projectId_isSystem_idx"
ON "ProjectRole"("projectId", "isSystem");

CREATE UNIQUE INDEX "ProjectMember_projectId_userId_key"
ON "ProjectMember"("projectId", "userId");

CREATE INDEX "ProjectMember_userId_status_idx"
ON "ProjectMember"("userId", "status");

CREATE INDEX "ProjectMember_projectId_status_idx"
ON "ProjectMember"("projectId", "status");

CREATE INDEX "ProjectMember_roleId_idx"
ON "ProjectMember"("roleId");

CREATE UNIQUE INDEX "ProjectRolePermission_projectRoleId_permission_key"
ON "ProjectRolePermission"("projectRoleId", "permission");

CREATE INDEX "ProjectRolePermission_permission_idx"
ON "ProjectRolePermission"("permission");

CREATE UNIQUE INDEX "ProjectWorkspace_projectId_key"
ON "ProjectWorkspace"("projectId");

CREATE UNIQUE INDEX "Conversation_projectId_key"
ON "Conversation"("projectId");

ALTER TABLE "Project"
ADD CONSTRAINT "Project_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Project"
ADD CONSTRAINT "Project_projectManagerUserId_fkey"
FOREIGN KEY ("projectManagerUserId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Project"
ADD CONSTRAINT "Project_employerUserId_fkey"
FOREIGN KEY ("employerUserId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Project"
ADD CONSTRAINT "Project_supervisorUserId_fkey"
FOREIGN KEY ("supervisorUserId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Project"
ADD CONSTRAINT "Project_contractorUserId_fkey"
FOREIGN KEY ("contractorUserId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Project"
ADD CONSTRAINT "Project_technicalLeadUserId_fkey"
FOREIGN KEY ("technicalLeadUserId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ProjectRole"
ADD CONSTRAINT "ProjectRole_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "Project"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProjectMember"
ADD CONSTRAINT "ProjectMember_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "Project"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProjectMember"
ADD CONSTRAINT "ProjectMember_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProjectMember"
ADD CONSTRAINT "ProjectMember_roleId_fkey"
FOREIGN KEY ("roleId") REFERENCES "ProjectRole"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProjectRolePermission"
ADD CONSTRAINT "ProjectRolePermission_projectRoleId_fkey"
FOREIGN KEY ("projectRoleId") REFERENCES "ProjectRole"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProjectWorkspace"
ADD CONSTRAINT "ProjectWorkspace_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "Project"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Conversation"
ADD CONSTRAINT "Conversation_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "Project"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
