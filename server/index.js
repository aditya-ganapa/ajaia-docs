import { createDb } from './db.js';
import { createApp } from './app.js';

const port = Number(process.env.PORT) || 3001;
const db = createDb(process.env.DB_PATH || './data/app.db');

if (process.env.NODE_ENV === 'production' && !process.env.COOKIE_SECRET) {
  console.warn('COOKIE_SECRET is not set; using the insecure development default.');
}

createApp(db, { cookieSecret: process.env.COOKIE_SECRET }).listen(port, () => {
  console.log(`Ajaia Docs listening on http://localhost:${port}`);
});
