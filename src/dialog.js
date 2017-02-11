import {isString, isFunction, isObject} from 'util';
import assert from 'assert';

import {any} from './constants';
export default class Dialog {

  constructor({name, description}) {
    this.name = name;
    this.description = description;
    assert(typeof(name)=='string', 'Dialog name must be a string');

    this._nlpModelName = null;
    this.startHandler = null;
    this.inputHandlers = [];
    this.resultHandlers = {};
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

  //
  // Input Handlers
  //

  /**
   * onText - handles an arbitrary text input (in future, regexes)
   *
   * @param  {type} text description
   * @param  {type} fn   description
   */
  onText(text, fn) {
    return this.onInput({text: text}, fn, (n)=>n.data.text);
  }

  /**
   * onPostback - handles a postback
   *
   * @param  {string}   payload description
   * @param  {Function} fn      description
   */
  onPostback(payload, fn) {
    return this.onInput({payload: payload}, fn);
  }

  /**
   * onIntent - description
   *
   * @param  {string} intent
   * @param  {function} fn  fn(session, entities, message) => boolean (true if pattern was handled
   */
  onIntent(intent, fn) {
    return this.onInput({intent: intent}, fn, (n)=>n.data.entities);
  }

  /**
   * onRecovery - a function which is run when no input handlers exist
   *
   * @param  {type} fn description
   * @return {type}    description
   */
  onRecovery(fn) {
    return this.onInput({recovery: true}, fn, (n)=>n);
  }

  /**
   * onInput - low level function for matching arbitrary patterns in the data
   *            component of a frame_input notification
   *
   * @param  {Object}   pattern       description
   * @param  {Function} fn            description
   * @param  {Function} dataExtractor description
   */
  onInput(pattern, fn, dataExtractor) {
    if (isFunction(pattern)) {
      dataExtractor = fn;
      fn = pattern;
      pattern = {};
    }

    if (!dataExtractor) {
      dataExtractor = (d)=>d;
    }

    assert(isObject(pattern), 'pattern must be an object or null');
    assert(isFunction(fn), 'handler must be a function');
    assert(isFunction(dataExtractor), 'dataExtractor must be a function');

    this.inputHandlers.push([pattern, fn, dataExtractor]);
  }

  /**
   * getInputHandler
   *
   * @param  {type} inputData description
   * @return {Array} [handler, extractor] two functions
   */
  getInputHandler(inputData) {
    for (let [hpattern, hfn, hextractor]  of this.inputHandlers) {
      if (Dialog.matchesPattern(hpattern, inputData)) {
        return [hfn, hextractor];
      }
    }
  }

  /**
   * matchesPattern - true only if all pattern key/value pairs are found in data
   *
   * @param  {Object} pattern description
   * @param  {Object} data    description
   * @return {boolean}         description
   */
  static matchesPattern(pattern, data) {
    for (let k in pattern) {
      let pval = pattern[k];
      if (isFunction(pval)) {
        if (!pval(data[k])) {
          return false;
        }
      } else {
        if (pattern[k]!=data[k]) {
          return false;
        }
      }
    }
    return true;
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
    tag = tag || "<{null}>";
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
  onUnhandled(fn) {
    assert(isFunction(fn), 'handler must be a function');
  }

  toObject() {
    var resultHandlerValues = Object.keys(this.resultHandlers).map(function (k) {
      var [dialog, tag] = parseResultHandlerKey(k);
      return {dialog: dialog, tag: tag};
    });

    function extractPattern(h) {
      return isFunction(h[0]) ? any : h[0];
    }

    var inputHandlerPatterns = this.inputHandlers.map(extractPattern);

    var result = {
      name: this.name,
      startHandler: !!this.startHandler,
      resultHandlers: resultHandlerValues || [],
      inputHandlers: inputHandlerPatterns || []
    };
    if (this.nlpModelName) {
      result.nlpModelName = this.nlpModelName;
    }
    return result;
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
