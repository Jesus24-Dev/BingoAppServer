import { Server } from 'socket.io';
import { createServer } from 'http';
import express from 'express';
import 'dotenv/config';

export const initializeServer = () => {
  const app = express();
  const httpServer = createServer(app);
  
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL,
      methods: ["GET", "POST"],
      credentials: true
    },
    connectionStateRecovery: {
      maxDisconnectionDuration: 2 * 60 * 1000,
      skipMiddlewares: true
    }
  });

  return { app, io, httpServer };
};