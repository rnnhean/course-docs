#!/usr/bin/env node
/**
 * MCP Server —— 本地版（P36–P37）
 *
 * 课程要求（逐条对应）：
 *   - "一个文件、stdio、无登录、只读" —— p036/p037
 *   - 三个工具：list_events / get_event / quote_price
 *   - 验收：问「未来三周内、50 欧以下的音乐会有些什么？」，
 *     Agent 应先用 list_events 带 50 欧上限，再对找到的场次调 quote_price，
 *     最后带剩余座位和票价回答 —— p037 [00:53]–[01:22]
 *
 * 注册：
 *   claude mcp add ticketbay -- node mcp-server/stdio.mjs
 *
 * 不引第三方 SDK：MCP 就是 JSON-RPC 2.0 over stdio，一行一条消息，
 * 依赖越少越容易在沙箱里跑起来。
 */
import { createInterface } from 'node:readline';
import { listEvents, getEvent, quotePrice } from '../app/store.mjs';

const PROTOCOL_VERSION = '2024-11-05';
const SERVER_INFO = { name: 'ticketbay', version: '0.1.0' };

const TOOLS = [
    {
        name: 'list_events',
        description: '列出活动（只读）。可按开始日期、结束日期、最高票价过滤。返回每场活动的余票与状态徽章。',
        inputSchema: {
            type: 'object',
            properties: {
                from: { type: 'string', description: '开始日期 YYYY-MM-DD（含）' },
                to: { type: 'string', description: '结束日期 YYYY-MM-DD（含）' },
                maxPriceCents: { type: 'number', description: '最高票价（分）。50 欧 = 5000' },
            },
        },
    },
    {
        name: 'get_event',
        description: '查某场活动的剩余座位、票价与状态（只读）。',
        inputSchema: {
            type: 'object',
            properties: { eventId: { type: 'string' } },
            required: ['eventId'],
        },
    },
    {
        name: 'quote_price',
        description: '按折扣码算若干张票的总价（只读，不占座、不下单）。',
        inputSchema: {
            type: 'object',
            properties: {
                eventId: { type: 'string' },
                quantity: { type: 'number', minimum: 1 },
                discountCode: { type: 'string' },
            },
            required: ['eventId', 'quantity'],
        },
    },
];

function callTool(name, args = {}) {
    switch (name) {
        case 'list_events':
            return listEvents({
                from: args.from,
                to: args.to,
                maxPriceCents: args.maxPriceCents,
            });
        case 'get_event': {
            const e = getEvent(args.eventId);
            if (!e) throw new Error(`活动不存在: ${args.eventId}`);
            return e;
        }
        case 'quote_price':
            return quotePrice({
                eventId: args.eventId,
                quantity: args.quantity,
                discountCode: args.discountCode,
            });
        default:
            throw new Error(`未知工具: ${name}`);
    }
}

const send = (msg) => process.stdout.write(JSON.stringify(msg) + '\n');

function handle(req) {
    const { id, method, params } = req;

    // 通知类消息没有 id，不需要回复
    if (id === undefined || id === null) return;

    try {
        switch (method) {
            case 'initialize':
                return send({
                    jsonrpc: '2.0', id,
                    result: {
                        protocolVersion: PROTOCOL_VERSION,
                        capabilities: { tools: {} },
                        serverInfo: SERVER_INFO,
                    },
                });
            case 'tools/list':
                return send({ jsonrpc: '2.0', id, result: { tools: TOOLS } });
            case 'tools/call': {
                const { name, arguments: args } = params || {};
                try {
                    const data = callTool(name, args);
                    return send({
                        jsonrpc: '2.0', id,
                        result: {
                            content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
                            isError: false,
                        },
                    });
                } catch (e) {
                    return send({
                        jsonrpc: '2.0', id,
                        result: {
                            content: [{ type: 'text', text: `错误：${e.message}` }],
                            isError: true,
                        },
                    });
                }
            }
            case 'ping':
                return send({ jsonrpc: '2.0', id, result: {} });
            default:
                return send({
                    jsonrpc: '2.0', id,
                    error: { code: -32601, message: `Method not found: ${method}` },
                });
        }
    } catch (e) {
        return send({
            jsonrpc: '2.0', id,
            error: { code: -32603, message: e.message },
        });
    }
}

const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });
rl.on('line', (line) => {
    const t = line.trim();
    if (!t) return;
    let req;
    try {
        req = JSON.parse(t);
    } catch {
        return send({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } });
    }
    handle(req);
});
