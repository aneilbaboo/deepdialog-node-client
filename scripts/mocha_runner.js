require('babel-core/register');
require('babel-polyfill');
const log = require('../lib/log');

process.on('unhandledRejection', function (error) {
  log.error('Unhandled Promise Rejection:');
  log.error(error && error.stack || error);
});
