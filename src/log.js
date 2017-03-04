'use strict';
import winston from 'winston';

winston.level = 'info';
winston.remove(winston.transports.Console);
winston.add(winston.transports.Console, {
  colorize: true,
  prettyPrint: true,
  label: "deepdialog"
});
module.exports = winston;
