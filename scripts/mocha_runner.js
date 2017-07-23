require('babel-core/register');
require('babel-polyfill');
const log = require('../src/log');
const dotenv = require('dotenv');
dotenv.config({silent:true});
log.level = process.env.LOGGER_LEVEL || log.level;

process.on('unhandledRejection', function (error) {
  log.error('Unhandled Promise Rejection:');
  log.error(error && error.stack || error);
});
