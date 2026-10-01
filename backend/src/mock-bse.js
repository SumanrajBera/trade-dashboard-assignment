import express from 'express'
const app = express();

const TOTAL_PAGES = 60;
const PAGE_SIZE = 50;                 // 60 x 50 = 3000 trades
const PAGE_DELAY_MS = 15000;          // 60 pages x 15s = 15 minutes. Use 200 for quick testing
const CLIENTS = ['CLT001', 'CLT002', 'CLT003', 'CLT004', 'CLT005'];
const BASE_TIME = Date.parse('2026-01-01T09:15:00Z');

const SYMBOLS = ['TCS', 'INFY', 'RELIANCE', 'HDFCBANK'];

function makeTrade(n) {
    const seed = (n * 9301 + 49297) % 233280;   // same n always gives the same seed
    return {
        tradeId: `T${n}`,
        client: CLIENTS[seed % CLIENTS.length],
        symbol: SYMBOLS[n % SYMBOLS.length],
        price: (100 + (seed % 90000) / 100).toFixed(2),
        qty: (seed % 500) + 1,
        timestamp: new Date(BASE_TIME + n * 1000).toISOString(),
    };
}

app.get('/trades', async (req, res) => {
    const page = Number(req.query.page) || 1;

    // pretend the API is slow (1 second per page)
    await new Promise(r => setTimeout(r, PAGE_DELAY_MS));

    const trades = [];
    for (let i = 0; i < PAGE_SIZE; i++) {
        const n = (page - 1) * PAGE_SIZE + i;
        trades.push(makeTrade(n));
    }

    res.json({ trades, totalPages: TOTAL_PAGES });
});

app.listen(4000, () => console.log('Mock BSE running on: 4000'));