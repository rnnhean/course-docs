#!/usr/bin/env node
/**
 * 阻断型 hook ②：不让 Agent 读凭据文件，改指 .env.example（P17）
 *
 * 课程原话：这条 hook 挡的是「把密钥读进上下文」，不是「不让配置」。
 *   "It blocks reading the .env file and points to .env.example instead."
 *
 * 注意判定标准是「内容里有凭据」，不是文件名——.env.production、credentials.json、
 * auth.json、settings.json 这些都要拦。
 */
import { readFileSync } from 'node:fs';

const SECRET_PATTERNS = [
    /(^|[\\/])\.env(\.|$)/i,          // .env / .env.local / .env.production
    /(^|[\\/])auth\.json$/i,
    /(^|[\\/])credentials(\.json)?$/i,
    /(^|[\\/])settings\.json$/i,
    /(^|[\\/])id_(rsa|ed25519)/i,
    /(^|[\\/])\.npmrc$/i,
    /(^|[\\/])gh-token/i,
];

let input = {};
try {
    input = JSON.parse(readFileSync(0, 'utf8') || '{}');
} catch {
    process.exit(0);
}

const p = input?.tool_input?.file_path ?? input?.tool_input?.path ?? '';
if (!p) process.exit(0);

if (!SECRET_PATTERNS.some((re) => re.test(p))) process.exit(0);

process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason:
            `这个文件可能含有凭据，不能读入上下文。\n` +
            '- 想知道有哪些变量 → 读 `.env.example`\n' +
            '- 想验证配置生效 → 只看「是否为空 / 长度」，不打印内容\n' +
            '- 需要真的用凭据跑 → 让代码自己从固定路径加载，不要读进对话',
    },
}));
process.exit(0);
