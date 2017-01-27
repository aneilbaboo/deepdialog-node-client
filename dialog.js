"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _classCallCheck2 = require("babel-runtime/helpers/classCallCheck");

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _createClass2 = require("babel-runtime/helpers/createClass");

var _createClass3 = _interopRequireDefault(_createClass2);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var Dialog = function () {
  function Dialog(name, nlpModelName) {
    (0, _classCallCheck3.default)(this, Dialog);

    this.name = name;
    this.nlpModelName = nlpModelName;
    this.startHandler = null;
    this.intentHandlers = [];
    this.resultHandlers = [];
    this.defaultHandler = [];
  }

  /**
   * onStart - description
   *
   * @param  {function} fn fn(session)
   */


  (0, _createClass3.default)(Dialog, [{
    key: "onStart",
    value: function onStart(fn) {
      this.startHandler = fn;
    }

    /**
     * onIntent - description
     *
     * @param  {string} intent
     * @param  {function} fn  fn(session, entities, message) => boolean (true if pattern was handled
     */

  }, {
    key: "onIntent",
    value: function onIntent(intent, fn) {
      this.intentHandlers.push(intent, fn);
    }

    /**
     * onResult - description
     *
     * @param  {string} dialog description
     * @param  {string} tag
     * @param  {type} fn      fn(session, result)
     */

  }, {
    key: "onResult",
    value: function onResult(dialog, tag, fn) {
      this.resultHandlers.push([dialog, tag], fn);
    }

    /**
     * onDefault - description
     *
     * @param  {type} fn description
     * @return {type}    description
     */

  }, {
    key: "onDefault",
    value: function onDefault(fn) {
      this.defaultHandler.push(fn);
    }
  }]);
  return Dialog;
}();

// import
// export default const CreditCardDialog = new Dialog({
//   name: "CreditCardDialog",
//   description: "Asks user for credit card information",
//   documentation: ""
// });
//
// PromptDialog.onMessage({intent: 'hello'}, function(session, entities) {
//   if (session.username) {
//     session.respond(`Hi, there, ${session.username} `);
//   } else {
//     session.response(`Hi there!`);
//   }
//
//   session.start({dialog: CreditCardDialog});
// });
//
// PromptDialog.onDefault(async function(session, message, nlpResultsList, previousFrames) {
//   // do something;
// });


exports.default = Dialog;