#!/usr/bin/env node
/**
 * 阻断型 hook ③：Agent 说「做完了」时跑测试，红了就把失败输出回灌（P17）
 *
 * 课程原话：这是把「写完代码跑测试」从 agents.md 里的一句自觉，变成 harness 的强制动作。
 *   "A rule in your agents.md is only text and nothing forces the model to follow it...
 *    A hook is a script the harness runs at a fixed moment." —— p017 [00:00]
 *
 * 全绿时什么都不输出（零上下文成本）。
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

let input = {};
try {
    input = JSON.parse(readFileSync(0, 'utf8') || '{}');
} catch {
    process.exit(0);
}

// 防止无限循环：同一次 stop 最多回灌三次
const stopHookActive = input?.stop_hook_active === true;

try {
    execFileSync('npm', ['test', '--silent'], {
        stdio: 'pipe',
        shell: process.platform === 'win32',
        timeout: 10 * 60 * 1000,
    });
    process.exit(0);
} catch (err) {
    if (stopHookActive) {
        // 已经回灌过一轮仍失败，放行，避免死循环
        process.exit(0);
    }
    const out = `${err.stdout ?? ''}${err.stderr ?? ''}`.slice(-4000);
    process.stdout.write(JSON.stringify({
        decision: 'block',
        reason:
            '测试没通过，不能算完成。先修代码；如果确实是需求变了，先改测试并说明理由。\n\n' +
            out,
    }));
    process.exit(0);
}
