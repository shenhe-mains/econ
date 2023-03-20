import pino from "pino";

const logger = pino.default();

if (process.env.DEBUG) logger.level = "trace";

export default logger;
