import { config as dotenv } from 'dotenv';
import { z } from 'zod';

const schema = z.object({
 OPENROUTER_API_KEY: z.string().default(''),
 JUDGE_MODEL: z.string().min(1).default('typesafe/jev-1.13'),
 JUDGE_THRESHOLD: z.coerce.number().min(0).max(1).default(0.4),
 SOLVE_THRESHOLD: z.coerce.number().min(0).max(1).default(0.55),
 PORT: z.coerce.number().int().min(1).max(65535).default(3001),
 DB_PATH: z.string().min(1).default('./turtle.db'),
});
export function loadConfig(env: Record<string, string | undefined> = process.env) {
 if (env === process.env) dotenv({ quiet: true });
 const v = schema.parse(env);
 const apiKey = v.OPENROUTER_API_KEY.trim();
 if (!apiKey) console.warn('⚠ 未配置 OPENROUTER_API_KEY，判题将返回「出错」。');
 return { apiKey, judgeConfigured: !!apiKey, model:v.JUDGE_MODEL, judgeThreshold:v.JUDGE_THRESHOLD, solveThreshold:v.SOLVE_THRESHOLD, port:v.PORT, dbPath:v.DB_PATH };
}
export type Config = ReturnType<typeof loadConfig>;
