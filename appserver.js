'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _promise = require('babel-runtime/core-js/promise');

var _promise2 = _interopRequireDefault(_promise);

var _regenerator = require('babel-runtime/regenerator');

var _regenerator2 = _interopRequireDefault(_regenerator);

var _asyncToGenerator2 = require('babel-runtime/helpers/asyncToGenerator');

var _asyncToGenerator3 = _interopRequireDefault(_asyncToGenerator2);

var _classCallCheck2 = require('babel-runtime/helpers/classCallCheck');

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _createClass2 = require('babel-runtime/helpers/createClass');

var _createClass3 = _interopRequireDefault(_createClass2);

var _express = require('express');

var _express2 = _interopRequireDefault(_express);

var _bodyParser = require('body-parser');

var _bodyParser2 = _interopRequireDefault(_bodyParser);

var _compression = require('compression');

var _compression2 = _interopRequireDefault(_compression);

var _session = require('./session');

var _session2 = _interopRequireDefault(_session);

var _log = require('./log');

var _log2 = _interopRequireDefault(_log);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

//import promiseRouter from 'express-promise-router';
var AppServer = function () {
  function AppServer(app) {
    (0, _classCallCheck3.default)(this, AppServer);

    this.app = app;
  }

  (0, _createClass3.default)(AppServer, [{
    key: 'dialogFromFrame',
    value: function dialogFromFrame(frame) {
      return this.app.getDialog(frame.dialog);
    }
  }, {
    key: 'sessionFromData',
    value: function sessionFromData(data) {
      var frame = data.stack[0];
      return new _session2.default(this, {
        id: data.id,
        globals: data.globals,
        currentFrame: frame
      });
    }
  }, {
    key: 'handleNotification',
    value: function () {
      var _ref = (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee(notification) {
        var event, session, dialog, completedFrame, resultHandler, intent, entities, intentHandler, eventHandler;
        return _regenerator2.default.wrap(function _callee$(_context) {
          while (1) {
            switch (_context.prev = _context.next) {
              case 0:
                event = notification.event;
                _context.t0 = event;
                _context.next = _context.t0 === 'frame_start' ? 4 : _context.t0 === 'frame_end' ? 13 : _context.t0 === 'frame_message' ? 24 : _context.t0 === 'frame_default' ? 36 : 42;
                break;

              case 4:
                session = this.sessionFromData(notification.session);
                dialog = this.dialogFromFrame(this.app, session);

                if (!dialog.startHandler) {
                  _context.next = 11;
                  break;
                }

                _context.next = 9;
                return dialog.startHandler(session);

              case 9:
                _context.next = 12;
                break;

              case 11:
                _log2.default.warn('Couldn\'t find start handler for %s', dialog.name);

              case 12:
                return _context.abrupt('break', 42);

              case 13:
                session = this.sessionFromData(notification.session);
                dialog = this.dialogFromFrame(this.app, session);
                completedFrame = notification.session.completedFrame[0];
                resultHandler = dialog.resultHandlers[(completedFrame.dialog, completedFrame.tag)];

                if (!resultHandler) {
                  _context.next = 22;
                  break;
                }

                _context.next = 20;
                return resultHandler(completedFrame.result);

              case 20:
                _context.next = 23;
                break;

              case 22:
                _log2.default.error('Couldn\'t find result handler for %s.%s', completedFrame.dialog, completedFrame.tag);

              case 23:
                return _context.abrupt('break', 42);

              case 24:
                session = this.sessionFromData(notification.session);
                dialog = this.dialogFromFrame(this.app, session);
                intent = notification.match.intent;
                entities = notification.match.entities;
                intentHandler = dialog.intentHandlers[intent];

                if (!intentHandler) {
                  _context.next = 34;
                  break;
                }

                _context.next = 32;
                return intentHandler(session, entities);

              case 32:
                _context.next = 35;
                break;

              case 34:
                _log2.default.warn('Dialog %s received intent %s, but no handler found', dialog, intent);

              case 35:
                return _context.abrupt('break', 42);

              case 36:
                session = this.sessionFromData(notification.session);
                dialog = this.dialogFromFrame(this.app, session);

                if (!dialog.defaultHandler) {
                  _context.next = 41;
                  break;
                }

                _context.next = 41;
                return dialog.defaultHandler(session, notification);

              case 41:
                return _context.abrupt('break', 42);

              case 42:
                eventHandler = this.app.eventHandlers[event] || this.app.eventHandlers.any;

                if (!eventHandler) {
                  _context.next = 46;
                  break;
                }

                _context.next = 46;
                return eventHandler(event);

              case 46:
              case 'end':
                return _context.stop();
            }
          }
        }, _callee, this);
      }));

      function handleNotification(_x) {
        return _ref.apply(this, arguments);
      }

      return handleNotification;
    }()
  }, {
    key: 'makeServer',
    value: function makeServer() {

      var server = (0, _express2.default)();
      server.use(_bodyParser2.default.urlencoded({ extended: true, inflate: true }));
      server.use(_bodyParser2.default.json(true));
      server.use((0, _compression2.default)());

      var appServer = this;

      server.use('/', function () {
        var _ref2 = (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee2(req, res) {
          var notifications;
          return _regenerator2.default.wrap(function _callee2$(_context2) {
            while (1) {
              switch (_context2.prev = _context2.next) {
                case 0:
                  notifications = req.body.notifications;
                  _context2.next = 3;
                  return _promise2.default.all(notifications.map(function (n) {
                    return appServer.handleNotification(appServer.app, n);
                  }));

                case 3:
                  res.status(200);

                case 4:
                case 'end':
                  return _context2.stop();
              }
            }
          }, _callee2, this);
        }));

        return function (_x2, _x3) {
          return _ref2.apply(this, arguments);
        };
      }());

      return server;
    }
  }, {
    key: 'start',
    value: function () {
      var _ref3 = (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee3(port) {
        var result, server;
        return _regenerator2.default.wrap(function _callee3$(_context3) {
          while (1) {
            switch (_context3.prev = _context3.next) {
              case 0:
                _context3.next = 2;
                return this.app.sync();

              case 2:
                result = _context3.sent;

                if (!result.errors) {
                  _context3.next = 5;
                  break;
                }

                throw result.errors;

              case 5:
                server = this.makeServer();


                server.listen(port, function () {
                  _log2.default.info('DeepDialog App server listening on port %s', port);
                });

              case 7:
              case 'end':
                return _context3.stop();
            }
          }
        }, _callee3, this);
      }));

      function start(_x4) {
        return _ref3.apply(this, arguments);
      }

      return start;
    }()
  }]);
  return AppServer;
}();

exports.default = AppServer;