import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

process.env.JWT_SECRET =
  process.env.JWT_SECRET ||
  'e63da7e3016cdc9bcfcfc30779917328e9339a24cac9ad4dcb042ed50efaf7901eaa22dacc3560b6990f94d8316f9846';

process.env.WEBHOOK_ENCRYPTION_KEY =
  process.env.WEBHOOK_ENCRYPTION_KEY ||
  '89d13a8203e2064eb669a3b9100cf2debfd90c7c6b518f26a897ce62623cf8c8';

process.env.DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://etdox_user:postgre99@localhost:5432/etdox_dev';
