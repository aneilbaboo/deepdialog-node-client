//import log from './log';

export class Dialog {

  constructor(name) {
    this.name = name;
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
    this.startHandler = fn;
  }

  /**
   * onIntent - description
   *
   * @param  {string} intent
   * @param  {function} fn  fn(session, entities, message) => boolean (true if pattern was handled
   */
  onIntent(intent, fn) {
    this.intentHandlers[intent] = fn;
  }

  /**
   * onResult - description
   *
   * @param  {string} dialog description
   * @param  {string} tag
   * @param  {type} fn      fn(session, result)
   */
  onResult(dialog, tag, fn) {
    this.resultHandlers[[dialog, tag]] = fn;
  }

  /**
   * onDefault - description
   *
   * @param  {type} fn description
   * @return {type}    description
   */
  onDefault(fn) {
    this.defaultHandler.push(fn);
  }

  toObject() {
    var patterns = [
      ...Object.keys(this.intentHandlers).map(i=>({intent: i})),
      ...Object.keys(this.resultHandlers).map(r=>({result: r})),
    ];

    return {
      name: this.name,
      nlpModelName: this.nlpModelName,
      //startHandler: this.startHandler,
      patterns: patterns
      //defaultHandler: this.defaultHandler
    };
  }
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
