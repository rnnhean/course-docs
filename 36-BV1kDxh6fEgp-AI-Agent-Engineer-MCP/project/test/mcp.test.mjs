import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const ENTRY = path.join(ROOT, 'mcp-server', 'stdio.mjs');

let child;
let rl;
const pending = new Map();
let nextId = 1;

const call = (method, params) =>
    new Promise((resolve, reject) => {
        const id = nextId++;
        pending.set(id, { resolve, reject });
        child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
        setTimeout(() => {
            if (pending.has(id)) {
                pending.delete(id);
                reject(new Error(`超时: ${method}`));
            }
        }, 5000);
    });

before(() => {
    child = spawn(process.execPath, [ENTRY], { cwd: ROOT, stdio: ['pipe', 'pipe', 'pipe'] });
    rl = createInterface({ input: child.stdout });
    rl.on('line', (line) => {
        const msg = JSON.parse(line);
        const p = pending.get(msg.id);
        if (p) {
            pending.delete(msg.id);
            p.resolve(msg);
        }
    });
});

after(() => {
    child.kill();
});

test('initialize 返回协议版本与 tools 能力', async () => {
    const res = await call('initialize', {});
    assert.equal(res.result.protocolVersion, '2024-11-05');
    assert.ok(res.result.capabilities.tools);
    assert.equal(res.result.serverInfo.name, 'ticketbay');
});

test('tools/list 恰好三个只读工具', async () => {
    const res = await call('tools/list', {});
    const names = res.result.tools.map((t) => t.name).sort();
    assert.deepEqual(names, ['get_event', 'list_events', 'quote_price']);
});

test('list_events 带 50 欧上限（课程验收场景）', async () => {
    const res = await call('tools/call', {
        name: 'list_events',
        arguments: { maxPriceCents: 5000 },
    });
    assert.equal(res.result.isError, false);
    const rows = JSON.parse(res.result.content[0].text);
    assert.ok(Array.isArray(rows));
    for (const r of rows) assert.ok(r.priceCents <= 5000);
});

test('get_event 未知活动返回 isError 而不是崩掉', async () => {
    const res = await call('tools/call', {
        name: 'get_event',
        arguments: { eventId: 'evt_不存在' },
    });
    assert.equal(res.result.isError, true);
    assert.match(res.result.content[0].text, /活动不存在/);
});

test('quote_price 对已售罄场次报余票不足', async () => {
    const res = await call('tools/call', {
        name: 'quote_price',
        arguments: { eventId: 'evt_nowakings', quantity: 1 },
    });
    assert.equal(res.result.isError, true);
    assert.match(res.result.content[0].text, /余票不足/);
});

test('未知方法返回 -32601', async () => {
    const res = await call('nope/nothing', {});
    assert.equal(res.error.code, -32601);
});
