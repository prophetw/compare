import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import config from './config';
import { ensureDbConnection } from './db';
import authRouter from './routes/auth';

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const staticDir = path.resolve(__dirname, '../public');

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

app.use('/api/auth', authRouter);
app.use(express.static(staticDir));

app.get('/healthz', (_req, res) => res.json({ status: 'ok' }));

app.use('*', (_req, res, next) => {
  const indexFile = path.join(staticDir, 'index.html');
  res.sendFile(indexFile, (err) => {
    if (err) {
      next();
    }
  });
});

async function bootstrap() {
  try {
    await ensureDbConnection();
    app.listen(config.port, () => {
      console.log(`server ready on http://localhost:${config.port}`);
    });
  } catch (error) {
    console.error('无法启动服务器：', error);
    process.exit(1);
  }
}

bootstrap();
