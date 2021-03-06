import {isString, isFunction, isObject} from 'util';
import assert from 'assert';

import {anyPattern} from './constants';

export default class Dialog {

  constructor({name, description, nlpModelName}) {
    this.name = name;
    this.description = description;
    assert(typeof(name)=='string', 'Dialog name must be a string');

    this._nlpModelName = nlpModelName;
    this.startHandler = null;
    this.inputHandlers = [];
    this.resultHandlers = {};
    this.postbackHandlers = {};
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
   * @param  {type} fn   function(session, text)
   */
  onText(text, fn) {
    return this.onInput({text: text}, fn, (n)=>n.data.text);
  }

  /**
   * onPayload - handles a developer-provided payload from postback or quickreply buttons
   *
   * @param  {string}   payload description
   * @param  {Function} fn      description
   */
  onPayload(payload, fn) {
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
    return this.onInput({recovery: true}, fn, (n)=>n.message);
  }

  /**
   * This is called when a frame_input notification is received
   * @callback Dialog~inputHandler
   * @param  {Session} session
   * @return {Object} input notification body
   */

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

    if (!isObject(pattern)) {
      throw new Error(`pattern must be an object or null, but got ${pattern}`);
    }
    if (!isFunction(fn)) {
      throw new Error(`handler must be a function, but got ${fn}`);
    }
    if (!isFunction(dataExtractor)) {
      throw new Error(`dataExtractor must be a function, but got ${dataExtractor}`);
    }

    this.inputHandlers.push([pattern, fn, dataExtractor]);
  }

  /**
   * This is called when a frame_postback notification is received
   * @callback Dialog~postbackHandler
   * @param  {Session} session
   * @param  {Object} args argument provided to the postback
   * @param {Object} notification postback notification body containing session, message, postback keys
   */

  /**
   * onPostback - Description
   *
   * @param {string} name Name of the postback method
   * @param {Dialog~postbackHandler} fn   Description
   *
   * @return {type} Description
   */
  onPostback(name, fn) {
    this.postbackHandlers[name] = fn;
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
   * getPostbackHandler - Description
   *
   * @param {type} method Description
   *
   * @return {Dialog~postbackHandler} Description
   */
  getPostbackHandler(method) {
    return this.postbackHandlers[method];
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
      let dval = data[k];
      if (isFunction(pval)) {
        if (!pval(dval)) {
          return false;
        }
      } else {
        if (pval!=anyPattern && pval!=dval) {
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
    assert(isString(dialog), 'dialog must be a string');
    assert(!tag || isString(tag), 'tag must be a string');
    assert(isFunction(fn), 'handler must be a function');

    this.resultHandlers[resultHandlerKey(dialog, tag)] = fn;
  }

  getResultHandler(dialog, tag) {
    var result = this.resultHandlers[resultHandlerKey(dialog, tag)];
    if (result) {
      return result;
    } else if (!tag || tag=='' || tag==anyPattern) {
      // try default handler
      return this.resultHandlers[resultHandlerKey(dialog)];
    } else {
      return this.resultHandlers[resultHandlerKey(anyPattern, tag)];
    }
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

    var postbackHandlers = Object.keys(this.postbackHandlers);

    function extractPattern(h) {
      return isFunction(h[0]) ? anyPattern : h[0];
    }

    var inputHandlerPatterns = this.inputHandlers.map(extractPattern);

    var result = {
      name: this.name,
      startHandler: !!this.startHandler,
      resultHandlers: resultHandlerValues || [],
      inputHandlers: inputHandlerPatterns || [],
      postbackHandlers: postbackHandlers
    };
    if (this.nlpModelName) {
      result.nlpModelName = this.nlpModelName;
    }
    return result;
  }

}

function resultHandlerKey(dialog, tag) {
  if (tag && tag!='') {
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
