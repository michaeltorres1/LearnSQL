/**
 * winston.js - LearnSQL
 *
 * Kevin Kelly
 * Web Applications and Databases for Education (WADE)
 *
 * This file sets up the logging functionality using the winston module.
 *  https://www.npmjs.com/package/winston
 */

const { createLogger, format, transports } = require('winston');

const {
  combine, timestamp, printf,
} = format;

const myFormat = printf(info => `${info.timestamp} ${info.level}: ${info.message}`);

const logger = createLogger({
  level: 'info',
  format: combine(
    timestamp(),
    myFormat,
  ),
  transports: [
    //
    // - Write to all logs with level `info` and below to `combined.log`
    // - Write all logs error (and below) to `error.log`.
    //
    new transports.File({ filename: 'server/logs/error.log', level: 'error' }),
    new transports.File({ filename: 'server/logs/combined.log' }),
  ],
});

module.exports = logger;
module.exports.stream = {
  write(message) {
    logger.info(message);
  },
};
