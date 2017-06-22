require('babel-core/register');
require('babel-polyfill');
const log = require('../src/log');
const dotEnv = require('dotEnv');
try {
  dotEnv.config();
} catch (e) {
  log.warn("Unable to load .env file");
}

log.level = process.env.LOGGER_LEVEL;

process.on('unhandledRejection', function (error) {
  log.error('Unhandled Promise Rejection:');
  log.error(error && error.stack || error);
});
