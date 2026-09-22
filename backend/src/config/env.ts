import dotenv from 'dotenv';
dotenv.config();
interface EnvConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceRoleKey: string;
  port: number;
  nodeEnv: string;
  corsOrigin: string[];
  rateLimitWindowMs: number;
  rateLimitMax: number;
  auditLoggingEnabled: boolean;
}
const requiredEnvVars = [
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
];
const nodeEnv = process.env.NODE_ENV || 'development';
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    if (nodeEnv === 'production') {
      throw new Error(`Missing required environment variable: ${envVar}`);
    }
    console.warn(`?? Missing environment variable: ${envVar}`);
  }
}
const port = parseInt(process.env.PORT || '4000', 10);
const rateLimitWindowMs = parseInt(
  process.env.RATE_LIMIT_WINDOW_MS || '900000',
  10
);
const rateLimitMax = parseInt(
  process.env.RATE_LIMIT_MAX || '1000',
  10
);
if (!Number.isFinite(port) || port <= 0 || port > 65535) {
  throw new Error('Invalid PORT configuration');
}
if (!Number.isFinite(rateLimitWindowMs) || rateLimitWindowMs <= 0) {
  throw new Error('Invalid RATE_LIMIT_WINDOW_MS configuration');
}
if (!Number.isFinite(rateLimitMax) || rateLimitMax <= 0) {
  throw new Error('Invalid RATE_LIMIT_MAX configuration');
}
const config: EnvConfig = {
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  port,
  nodeEnv,
  corsOrigin: (process.env.CORS_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  rateLimitWindowMs,
  rateLimitMax,
  auditLoggingEnabled: process.env.AUDIT_LOGGING_ENABLED === 'true',
};
export default config;
