// Env loading — imported first by index.js so it runs before any service module.
// Load paths relative to this file so `npm run dev` from the repo root works too.
// Personal keys (.env, gitignored) win; shared demo keys (.env.demo) fill the gaps.
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(__dirname, '.env.demo') });
