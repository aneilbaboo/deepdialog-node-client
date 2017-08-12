import jwt from 'jwt-simple';

import App from './app';
import {isString, isObject} from 'util';
import assert from 'assert';
import log from './log';

export default class Session {
  constructor({app, id, globals, username, email, displayName, givenName, surname, accessToken, currentFrame, volatiles}) {
    this._app = app;
    this._updateValues({
      id, globals, currentFrame,
      username, displayName, email, givenName, surname,
      accessToken:accessToken || app.appSecret,
      volatiles});
  }

  _updateValues({id, globals, accessToken, currentFrame, username, email, displayName, givenName, surname, volatiles}) {
    var {id:frameId, dialog, locals, tag, dialogApp} = currentFrame || {};
    this._id = id;
    this._frameId = frameId;
    this._locals = locals || {};
    this._dialogName = dialog;
    this._tag = tag;
    this._username = username;
    this._displayName = displayName;
    this._givenName = givenName;
    this._surname = surname;
    this._email = email;
    this._globals = globals || {};
    this._volatiles = volatiles || {};
    if (dialogApp) {
      this._dialogAppId = dialogApp.id;
      this._dialogAppName = dialogApp.name;
    }
    this.locked = false;
    this._accessToken = accessToken;
    this._client = accessToken ? this.app.client.clientWithAccessToken(accessToken) : this.app.client;
  }

  validate() {
    assert(this.app.constructor==App, 'app must be an App instance');
    assert(this.id, 'invalid session id (.id)');
    assert(this.frameId, 'invalid stack frame id (.frameId)');
    // this check doesn't work
    // assert(this.dialog, 'invalid dialog (.dialog)');
    assert(this.globals, 'invalid globals (.globals)');
    assert(this.locals, 'invalid locals (.locals)');
  }

  get app() { return this._app; }
  get client() { return this._client; }
  get id() { return this._id; }
  get globals() { return this._globals; }
  get volatiles() { return this._volatiles; }
  get frameId() { return this._frameId; }
  get locals() { return this._locals; }
  get dialogName() { return this._dialogName; }
  get dialog() { return this.app.getDialog(this.dialogName); }
  get dialogAppId() { return this._dialogAppId; }
  get dialogAppName() { return this._dialogAppName; }
  get tag() { return this._tag; }
  get accessToken() { return this._accessToken; }
  get username() { return this._username; }
  get displayName() { return this._displayName; }
  get givenName() { return this._givenName; }
  get surname() { return this._surname; }
  get email() { return this._email; }

  /**
   * get - gets a global or local variable
   *       global variables begin with uppercase
   *
   * @param  {type}     key description
   * @return {Object}
   */
  get(key) {
    if (this.volatiles.hasOwnProperty(key)) {
      return this.volatiles[key];
    } else if (this.locals.hasOwnProperty(key)) {
      return this.locals[key];
    } else {
      return this.globals[key];
    }
  }

  /**
   * set - set a variable or variables
   *
   * e.g., session.set('a', 1);
   *       session.set('b', 2)
   *       session.set({a:1, b:2}); // equivalent to above to lines
   *
   * @param  {stringOrObject} variableOrHash description
   * @param  {value}          value    description
   */
  set(variableOrHash, value) {
    if (variableOrHash instanceof Object) {
      let varNames = variableOrHash;
      for (let k in varNames) {
        this.set(k, varNames[k]);
      }
    } else {
      let varName = variableOrHash;
      if (varName[0]=="_") {
        this.volatiles[varName] = value;
      } else if (varName[0]==varName[0].toUpperCase()) {
        this.globals[varName] = value;
      } else {
        this.locals[varName] = value;
      }
    }
  }

