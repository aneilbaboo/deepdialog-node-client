'use strict';

import winston from 'winston';

winston.level = process.env.LOGGER_LEVEL;
winston.remove(winston.transports.Console);
winston.add(winston.transports.Console, {
  colorize: true,
  prettyPrint: true
});
module.exports = winston;
 
