"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _classCallCheck2 = require("babel-runtime/helpers/classCallCheck");

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var NLPModel = function NLPModel(_ref) {
  var name = _ref.name,
      provider = _ref.provider,
      accessId = _ref.accessId,
      accessToken = _ref.accessToken;
  (0, _classCallCheck3.default)(this, NLPModel);

  this.name = name;
  this.provider = provider;
  this.accessId = accessId;
  this.accessToken = accessToken;
};

exports.default = NLPModel;