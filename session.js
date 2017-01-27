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

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var UpdateOp = 'mutation {\n  sessionUpdate(id: $id, locals: $locals, globals: $globals) { }\n}';

var StartFrameOp = '($id: String, $dialog: String, $tag: String, $locals: Object, $globals: Object) {\n  sessionStartFrame(id: $id, dialog: $dialog, tag: $tag, locals: $locals, globals: $globals) {\n    id\n    globals\n    stack(limit: 1) { id locals }\n  } \n}';

var EndFrameOp = '($id: String, $result: Object) {\n  sessionEndFrame(id: $id, result: $result) {\n    id\n    stack(limit: 1) { id dialog tag locals }\n  }\n}';

var SendResponseOp = '($id: String, text: String) {\n  sessionSendResponse(id: $id, text: $text)\n}';

var Session = function () {
  function Session(client, _ref) {
    var id = _ref.id,
        globals = _ref.globals,
        currentFrame = _ref.currentFrame;
    (0, _classCallCheck3.default)(this, Session);

    this.id = id;
    this.currentFrame = currentFrame;
    this.globals = globals;
    this.locked = false;
  }

  (0, _createClass3.default)(Session, [{
    key: 'get',
    value: function get(variable) {
      return this.locals[variable] || this.globals[variable];
    }
  }, {
    key: 'set',
    value: function set(variable, value) {
      if (variable[0] == variable[0].toUpperCase()) {
        this.globals[variable] = value;
      } else {
        this.locals[variable] = value;
      }
    }
  }, {
    key: 'start',
    value: function () {
      var _ref2 = (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee(_ref3) {
        var dialog = _ref3.dialog,
            tag = _ref3.tag,
            locals = _ref3.locals;
        return _regenerator2.default.wrap(function _callee$(_context) {
          while (1) {
            switch (_context.prev = _context.next) {
              case 0:
                this.checkLock();

                _context.next = 3;
                return this.client.mutate(StartFrameOp, {
                  sessionId: this.id,
                  parentFrameId: this.frameId,
                  dialog: dialog,
                  tag: tag,
                  locals: locals,
                  globals: this.globals
                });

              case 3:

                this.locked = true;

              case 4:
              case 'end':
                return _context.stop();
            }
          }
        }, _callee, this);
      }));

      function start(_x) {
        return _ref2.apply(this, arguments);
      }

      return start;
    }()
  }, {
    key: 'finish',
    value: function () {
      var _ref4 = (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee2(result) {
        return _regenerator2.default.wrap(function _callee2$(_context2) {
          while (1) {
            switch (_context2.prev = _context2.next) {
              case 0:
                this.checkLock();

                _context2.next = 3;
                return this.client.mutate(EndFrameOp, {
                  sessionId: this.id,
                  frameId: this.frameId,
                  result: result,
                  suppressNotification: true
                });

              case 3:

                this.locked = true;

              case 4:
              case 'end':
                return _context2.stop();
            }
          }
        }, _callee2, this);
      }));

      function finish(_x2) {
        return _ref4.apply(this, arguments);
      }

      return finish;
    }()
  }, {
    key: 'save',
    value: function () {
      var _ref5 = (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee3() {
        return _regenerator2.default.wrap(function _callee3$(_context3) {
          while (1) {
            switch (_context3.prev = _context3.next) {
              case 0:
                this.checkLock();
                _context3.next = 3;
                return this.client.send(UpdateOp, {
                  sessionId: this.id,
                  globals: this.globals,
                  locals: this.locals
                });

              case 3:
              case 'end':
                return _context3.stop();
            }
          }
        }, _callee3, this);
      }));

      function save() {
        return _ref5.apply(this, arguments);
      }

      return save;
    }()
  }, {
    key: 'respond',
    value: function () {
      var _ref6 = (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee4(_ref7) {
        var text = _ref7.text;
        return _regenerator2.default.wrap(function _callee4$(_context4) {
          while (1) {
            switch (_context4.prev = _context4.next) {
              case 0:
                this.checkLock();
                _context4.next = 3;
                return this.client.send(SendResponseOp, {
                  sessionId: this.id,
                  text: text
                });

              case 3:
              case 'end':
                return _context4.stop();
            }
          }
        }, _callee4, this);
      }));

      function respond(_x3) {
        return _ref6.apply(this, arguments);
      }

      return respond;
    }()
  }, {
    key: 'checkLock',
    value: function checkLock() {
      if (this.locked) {
        throw new Error('Session locked: no operations allowed after start() or finish()');
      }
    }
  }, {
    key: 'locals',
    get: function get() {
      return this.currentFrame.locals;
    }
  }, {
    key: 'dialog',
    get: function get() {
      return this.currentFrame.dialog;
    }
  }, {
    key: 'tag',
    get: function get() {
      return this.currentFrame.tag;
    }
  }]);
  return Session;
}();

exports.default = Session;