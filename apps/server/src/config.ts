import 'dotenv/config';

const config = {
  port: Number(process.env.PORT ?? 3000),
  databaseUrl:
    process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/postgres',
  sessionSecret: process.env.SESSION_SECRET ?? 'dev-secret'
};

export default config;
