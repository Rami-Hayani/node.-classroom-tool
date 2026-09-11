import path from "path";
import dotenv from "dotenv";

// Load .env from project root BEFORE anything else
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

import express from "express";
import { createServer } from "http";
import next from "next";
import { Server } from "socket.io";
import { setupSocket } from "./socket";
import transcriptRoute from "./transcript-route";
import chatRoute from "./chat-route";
import pollGenerateRoute from "./poll-generate-route";
import pollActivateRoute from "./poll-activate-route";
import pollRespondRoute from "./poll-respond-route";
import pollCloseRoute from "./poll-close-route";
import interventionRoute from "./intervention-route";
const dev = process.env.NODE_ENV !== "production";
const port = parseInt(process.env.PORT || "3000", 10);

const app = express();
const server = createServer(app);

const io = new Server(server, {
  cors: { origin: "*" },
});

setupSocket(io);

const nextApp = next({ dev });
const nextHandler = nextApp.getRequestHandler();

nextApp.prepare().then(async () => {
  // Transcript route runs in Express context so Socket.IO emit works
  app.use(transcriptRoute);

  // Chat route runs in Express context to avoid body parsing issues
  app.use(chatRoute);

  // Poll routes run in Express so Socket.IO emits work
  app.use(pollGenerateRoute);
  app.use(pollActivateRoute);
  app.use(pollRespondRoute);
  app.use(pollCloseRoute);

  // Intervention route runs in Express to ensure env vars work
  app.use(interventionRoute);

  // Pass all other requests to Next.js
  app.use((req, res) => {
    return nextHandler(req, res);
  });

  server.listen(port, () => {
    console.log(`> Ready on http://localhost:${port}`);
    console.log(`> Socket.IO server attached`);
  });
});
