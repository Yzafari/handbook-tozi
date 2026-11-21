import {
  createHistory,
  createHistoryItems,
  getUserHistory,
} from '../services/calculationHistory.service.js';

const REQUIRED_FIELDS = ['toolId', 'toolVersion', 'inputData', 'outputData'];

const MAX_SYNC_BATCH_SIZE = 500;
const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;
const ADMIN_ROLES = new Set(['ADMIN', 'SUPER_ADMIN']);
const MAX_CLIENT_ID_LENGTH = 120;

function isAdmin(role) {
  return ADMIN_ROLES.has(role);
}

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim() !== '';
}

/**
 * Validates a single sync item.
 *
 * @param {unknown} item
 * @returns {string|null} An error message, or null when the item is valid.
 */
function validateHistoryItem(item) {
  if (!isPlainObject(item)) {
    return 'هر آیتم باید از نوع آبجکت باشد.';
  }

  const missingFields = REQUIRED_FIELDS.filter(
    (field) => item[field] === undefined || item[field] === null || item[field] === ''
  );

  if (missingFields.length > 0) {
    return `فیلدهای الزامی ارسال نشده‌اند: ${missingFields.join(', ')}`;
  }

  if (!isNonEmptyString(item.toolId) || !isNonEmptyString(item.toolVersion)) {
    return 'toolId و toolVersion باید رشته غیرخالی باشند.';
  }

  if (!isPlainObject(item.inputData) || !isPlainObject(item.outputData)) {
    return 'inputData و outputData باید از نوع آبجکت JSON باشند.';
  }

  if (item.sources !== undefined && item.sources !== null && !isPlainObject(item.sources)) {
    return 'sources باید از نوع آبجکت JSON باشد.';
  }

  if (item.clientId !== undefined && item.clientId !== null) {
    if (!isNonEmptyString(item.clientId) || item.clientId.length > MAX_CLIENT_ID_LENGTH) {
      return `clientId باید رشته غیرخالی حداکثر ${MAX_CLIENT_ID_LENGTH} کاراکتری باشد.`;
    }
  }

  if (item.createdAt !== undefined && item.createdAt !== null) {
    if (typeof item.createdAt !== 'string' || Number.isNaN(new Date(item.createdAt).getTime())) {
      return 'createdAt باید یک تاریخ معتبر ISO باشد.';
    }
  }

  return null;
}

/**
 * POST /
 * Creates a calculation history record for the authenticated user.
 */
export async function create(req, res) {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'کاربر احراز هویت نشده است.',
      });
    }

    const body = req.body ?? {};

    const validationError = validateHistoryItem(body);

    if (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError,
      });
    }

    const history = await createHistory(userId, {
      toolId: body.toolId,
      toolVersion: body.toolVersion,
      inputData: body.inputData,
      outputData: body.outputData,
      sources: body.sources,
      clientId: body.clientId,
    });

    return res.status(201).json({
      success: true,
      data: history,
    });
  } catch (error) {
    console.error('[calculationHistory.create]', error);

    return res.status(500).json({
      success: false,
      message: 'خطا در ذخیره تاریخچه محاسبات.',
    });
  }
}

/**
 * GET /
 * Returns calculation history records for the authenticated user.
 * Admins receive records for all users.
 */
export async function getAll(req, res) {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'کاربر احراز هویت نشده است.',
      });
    }

    const rawLimit = Number.parseInt(req.query?.limit, 10);
    const limit = Number.isFinite(rawLimit)
      ? Math.min(Math.max(rawLimit, 1), MAX_PAGE_SIZE)
      : DEFAULT_PAGE_SIZE;
    const cursor = typeof req.query?.cursor === 'string' && req.query.cursor ? req.query.cursor : null;

    const rows = await getUserHistory(userId, {
      isAdmin: isAdmin(req.user?.role),
      limit,
      cursor,
    });

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;

    return res.status(200).json({
      success: true,
      data: page,
      pagination: {
        limit,
        hasMore,
        nextCursor: hasMore ? page[page.length - 1]?.id ?? null : null,
      },
    });
  } catch (error) {
    console.error('[calculationHistory.getAll]', error);

    return res.status(500).json({
      success: false,
      message: 'خطا در دریافت تاریخچه محاسبات.',
    });
  }
}

/**
 * POST /sync
 * Bulk-inserts a batch of offline calculation history records.
 *
 * The request body is a JSON array of history items.
 */
export async function syncHistory(req, res) {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'کاربر احراز هویت نشده است.',
      });
    }

    const items = req.body;

    if (!Array.isArray(items)) {
      return res.status(400).json({
        success: false,
        message: 'بدنه درخواست باید آرایه‌ای از تاریخچه محاسبات باشد.',
      });
    }

    if (items.length === 0) {
      return res.status(200).json({
        success: true,
        data: { count: 0 },
      });
    }

    if (items.length > MAX_SYNC_BATCH_SIZE) {
      return res.status(400).json({
        success: false,
        message: `حداکثر ${MAX_SYNC_BATCH_SIZE} مورد در هر درخواست سینک مجاز است.`,
      });
    }

    for (let index = 0; index < items.length; index += 1) {
      const validationError = validateHistoryItem(items[index]);

      if (validationError) {
        return res.status(400).json({
          success: false,
          message: `آیتم شماره ${index + 1} نامعتبر است: ${validationError}`,
        });
      }
    }

    const result = await createHistoryItems(userId, items);

    return res.status(201).json({
      success: true,
      data: { count: result.count },
    });
  } catch (error) {
    console.error('[calculationHistory.syncHistory]', error);

    return res.status(500).json({
      success: false,
      message: 'خطا در سینک تاریخچه محاسبات.',
    });
  }
}
