/**
 * TicketBay 的最小重建（课程未公开源码）。
 *
 * 只实现课程里**出现过**的实体与行为，不做额外设计：
 *   - 活动：Nowakings（座位售罄）、Balaton Sound（可售）—— p038/p044 出现
 *   - 状态徽章：sold out / few left / available —— p044 的埋点 bug 就在这个判断上
 *     （课程里写的是 `< 0`，导致「刚好 0 张」显示 few left；正确是 `<= 0`）
 *   - 折扣码：STUDENT15（15% off）、SUMMER25（已过期）—— p032-44 练习要求
 *   - 订单 / 退款 / 取消活动（admin）
 *
 * 数据落一个 JSON 文件，零依赖；课程用的是 Postgres + Drizzle，这里不复制其实现，
 * 因为课程没有给 schema 源码。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DB_FILE = path.join(ROOT, 'data', 'db.json');

const seed = {
    events: [
        { id: 'evt_nowakings', title: 'Nowakings', date: '2026-12-05', venue: 'Budapest', priceCents: 4500, seatsTotal: 120, seatsLeft: 0 },
        { id: 'evt_balaton', title: 'Balaton Sound', date: '2026-12-20', venue: 'Zamárdi', priceCents: 8900, seatsTotal: 400, seatsLeft: 37 },
        { id: 'evt_sziget_pre', title: 'Sziget Pre-Party', date: '2026-12-12', venue: 'Budapest', priceCents: 3900, seatsTotal: 200, seatsLeft: 8 },
        { id: 'evt_acoustic_night', title: 'Acoustic Night', date: '2027-01-09', venue: 'Debrecen', priceCents: 2900, seatsTotal: 150, seatsLeft: 150 },
    ],
    discountCodes: [
        { code: 'STUDENT15', percentOff: 15, expiresAt: '2027-06-30' },
        { code: 'SUMMER25', percentOff: 25, expiresAt: '2026-09-01' },
    ],
    orders: [],
    nextOrderId: 1,
};

function load() {
    if (!fs.existsSync(DB_FILE)) {
        fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
        fs.writeFileSync(DB_FILE, JSON.stringify(seed, null, 2));
        return structuredClone(seed);
    }
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}

let db = load();
const save = () => {
    fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
};

/** 状态判断：0 张就是售罄。课程埋的 bug 是写成 `< 0`，这里是修正后的写法（p044） */
export function eventStatus(e, fewLeftThreshold = 10) {
    if (e.seatsLeft <= 0) return 'sold_out';
    if (e.seatsLeft < fewLeftThreshold) return 'few_left';
    return 'available';
}

export function listEvents({ from, to, maxPriceCents } = {}) {
    return db.events
        .filter((e) => (from ? e.date >= from : true))
        .filter((e) => (to ? e.date <= to : true))
        .filter((e) => (maxPriceCents != null ? e.priceCents <= maxPriceCents : true))
        .map((e) => ({ ...e, status: eventStatus(e) }))
        .sort((a, b) => a.date.localeCompare(b.date));
}

export function getEvent(id) {
    const e = db.events.find((x) => x.id === id);
    if (!e) return null;
    return { ...e, status: eventStatus(e) };
}

/** 折扣码：课程要求「调用与结账同一份代码」，所以 quote 与 checkout 都走这里 */
export function resolveDiscount(code, now = new Date()) {
    if (!code) return { valid: false, percentOff: 0, reason: '未提供折扣码' };
    const d = db.discountCodes.find((x) => x.code.toUpperCase() === String(code).toUpperCase());
    if (!d) return { valid: false, percentOff: 0, reason: '折扣码不存在' };
    if (new Date(d.expiresAt) < now) return { valid: false, percentOff: 0, reason: `已于 ${d.expiresAt} 过期` };
    return { valid: true, percentOff: d.percentOff, reason: `${d.percentOff}% off` };
}

export function quotePrice({ eventId, quantity, discountCode }) {
    const e = getEvent(eventId);
    if (!e) throw new Error(`活动不存在: ${eventId}`);
    if (!Number.isInteger(quantity) || quantity < 1) throw new Error('quantity 必须是正整数');
    if (quantity > e.seatsLeft) throw new Error(`余票不足：剩 ${e.seatsLeft} 张，请求 ${quantity} 张`);
    const subtotal = e.priceCents * quantity;
    const d = resolveDiscount(discountCode);
    const total = d.valid ? Math.round(subtotal * (1 - d.percentOff / 100)) : subtotal;
    return { eventId, quantity, subtotalCents: subtotal, discount: d, totalCents: total };
}

export function bookTickets({ userId, eventId, quantity, discountCode }) {
    const q = quotePrice({ eventId, quantity, discountCode });
    const e = db.events.find((x) => x.id === eventId);
    e.seatsLeft -= quantity;
    const order = {
        id: `ord_${db.nextOrderId++}`,
        userId,
        eventId,
        quantity,
        totalCents: q.totalCents,
        status: 'paid',
        createdAt: new Date().toISOString(),
    };
    db.orders.push(order);
    save();
    return order;
}

export function listOrders(userId) {
    return db.orders.filter((o) => o.userId === userId);
}

export function refundOrder({ userId, orderId }) {
    const o = db.orders.find((x) => x.id === orderId && x.userId === userId);
    if (!o) throw new Error('订单不存在');
    if (o.status !== 'paid') throw new Error(`订单状态是 ${o.status}，不能退款`);
    o.status = 'refunded';
    const e = db.events.find((x) => x.id === o.eventId);
    if (e) e.seatsLeft += o.quantity;
    save();
    return o;
}

export function cancelEvent({ actorRole, eventId }) {
    if (actorRole !== 'admin') throw new Error('只有 admin 能取消活动');
    const e = db.events.find((x) => x.id === eventId);
    if (!e) throw new Error('活动不存在');
    e.cancelled = true;
    db.orders.filter((o) => o.eventId === eventId && o.status === 'paid').forEach((o) => { o.status = 'refunded'; });
    save();
    return e;
}

export function searchDocs(query) {
    // 重建：课程只要求「返回匹配章节原文和来源页」，没给文档内容
    const DOCS = [
        { page: '/help/refunds', text: '退款：已支付订单可在活动开始前 24 小时申请，退款后座位立即释放。' },
        { page: '/help/discounts', text: '折扣码：STUDENT15 减免 15%，SUMMER25 已于 2026-09-01 过期。' },
        { page: '/help/booking', text: '订票：选择场次与张数，确认报价后完成支付，订单可在「我的订单」查看。' },
    ];
    const q = String(query || '').toLowerCase();
    return DOCS.filter((d) => d.text.toLowerCase().includes(q) || d.page.includes(q));
}
