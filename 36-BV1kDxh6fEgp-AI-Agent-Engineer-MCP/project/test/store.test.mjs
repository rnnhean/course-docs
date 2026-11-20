import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eventStatus, quotePrice, resolveDiscount, listEvents, getEvent } from '../app/store.mjs';

test('座位为 0 必须显示 sold_out（课程 p044 埋的 bug：写成 <0 会显示 few_left）', () => {
    assert.equal(eventStatus({ seatsLeft: 0 }), 'sold_out');
    assert.equal(eventStatus({ seatsLeft: -3 }), 'sold_out');
});

test('余票 1–9 显示 few_left，10 及以上 available', () => {
    assert.equal(eventStatus({ seatsLeft: 1 }), 'few_left');
    assert.equal(eventStatus({ seatsLeft: 9 }), 'few_left');
    assert.equal(eventStatus({ seatsLeft: 10 }), 'available');
});

test('Nowakings 已售罄，状态是 sold_out', () => {
    assert.equal(getEvent('evt_nowakings').status, 'sold_out');
});

test('STUDENT15 有效，SUMMER25 已过期', () => {
    const a = resolveDiscount('STUDENT15', new Date('2026-11-20'));
    const b = resolveDiscount('SUMMER25', new Date('2026-11-20'));
    assert.equal(a.valid, true);
    assert.equal(a.percentOff, 15);
    assert.equal(b.valid, false);
    assert.match(b.reason, /过期/);
});

test('quote_price 折扣只影响总价，不影响单价与小计', () => {
    const q = quotePrice({ eventId: 'evt_balaton', quantity: 2, discountCode: 'STUDENT15' });
    assert.equal(q.subtotalCents, 8900 * 2);
    assert.equal(q.totalCents, Math.round(8900 * 2 * 0.85));
});

test('quote_price 超过余票要报错', () => {
    assert.throws(() => quotePrice({ eventId: 'evt_sziget_pre', quantity: 999 }), /余票不足/);
});

test('list_events 能按最高票价过滤（课程验收问题：未来三周内、50 欧以下）', () => {
    const today = '2026-11-20';
    const until = '2026-12-11';
    const rows = listEvents({ from: today, to: until, maxPriceCents: 5000 });
    assert.ok(rows.length >= 1);
    for (const r of rows) {
        assert.ok(r.date >= today && r.date <= until);
        assert.ok(r.priceCents <= 5000);
    }
});