  /**
   * async start - start a new dialog
   *
   * @param  {string}   dialog the dialog to start
   * @param  {string}   tag    result tag, used in with conjunction with onResult
   * @param  {Object}   locals local variables to start the dialog with
   * @return {Promise}
   */
  async start(dialog, ...args) {
    var tag, locals;
    var nextArg = args.pop();

    while (nextArg) {
      if (isString(nextArg)) {
        tag = nextArg;
      } else if (isObject(nextArg)) {
        locals = nextArg;
      } else {
        throw new Error(`Unrecognized argument to Session#start: ${nextArg}. Expecting a tag or local variables`);
      }
      nextArg = args.pop();
    }

    var graphQLVars = {
      sessionId: this.id,
      parentId: this.frameId,
      dialog: dialog,
      tag: tag,
      globals: this.globals
    };

    if (locals) {
      graphQLVars.locals = locals;
    }

    log.debug('Session#start(%j, %j, %j) | dialog:%s frame:%s session:%s',
      dialog, tag, locals, this.dialogName, this.frameId, this.id);

    this.checkLock();

    this.locked = true;
    try {
      var result = await this.client.mutate(`($sessionId: String, $parentId: String,
          $dialog: String, $tag: String, $locals: JSON, $globals: JSON) {
        sessionStartFrame(sessionId: $sessionId, parentId: $parentId,
          dialog: $dialog, tag: $tag, locals: $locals, globals: $globals) {
          id globals username displayName givenName surname email
          stack(limit: 1) { id dialog tag locals }
        }
      }`, graphQLVars);

      log.debug('Session#start() => %j | dialog:%s frame:%s session:%s',
        result, this.dialogName, this.frameId, this.id);

    } catch (e) {
      this.locked = false;
      throw e;
    }
  }

  /**
   * async finish - end the current dialog, returning result
   *
   * @param  {Object} result any JSON-compatible object
   * @return {Promise}
   */
  async finish(result) {
    log.debug('Session#finish(%j) | dialog:%s frame:%s session:%s',
      result, this.dialogName, this.frameId, this.id);

    this.checkLock();

    this.locked = true;
    try {
      var response = await this.client.mutate(`($sessionId: String, $frameId: String,  $result: JSON, $globals: JSON) {
        sessionEndFrame(sessionId: $sessionId, frameId: $frameId, result: $result, globals: $globals) {
          id globals
          stack(limit: 1) { id dialog tag locals }
        }
      }`, {
        sessionId: this.id,
        frameId: this.frameId,
        result: result
      });

      log.debug('Session#finish() mutation complete. Result => %j | dialog:%s frame:%s session:%s',
        response, this.dialogName, this.frameId, this.id);

    } catch (e) {
      this.locked = false;
      throw e;
    }
  }


  /**
   * async save - saves session variables to the server
   *
   * @parama {Object}  values - key-value pairs to set
   * @return {Promise}  description
   */
  async save(values) {
    if (values) {
      this.set(values);
    }

    log.debug('Session#save(%j) | locals:%j globals:%j dialog:%s frame:%s session:%s',
      values, this.locals, this.globals, this.dialogName, this.frameId, this.id);

    this.checkLock();
    var result = await this.client.mutate(`($sessionId: String, $locals: JSON, $globals: JSON) {
      sessionUpdate(sessionId: $sessionId, locals: $locals, globals: $globals) {
        id globals username displayName givenName surname email
        stack(limit: 1) { id dialog tag locals }
      }
    }`, {
      sessionId: this.id,
      globals: this.globals,
      locals: this.locals
    });

    log.debug('Session#save(%j) => %j | dialog:%s frame:%s session:%s',
      values, result, this.dialogName, this.frameId, this.id);
  }


  /**
   * async sleep - a Promisified version of setTimeout
   *
   * @param  {float} milliseconds
   * @return {Promise}
   */
  async sleep(milliseconds) {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
  }

