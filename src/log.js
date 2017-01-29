'use strict';
import dotEnv from 'dotEnv';
import winston from 'winston';

dotEnv.load();

winston.level = process.env.LOGGER_LEVEL;
winston.remove(winston.transports.Console);
winston.add(winston.transports.Console, {
  colorize: true,
  prettyPrint: true
});
module.exports = winston;
