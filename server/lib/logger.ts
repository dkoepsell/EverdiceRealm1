import pino from "pino";

export const serverLogger = pino({
  level: process.env.LOG_LEVEL || "info",
  transport:
    process.env.NODE_ENV === "development"
      ? {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "HH:MM:ss",
            ignore: "pid,hostname",
            singleLine: true,
          },
        }
      : undefined,
  serializers: {
    err: pino.stdSerializers.err,
    req: (req) => ({
      method: req.method,
      url: req.url,
    }),
  },
  redact: {
    paths: ["req.headers.authorization", "req.headers.cookie", "password", "apiKey", "secret"],
    censor: "[REDACTED]",
  },
});
