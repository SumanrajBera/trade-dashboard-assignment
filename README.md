# BSE Trades Dashboard

A trades dashboard that pulls data from a (mock) BSE Exchange API.

A full pull takes up to **15 minutes**, but the network kills any HTTP connection held open for more than **30 seconds**. So the app never waits on one long request. Instead:

- The API server starts a pull as a **background job** and replies instantly.
- A **worker** fetches the data in many short requests (each well under 30s) and saves it to Redis.
- When the job finishes, the server **pushes** an event to the browser over Socket.IO, and the dashboard updates itself. No page refresh, no polling, no cron.

## How it works

```
Browser ──POST /pulls──▶ API server ──adds job──▶ Redis (BullMQ queue)
   ▲                         │                           │
   │                         │                           ▼
   │                  QueueEvents (job done)      Worker picks up job
   │                         │                           │
   └──── Socket.IO push ◀────┘                           ▼
                                              Many short calls ──▶ Mock BSE API
                                                      │
                                                      ▼
                                              Trades saved in Redis
```

| Part | File | Port | Role |
|---|---|---|---|
| Mock BSE API | `mock-bse.js` | 4000 | Serves seeded trade data, slowly, in pages |
| API server + dashboard | `server.js`, `index.html` | 3000 | Starts pulls, serves trades, pushes updates |
| Worker | `worker.js` | none | Runs the pull in the background |
| Redis | Docker container | 6379 | Job queue (BullMQ) and trade storage |

## Prerequisites

- [Node.js](https://nodejs.org) 18 or newer (the worker uses the built-in `fetch`)
- [Docker](https://www.docker.com) (to run Redis)

## Setup

1. Install dependencies:

   ```bash
   npm install express bullmq ioredis socket.io
   ```

2. Start Redis (first time only):

   ```bash
   docker run --name redis -p 6379:6379 -d redis
   ```

   Check that it works:

   ```bash
   docker exec -it redis redis-cli ping
   # PONG
   ```

   On later days, start the existing container instead:

   ```bash
   docker start redis
   ```

## Run

Open **three terminals** in the project folder and start these in order.

**Terminal 1: Mock BSE API**

```bash
cd backend/src
node mock-bse.js
```

**Terminal 2: Worker**

```bash
cd backend/src
node worker.js
```

**Terminal 3: API server and dashboard**

```bash
cd backend
node server.js
```

Then open **http://localhost:3000** and click **Start pull**.

The dashboard opens instantly with whatever trades are already saved. While the pull runs, the status badge shows "Pull running...". When the worker finishes, the badge turns green and the table refreshes by itself.

## Configuring the pull time

The mock API has a configurable delay per page. With the defaults (60 pages, 15 seconds each) a full pull takes 15 minutes, and each request stays under the 30-second limit.

| Goal | Command |
|---|---|
| Full 15-minute pull (default) | `node mock-bse.js` |

## Endpoints

**Mock BSE API (port 4000)**

| Method | Path | Description |
|---|---|---|
| GET | `/trades?page=1` | One page of seeded trades (`tradeId`, `client`, `symbol`, `quantity`, `price`, `timestamp`) plus `totalPages` |

**API server (port 3000)**

| Method | Path | Description |
|---|---|---|
| GET | `/` | The dashboard |
| POST | `/pulls` | Starts a pull. Replies immediately with `202` and a `jobId` |
| GET | `/pulls/:id` | Status of a pull (`waiting`, `active`, `completed`, `failed`) |
| GET | `/getTrades` | The latest saved trades, read from Redis |

## Notes

- **Seeded data:** the mock API always returns the same trades for the same trade ID. A second pull on top of existing data saves the same trades again, so the table looks unchanged. To see new trades appear, clear Redis first (below).
- **Restart after edits:** Node does not reload files on save. If you change `mock-bse.js`, `worker.js`, or `server.js`, stop that terminal with `Ctrl+C` and start it again.
- **Retries are safe:** each trade is saved under its own key, so saving the same page twice does not create duplicates.

## Troubleshooting

**Reset all data** (this deletes everything in Redis, including queued jobs). Only do this while no pull is running:

```bash
docker exec -it redis redis-cli flushall
```

**Port already in use:** another copy of the app is still running. Stop it with `Ctrl+C` in its terminal, or find and stop the process using that port.

**`docker run` says the name "redis" is already in use:** the container already exists. Use `docker start redis` instead.

**Worker shows nothing after clicking Start pull:** check that Redis is running (`docker ps`) and that the worker and server both point to the same Redis on `127.0.0.1:6379`.

**Pull log still shows the old page count:** the mock API is still running the old code. Restart `mock-bse.js`.

## Stopping everything

Press `Ctrl+C` in each of the three terminals, then:

```bash
docker stop redis
```

Saved trades are kept when you `docker stop` and `docker start` the container. They are lost if you delete the container with `docker rm`.