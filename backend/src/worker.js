import { Worker } from "bullmq";
import Redis from "ioredis";
const redis = new Redis();

async function saveTrades(trades) {
  const pipe = redis.pipeline();
  for (const t of trades) {
    pipe.hset(`trade:${t.tradeId}`, t);
    pipe.zadd('trades:byIngest', Date.now(), t.tradeId)
  }
  await pipe.exec();
}

new Worker('bse-pull', async (job) => {
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    const res = await fetch(`http://localhost:4000/trades?page=${page}`);
    const data = await res.json();
    totalPages = data.totalPages;

    await saveTrades(data.trades);
    console.log(`Saved page ${page} of ${totalPages}`);
    page++;
  }

  console.log('Job finished!');
}, { connection: { host: '127.0.0.1', port: 6379 } });

console.log('Worker waiting for jobs...');