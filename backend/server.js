import express from "express";
import http from 'http'
import { Server } from "socket.io";
import { Queue, QueueEvents } from "bullmq";
import Redis from "ioredis";
import path from "path";

const connection = { host: '127.0.0.1', port: 6379 };
const queue = new Queue('bse-pull', { connection });

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const redis = new Redis()

app.get("/", (req, res) => {
    res.sendFile(path.join(import.meta.dirname, "index.html"));
});

app.get('/getTrades', async (req, res) => {
    const ids = await redis.zrevrange('trades:byIngest', 0, 19);   // latest 20
    const pipe = redis.pipeline();
    ids.forEach(id => pipe.hgetall(`trade:${id}`));
    const results = await pipe.exec();
    res.json(results.map(([, trade]) => trade));
});

// Start a pull: replies instantly
app.post('/pulls', async (req, res) => {
    const job = await queue.add('pull', {});
    res.status(202).json({ jobId: job.id });
});

// Check a pull's status
app.get('/pulls/:id', async (req, res) => {
    const job = await queue.getJob(req.params.id);
    if (!job) return res.sendStatus(404);
    res.json({ status: await job.getState() });
});

// The buzzer: listen to BullMQ, then tell every open browser
const events = new QueueEvents('bse-pull', { connection });
events.on('completed', ({ jobId }) => {
    io.emit('pull:completed', { jobId });
});

server.listen(3000, () => console.log('API running on: 3000'));