'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _values = require('babel-runtime/core-js/object/values');

var _values2 = _interopRequireDefault(_values);

var _regenerator = require('babel-runtime/regenerator');

var _regenerator2 = _interopRequireDefault(_regenerator);

var _asyncToGenerator2 = require('babel-runtime/helpers/asyncToGenerator');

var _asyncToGenerator3 = _interopRequireDefault(_asyncToGenerator2);

var _getIterator2 = require('babel-runtime/core-js/get-iterator');

var _getIterator3 = _interopRequireDefault(_getIterator2);

var _classCallCheck2 = require('babel-runtime/helpers/classCallCheck');

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _createClass2 = require('babel-runtime/helpers/createClass');

var _createClass3 = _interopRequireDefault(_createClass2);

var _client = require('./client');

var _client2 = _interopRequireDefault(_client);

var _appserver = require('./appserver');

var _appserver2 = _interopRequireDefault(_appserver);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var AppUpdateOp = '($dialogs: [Dialog], $nlpModels: [nlpModels], $mainDialog: String, $webhook: String) {\n  appUpdate(dialogs: $dialogs, nlpModels: $nlpModels, mainDialog: $mainDialog) {\n    id\n    mainDialog\n    dialogs\n    nlpModels\n    webhook\n  }\n}';

var App = function () {
  function App(_ref) {
    var appId = _ref.appId,
        appSecret = _ref.appSecret;
    (0, _classCallCheck3.default)(this, App);

    this._client = new _client2.default(appId, appSecret);
    this.mainDialog = null;
    this._dialogs = {};
    this._nlpModels = {};
    this._eventHandlers = {};
    this.webhook = null;
  }

  (0, _createClass3.default)(App, [{
    key: 'getDialog',
    value: function getDialog(name) {
      return this._dialogs[name];
    }
  }, {
    key: 'getNLPModel',
    value: function getNLPModel(name) {
      return this._nlpModels[name];
    }
  }, {
    key: 'getEventHandler',
    value: function getEventHandler(event) {
      return this._eventHandlers[event];
    }
  }, {
    key: 'addDialogs',
    value: function addDialogs() {
      for (var _len = arguments.length, dialogs = Array(_len), _key = 0; _key < _len; _key++) {
        dialogs[_key] = arguments[_key];
      }

      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;
      var _iteratorError = undefined;

      try {
        for (var _iterator = (0, _getIterator3.default)(dialogs), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
          var d = _step.value;

          if (d instanceof Array) {
            this.addDialogs(d);
          } else {
            this._dialogs[d.name] = d;
          }
        }
      } catch (err) {
        _didIteratorError = true;
        _iteratorError = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion && _iterator.return) {
            _iterator.return();
          }
        } finally {
          if (_didIteratorError) {
            throw _iteratorError;
          }
        }
      }
    }
  }, {
    key: 'addNLPModels',
    value: function addNLPModels() {
      for (var _len2 = arguments.length, nlpModels = Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
        nlpModels[_key2] = arguments[_key2];
      }

      var _iteratorNormalCompletion2 = true;
      var _didIteratorError2 = false;
      var _iteratorError2 = undefined;

      try {
        for (var _iterator2 = (0, _getIterator3.default)(nlpModels), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
          var n = _step2.value;

          if (n instanceof Array) {
            this.addNLPModels(n);
          } else {
            this._nlpModels[n.name] = n;
          }
        }
      } catch (err) {
        _didIteratorError2 = true;
        _iteratorError2 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion2 && _iterator2.return) {
            _iterator2.return();
          }
        } finally {
          if (_didIteratorError2) {
            throw _iteratorError2;
          }
        }
      }
    }
  }, {
    key: 'handleEvent',
    value: function () {
      var _ref2 = (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee(notification) {
        return _regenerator2.default.wrap(function _callee$(_context) {
          while (1) {
            switch (_context.prev = _context.next) {
              case 0:
                _context.next = 2;
                return this.eventHandlers[notification.event](notification);

              case 2:
                return _context.abrupt('return', _context.sent);

              case 3:
              case 'end':
                return _context.stop();
            }
          }
        }, _callee, this);
      }));

      function handleEvent(_x) {
        return _ref2.apply(this, arguments);
      }

      return handleEvent;
    }()
  }, {
    key: 'onEvent',
    value: function onEvent(event, fn) {
      this.eventHandlers[event] = fn;
    }
  }, {
    key: 'save',
    value: function () {
      var _ref3 = (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee2() {
        return _regenerator2.default.wrap(function _callee2$(_context2) {
          while (1) {
            switch (_context2.prev = _context2.next) {
              case 0:
                _context2.next = 2;
                return this.client.mutate(AppUpdateOp, {
                  dialogs: this.dialogs,
                  nlpModels: this.nlpModels,
                  mainDialog: this.mainDialog,
                  webhook: this.webhook
                });

              case 2:
              case 'end':
                return _context2.stop();
            }
          }
        }, _callee2, this);
      }));

      function save() {
        return _ref3.apply(this, arguments);
      }

      return save;
    }()
  }, {
    key: 'server',
    value: function server() {
      return new _appserver2.default(this);
    }
  }, {
    key: 'client',
    get: function get() {
      return this._client;
    }
  }, {
    key: 'dialogs',
    get: function get() {
      return (0, _values2.default)(this._dialogs);
    }
  }, {
    key: 'nlpModels',
    get: function get() {
      return (0, _values2.default)(this._nlpModelsl);
    }
  }]);
  return App;
}();

exports.default = App;