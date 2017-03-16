import App from './app';
import {isString, isObject} from 'util';
import assert from 'assert';
import log from './log';

export default class Session {
  constructor({app, id, globals, accessToken, currentFrame}) {
    assert(app.constructor==App, 'app must be an App instance');
    assert(id, 'id (session.id)');
    this._app = app;
    this._updateValues({
      id:id,
      globals:globals,
      accessToken:accessToken || app.appSecret,
      currentFrame:currentFrame});
  }

  _updateValues({id, globals, accessToken, currentFrame}) {
    var {id:frameId, dialog, locals, tag} = currentFrame || {};
    this._id = id;
    this._frameId = frameId;
    this._locals = locals || {};
    this._dialogName = dialog;
    this._tag = tag;
    this._globals = globals || {};
    this.locked = false;
    this._accessToken = accessToken;
    this._client = accessToken ? this.app.client.clientWithAccessToken(accessToken) : this.app.client;
  }

  validate() {
    assert(this.app.constructor==App, 'app must be an App instance');
    assert(this.id, 'invalid session id (.id)');
    assert(this.frameId, 'invalid stack frame id (.frameId)');
    assert(this.dialog, 'invalid dialog (.dialogName)');
    assert(this.globals, 'invalid globals (.globals)');
    assert(this.locals, 'invalid locals (.locals)');
  }

  get app() { return this._app; }
  get client() { return this._client; }
  get id() { return this._id; }
  get globals() { return this._globals; }
  get frameId() { return this._frameId; }
  get locals() { return this._locals; }
  get dialogName() { return this._dialogName; }
  get dialog() { return this.app.getDialog(this.dialogName); }
  get tag() { return this._tag; }
  get accessToken() { return this._accessToken; }

  /**
   * get - gets a global or local variable
   *       global variables begin with uppercase
   *
   * @param  {type}     key description
   * @return {Object}
   */
  get(key) {
    return (this.locals.hasOwnProperty(key)) ? this.locals[key] : this.globals[key];
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
      for (let k in variableOrHash) {
        this.set(k, variableOrHash[k]);
      }
    } else {
      if (variableOrHash[0]==variableOrHash[0].toUpperCase()) {
        this.globals[variableOrHash] = value;
      } else {
        this.locals[variableOrHash] = value;
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
      globals: this.globals
    };

    if (tag) {
      graphQLVars.tag = tag;
    }

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
          id globals
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
   * @return {Promise}  description
   */
  async save() {

    log.debug('Session#save() | locals:%j globals:%j dialog:%s frame:%s session:%s',
      this.locals, this.globals, this.dialogName, this.frameId, this.id);

    this.checkLock();
    var result = await this.client.mutate(`($sessionId: String, $locals: JSON, $globals: JSON) {
      sessionUpdate(sessionId: $sessionId, locals: $locals, globals: $globals) {
        id globals
        stack(limit: 1) { id dialog tag locals }
      }
    }`, {
      sessionId: this.id,
      globals: this.globals,
      locals: this.locals
    });

    log.debug('Session#save() => %j | dialog:%s frame:%s session:%s',
      result, this.dialogName, this.frameId, this.id);
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

      var {mediaUrl, mediaType, actions, items } = params;
    }

    if (!type) {
      if (text) {
        type = 'text';
      } else if (mediaUrl) {
        type == 'image'; // smooch message type, not mediaType
      } else {
        throw new Error(`Unable to send message: type not provided and cannot be inferred`);
      }
    }

    log.debug('Session#send(%j) | dialog:%s session:%s frame:%s',
      params, this.dialogName, this.id, this.frameId);

    this.checkLock();

    var result = await this.client.mutate(`($sessionId: String, $type: MessageType, $text: String,
       $mediaUrl: String, $mediaType: String, $actions: [ActionButtonInput], $items: [MessageItemInput]) {
        messageSend(sessionId: $sessionId, type: $type, text: $text,
          mediaUrl: $mediaUrl, mediaType: $mediaType, actions: $actions, items: $items) {
          id sessionId endpointInfo { messageId endpointId senderId recipientId }
          actions
        }
    }`, {
      sessionId: this.id,
      type: type,
      text: text,
      mediaUrl: mediaUrl,
      mediaType: mediaType,
      actions: actions,
      items: items
    });
    log.debug('Session#send(...) => %j | dialog:%s session:%s frame:%s',
      result, this.dialogName, this.id, this.frameId);

  }

  checkLock() {
    if (this.locked) {
      throw new Error('Session locked: no operations allowed after start() or finish()');
    }
  }

  async reset(params) {
    params = params || {};

    log.debug('Session#reset(%j) | dialog:%s session:%s frame:%s',
      params, this.dialogName, this.id, this.frameId);
    assert(this.app, 'app is not defined!');
    var result = await this.client.mutate(`($sessionId: String, $frameId: String, $globals: Boolean, $locals: Boolean) {
      sessionReset(sessionId: $sessionId, frameId: $frameId, globals: $globals, locals: $locals) {
        id globals stack { id dialog tag locals }
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
}
