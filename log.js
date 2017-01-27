'use strict';

var _winston = require('winston');

var _winston2 = _interopRequireDefault(_winston);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

_winston2.default.level = process.env.LOGGER_LEVEL;
_winston2.default.remove(_winston2.default.transports.Console);
_winston2.default.add(_winston2.default.transports.Console, {
  colorize: true,
  prettyPrint: true
});
module.exports = _winston2.default;