import path from 'node:path';
import { env } from './env.js';

export const UPLOADS_DIR = path.resolve(process.cwd(), env.UPLOAD_DIR);
