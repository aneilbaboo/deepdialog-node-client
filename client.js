'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _regenerator = require('babel-runtime/regenerator');

var _regenerator2 = _interopRequireDefault(_regenerator);

var _asyncToGenerator2 = require('babel-runtime/helpers/asyncToGenerator');

var _asyncToGenerator3 = _interopRequireDefault(_asyncToGenerator2);

var _classCallCheck2 = require('babel-runtime/helpers/classCallCheck');

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _createClass2 = require('babel-runtime/helpers/createClass');

var _createClass3 = _interopRequireDefault(_createClass2);

var _lokka = require('lokka');

var _lokkaTransportHttp = require('lokka-transport-http');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var GraphQLAPIURL = 'https://apistaging.deepdialog.ai/graphql';

var Client = function () {
  function Client(appId, appSecret) {
    (0, _classCallCheck3.default)(this, Client);

    this.appId = appId;
    this.appSecret = appSecret;
    var headers = {
      'Authorization': 'Bearer ' + appSecret
    };

    this.client = new _lokka.Lokka({
      transport: new _lokkaTransportHttp.Transport(GraphQLAPIURL, headers)
    });
  }

  (0, _createClass3.default)(Client, [{
    key: 'query',
    value: function () {
      var _ref = (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee(op) {
        return _regenerator2.default.wrap(function _callee$(_context) {
          while (1) {
            switch (_context.prev = _context.next) {
              case 0:
                _context.next = 2;
                return this.client.query(op);

              case 2:
                return _context.abrupt('return', _context.sent);

              case 3:
              case 'end':
                return _context.stop();
            }
          }
        }, _callee, this);
      }));

      function query(_x) {
        return _ref.apply(this, arguments);
      }

      return query;
    }()
  }, {
    key: 'mutate',
    value: function () {
      var _ref2 = (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee2(op, vars) {
        return _regenerator2.default.wrap(function _callee2$(_context2) {
          while (1) {
            switch (_context2.prev = _context2.next) {
              case 0:
                _context2.next = 2;
                return this.client.mutate(op, vars);

              case 2:
                return _context2.abrupt('return', _context2.sent);

              case 3:
              case 'end':
                return _context2.stop();
            }
          }
        }, _callee2, this);
      }));

      function mutate(_x2, _x3) {
        return _ref2.apply(this, arguments);
      }

      return mutate;
    }()
  }]);
  return Client;
}();

exports.default = Client;