  /**
   * async send - send a message to the user
   *
   * @param  {string}   text
   * @param  {string}   mediaUrl
   * @param  {string}   mediaType
   * @param  {string}   type
   * @param  {Object[]} actions   an array of actionButtons
   * @param  {Object[]} items     an array of items
   * @param  {Object}   displaySettings
   * @param  {string}   displaySettings.imageAspectRatio - horizontal (default) or square
   * @return {Promise}
   */
  async send(params) {
    var text, type;
    if (isString(params)) {
      text = params;
      type = 'text';
    } else {
      text = params.text;
      type = params.type;

      var {mediaUrl, mediaType, actions, displaySettings, items } = params;
    }

    if (!type) {
      if (mediaUrl) {
        type = 'image';
      } else if (text) {
        type = 'text'; // smooch message type, not mediaType
      } else {
        throw new Error(`Unable to send message: type not provided and cannot be inferred`);
      }
    }

    log.debug('Session#send(%j) | dialog:%s session:%s frame:%s',
      params, this.dialogName, this.id, this.frameId);

    this.checkLock();

    var result = await this.client.mutate(`($sessionId: String, $type: MessageType, $text: String,
       $mediaUrl: String, $mediaType: String, $actions: [ActionButtonInput], $items: [MessageItemInput],
       $displaySettings: MessageDisplaySettingsInput) {
        messageSend(sessionId: $sessionId, type: $type, text: $text,
          mediaUrl: $mediaUrl, mediaType: $mediaType, actions: $actions, items: $items,
          displaySettings: $displaySettings) {
          id sessionId endpointInfo { messageId endpointId senderId recipientId }
          actions displaySettings { imageAspectRatio }
        }
    }`, {
      sessionId: this.id,
      type, text, mediaUrl, mediaType, actions, items,
      displaySettings
    });
    log.debug('Session#send(...) => %j | dialog:%s session:%s frame:%s',
      result, this.dialogName, this.id, this.frameId);

  }

  checkLock() {
    if (this.locked) {
      throw new Error('Session locked: no operations allowed after start() or finish()');
    }
  }


  /**
   * reset - Description
   *
   * @param  {Object}   params
   * @param  {string}   params.sessionId either sessionId
   * @param  {frameId}  params.frameId identifies the frame to reset to, if not
   *                       provided, the earliest active frame is used.  Unless
   *                       something exotic occurred, this will be the first frame
   *                       containing the mainDialog dialog
   * @param  {boolean}  params.globals reset the global variables?
   *
   * @return {none}
   */
  async reset(params) {
    params = params || {};

    log.debug('Session#reset(%j) | dialog:%s session:%s frame:%s',
      params, this.dialogName, this.id, this.frameId);
    assert(this.app, 'app is not defined!');
    var result = await this.client.mutate(`($sessionId: String, $frameId: String, $globals: Boolean, $locals: Boolean) {
      sessionReset(sessionId: $sessionId, frameId: $frameId, globals: $globals, locals: $locals) {
        id globals username displayName givenName surname email
        stack { id dialog tag locals }
      }
    }`, {
      ...params,
      sessionId: this.id
    });
    log.debug('Session#reset(%j)=>%j | dialog:%s frame:%s session:%s',
      params, result, this.dialogName, this.frameId, this.id);
    var session = result.sessionReset;
    this._updateValues({currentFrame: session.stack[0], ...session});
  }

  /**
   * postback- Returns a postback object to the current dialog
   *
   * @param {string} dialog Description
   * @param {string} method Description
   *
   * @return {string} Description
   */
  postbackToken(method, args) {
    var body = {
      appId: this.app.appId,
      sessionId: this.id,
      frameId: this.frameId,
      method: method
    };
    if (args) {
      body.args = args;
    }
    var secret = this.app.appSecret;

    if (!secret) {
      throw new Error('App secret must be defined, but is %s', secret);
    }
    return jwt.encode(body, secret);
  }

  /**
   * postbackActionButton
   *
   * @param {string} dialog Description
   * @param {string} method The name of the onPostback method provided by the dialog
   * @param {type} text   Description
   * @param {any} args
   *
   * @return {Object} Suitable for inclusion in the list of actions of a
   *                  carousel or list style message
   */
  postbackActionButton(method, text, args) {
    return {
      type: 'postback',
      text: text,
      payload: this.postbackToken(method, args)
    };
  }

  /**
   * invokePostback - given a postback object or a postback token, invokes the
   *
   * @param {string} postbackToken
   * @param {Object} args
   *
   * @return {Object} the data returned by the postback
   */
  async invokePostback(postbackToken, args) {
    log.debug('Session.invokePostback %s %j', postbackToken, args);
    var header = jwt.decode(postbackToken, "", true);
    if (header.args && args) {
      throw new Error(`Invalid Postback arguments. Token already contains arguments: ${header.args}`);
    }

    var rawResult= await this.client.mutate(`($token: String, $args: JSON) {
      sessionInvokePostback(token: $token, args: $args) }`,
      {
        token: postbackToken,
        args: args
      }
    );
    if (rawResult) {
      return rawResult.sessionInvokePostback;
    }
  }
}
