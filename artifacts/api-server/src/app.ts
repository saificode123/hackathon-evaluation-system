import type { IncomingMessage, ServerResponse } from "node:http";
import express, { type Express } from "express";
import cors from "cors";
import router from "./routes";
import { logger } from "./lib/logger";
import {
  createPinoHttpMiddleware,
  type PinoHttpOptions,
} from "./lib/pino-http-middleware";

const app: Express = express();

const httpLoggerOptions: PinoHttpOptions = {
  logger,
  serializers: {
    req(req: IncomingMessage) {
      return {
        id: req.id,
        method: req.method,
        url: req.url?.split("?")[0],
      };
    },
    res(res: ServerResponse) {
      return {
        statusCode: res.statusCode,
      };
    },
  },
};

app.use(createPinoHttpMiddleware(httpLoggerOptions));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

export default app;
