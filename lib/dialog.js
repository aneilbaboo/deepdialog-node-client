export default class Dialog {

  constructor(name, nlpModelName) {
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
    this.intentHandlers.push(intent, fn);
  }

  /**
   * onResult - description
   *
   * @param  {string} dialog description
   * @param  {string} tag
   * @param  {type} fn      fn(session, result)
   */
  onResult(dialog, tag, fn) {
    this.resultHandlers.push([dialog, tag], fn);
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
