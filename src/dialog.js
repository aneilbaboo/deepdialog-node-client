import {isString, isFunction} from 'util';
import assert from 'assert';

export default class Dialog {

  constructor(name) {
    this.name = name;
    assert(typeof(name)=='string', 'Dialog name must be a string');
    
    this._nlpModelName = null;
    this.startHandler = null;
    this.intentHandlers = {};
    this.resultHandlers = {};
    this.defaultHandler = null;
  }

  get nlpModelName() { return this._nlpModelName; }
  set nlpModelName(value) { this._nlpModelName = value; }
  /**
   * onStart - description
   *
   * @param  {function} fn fn(session)
   */
  onStart(fn) {
    assert(isFunction(fn), 'handler must be a function');

    this.startHandler = fn;
  }

  /**
   * onIntent - description
   *
   * @param  {string} intent
   * @param  {function} fn  fn(session, entities, message) => boolean (true if pattern was handled
   */
  onIntent(intent, fn) {
    assert(isString(intent), 'intent must be a string');
    assert(isFunction(fn), 'handler must be a function');

    this.intentHandlers[intent] = fn;
  }

  getIntentHandler(pattern) {
    return this.intentHandlers[pattern];
  }

  /**
   * onResult - description
   *
   * @param  {string} dialog description
   * @param  {string} tag
   * @param  {type} fn      fn(session, result)
   */
  onResult(dialog, tag, fn) {
    if (fn===undefined) {
      fn = tag;
      tag = null;
    }
    tag = tag || "#NULL#";
    assert(isString(dialog), 'dialog must be a string');
    assert(isString(tag), 'tag must be a string');
    assert(isFunction(fn), 'handler must be a function');

    this.resultHandlers[resultHandlerKey(dialog, tag)] = fn;
  }

  getResultHandler(dialog, tag) {
    return this.resultHandlers[resultHandlerKey(dialog, tag)];
  }

  /**
   * onDefault - description
   *
   * @param  {type} fn description
   * @return {type}    description
   */
  onDefault(fn) {
    assert(isFunction(fn), 'handler must be a function');

    this.defaultHandler = fn;
  }

  toObject() {
    var resultHandlerValues = Object.keys(this.resultHandlers).map(function (k) {
      var [dialog, tag] = parseResultHandlerKey(k);
      return {dialog: dialog, tag: tag};
    });

    var nlpInputHandlerValues = Object.keys(this.intentHandlers).map(i=>({intent: i}));

    return {
      name: this.name,
      nlpModelName: this.nlpModelName,
      startHandler: !!this.startHandler,
      resultHandlers: resultHandlerValues,
      nlpInputHandlers: nlpInputHandlerValues,
      defaultHandler: !!this.defaultHandler
    };
  }
}

function resultHandlerKey(dialog, tag) {
  if (tag) {
    return `${dialog}|${tag}`;
  } else {
    return dialog;
  }
}

function parseResultHandlerKey(key) {
  return key.split('|');
}

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
