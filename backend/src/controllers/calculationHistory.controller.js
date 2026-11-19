import { createHistory, getUserHistory } from '../services/calculationHistory.service.js';

const REQUIRED_FIELDS = ['toolId', 'toolVersion', 'inputData', 'outputData'];

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
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

    const missingFields = REQUIRED_FIELDS.filter(
      (field) => body[field] === undefined || body[field] === null || body[field] === ''
    );

    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `فیلدهای الزامی ارسال نشده‌اند: ${missingFields.join(', ')}`,
      });
    }

    if (!isPlainObject(body.inputData) || !isPlainObject(body.outputData)) {
      return res.status(400).json({
        success: false,
        message: 'inputData و outputData باید از نوع آبجکت JSON باشند.',
      });
    }

    if (body.sources !== undefined && body.sources !== null && !isPlainObject(body.sources)) {
      return res.status(400).json({
        success: false,
        message: 'sources باید از نوع آبجکت JSON باشد.',
      });
    }

    const history = await createHistory(userId, {
      toolId: body.toolId,
      toolVersion: body.toolVersion,
      inputData: body.inputData,
      outputData: body.outputData,
      sources: body.sources,
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
 * Returns all calculation history records for the authenticated user.
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

    const history = await getUserHistory(userId);

    return res.status(200).json({
      success: true,
      data: history,
    });
  } catch (error) {
    console.error('[calculationHistory.getAll]', error);

    return res.status(500).json({
      success: false,
      message: 'خطا در دریافت تاریخچه محاسبات.',
    });
  }
}
