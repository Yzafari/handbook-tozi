
import test from 'node:test';
import assert from 'node:assert/strict';

import prisma from '../src/config/database.js';

import {
  editConversationMessage,
  deleteConversationMessage,
} from '../src/modules/projects/projects.service.js';

function createTransactionMock({
  message,
  updatedMessage,
  updateCount = 1,
}) {
  let findFirstCallCount = 0;

  const updateCalls = [];

  const tx = {
    project: {
      findFirst: async () => ({
        id: 'project-1',
        conversation: {
          id: 'conversation-1',
          members: [{ id: 'membership-1' }],
        },
      }),
    },

    conversationMessage: {
      findFirst: async () => {
        findFirstCallCount += 1;

        return findFirstCallCount === 1
          ? message
          : updatedMessage;
      },

      updateMany: async (args) => {
        updateCalls.push(args);

        return { count: updateCount };
      },
    },
  };

  return { tx, updateCalls };
}

function mockTransaction(t, tx) {
  t.mock.method(
    prisma,
    '$transaction',
    async (callback) => callback(tx)
  );
}

const baseMessage = {
  id: 'message-1',
  senderId: 'user-1',
  deletedAt: null,
};

const updatedMessage = {
  id: 'message-1',
  conversationId: 'conversation-1',
  content: 'متن ویرایش‌شده',
  createdAt: new Date(),
  editedAt: new Date(),
  deletedAt: null,
  sender: {
    id: 'user-1',
    name: 'کاربر آزمایشی',
    avatarUrl: null,
    jobRole: null,
  },
};

test('author can edit their own message', async (t) => {
  const { tx, updateCalls } = createTransactionMock({
    message: baseMessage,
    updatedMessage,
  });

  mockTransaction(t, tx);

  const result = await editConversationMessage({
    projectId: 'project-1',
    userId: 'user-1',
    messageId: 'message-1',
    content: 'متن ویرایش‌شده',
  });

  assert.equal(result.content, 'متن ویرایش‌شده');
  assert.equal(updateCalls.length, 1);

  assert.equal(
    updateCalls[0].where.deletedAt,
    null
  );

  assert.ok(
    updateCalls[0].data.editedAt instanceof Date
  );
});

test('another user cannot edit a message', async (t) => {
  const { tx, updateCalls } = createTransactionMock({
    message: {
      ...baseMessage,
      senderId: 'user-2',
    },
    updatedMessage,
  });

  mockTransaction(t, tx);

  await assert.rejects(
    editConversationMessage({
      projectId: 'project-1',
      userId: 'user-1',
      messageId: 'message-1',
      content: 'تغییر غیرمجاز',
    }),
    /فقط نویسنده پیام/
  );

  assert.equal(updateCalls.length, 0);
});

test('deleted messages cannot be edited', async (t) => {
  const { tx, updateCalls } = createTransactionMock({
    message: {
      ...baseMessage,
      deletedAt: new Date(),
    },
    updatedMessage,
  });

  mockTransaction(t, tx);

  await assert.rejects(
    editConversationMessage({
      projectId: 'project-1',
      userId: 'user-1',
      messageId: 'message-1',
      content: 'تغییر پیام حذف‌شده',
    }),
    /قبلاً حذف شده/
  );

  assert.equal(updateCalls.length, 0);
});

test('author can soft-delete their own message', async (t) => {
  const deletedMessage = {
    ...updatedMessage,
    content: 'متن اولیه',
    deletedAt: new Date(),
  };

  const { tx, updateCalls } = createTransactionMock({
    message: baseMessage,
    updatedMessage: deletedMessage,
  });

  mockTransaction(t, tx);

  const result = await deleteConversationMessage({
    projectId: 'project-1',
    userId: 'user-1',
    messageId: 'message-1',
  });

  assert.equal(result.content, null);
  assert.equal(result.isDeleted, true);

  assert.equal(updateCalls.length, 1);

  assert.equal(
    updateCalls[0].where.deletedAt,
    null
  );

  assert.ok(
    updateCalls[0].data.deletedAt instanceof Date
  );
});

test('another user cannot delete a message', async (t) => {
  const { tx, updateCalls } = createTransactionMock({
    message: {
      ...baseMessage,
      senderId: 'user-2',
    },
    updatedMessage,
  });

  mockTransaction(t, tx);

  await assert.rejects(
    deleteConversationMessage({
      projectId: 'project-1',
      userId: 'user-1',
      messageId: 'message-1',
    }),
    /فقط نویسنده پیام/
  );

  assert.equal(updateCalls.length, 0);
});

test('deleted messages cannot be deleted again', async (t) => {
  const { tx, updateCalls } = createTransactionMock({
    message: {
      ...baseMessage,
      deletedAt: new Date(),
    },
    updatedMessage,
  });

  mockTransaction(t, tx);

  await assert.rejects(
    deleteConversationMessage({
      projectId: 'project-1',
      userId: 'user-1',
      messageId: 'message-1',
    }),
    /قبلاً حذف شده/
  );

  assert.equal(updateCalls.length, 0);
});

test('edit conflict is rejected when update affects no row', async (t) => {
  const { tx } = createTransactionMock({
    message: baseMessage,
    updatedMessage,
    updateCount: 0,
  });

  mockTransaction(t, tx);

  await assert.rejects(
    editConversationMessage({
      projectId: 'project-1',
      userId: 'user-1',
      messageId: 'message-1',
      content: 'ویرایش هم‌زمان',
    }),
    /هم‌زمان تغییر کرده/
  );
});

test('delete conflict is rejected when update affects no row', async (t) => {
  const { tx } = createTransactionMock({
    message: baseMessage,
    updatedMessage,
    updateCount: 0,
  });

  mockTransaction(t, tx);

  await assert.rejects(
    deleteConversationMessage({
      projectId: 'project-1',
      userId: 'user-1',
      messageId: 'message-1',
    }),
    /هم‌زمان تغییر کرده/
  );
});
