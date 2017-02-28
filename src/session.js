import assert from 'assert';
import log from './log';

export default class Session {
  constructor(app, {id, globals, currentFrame}) {
    assert(app && app.__proto__ && app.__proto__.constructor.name=='App', 'app must be an App instance', app);
    assert(id, 'id (session.id)');
    assert(globals, 'globals');
    assert(currentFrame, 'currentFrame');
    this._app = app;
    this._id = id;
    this._currentFrame = currentFrame;
    this._globals = globals;
    this.locked = false;
  }

  get app() { return this._app; }
  get client() { return this._app.client; }
  get id() { return this._id; }
  get globals() { return this._globals; }
  get frameId() { return this._currentFrame.id; }
  get locals() { return this._currentFrame.locals; }
  get dialogName() { return this._currentFrame.dialog; }
  get dialog() { return this.app.getDialog(this._currentFrame.dialog); }
  get tag() { return this._currentFrame.tag; }


  /**
   * get - gets a global or local variable
   *       global variables begin with uppercase
   *
   * @param  {type} variable description
   * @return {Object}        the value of the variable
   */
  get(variable) {
    return this.locals[variable] || this.globals[variable];
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
  async start(dialog, tag, locals) {
    log.debug('start(%j, %j, %j) dialog:%s session:%s frame:%s',
      dialog, tag, locals, this.dialogName, this.id, this.frameId);
    this.checkLock();

    this.locked = true;
    try {
      await this.client.mutate(`($sessionId: String, $parentId: String,
          $dialog: String, $tag: String, $locals: JSON, $globals: JSON) {
        sessionStartFrame(sessionId: $sessionId, parentId: $parentId,
          dialog: $dialog, tag: $tag, locals: $locals, globals: $globals) {
          id globals
          stack(limit: 1) { id locals }
        }
      }`, {
        sessionId: this.id,
        parentId: this.frameId,
        dialog: dialog,
        tag: tag,
        locals: locals,
        globals: this.globals
      });
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
    log.debug('finish(%j) dialog:%s tag:%s session:%s frame:%s',
      this.dialogName, this. tag, this.id, this.frameId);
    this.checkLock();

    this.locked = true;
    try {
      await this.client.mutate(`($sessionId: String, $result: JSON, $globals: JSON) {
        sessionEndFrame(sessionId: $sessionId, result: $result, globals: $globals) {
          id globals
          stack(limit: 1) { id dialog tag locals }
        }
      }`, {
        sessionId: this.id,
        frameId: this.frameId,
        result: result,
        suppressNotification: true
      });
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
    log.debug('save() dialog:%s session:%s locals:%s globals:%s frame:%s',
      this.dialogName, this.id, this.locals, this.globals, this.frameId);
    this.checkLock();
    await this.client.mutate(`($sessionId: String, $locals: Object, $globals: Object) {
      sessionUpdate(sessionId: $sessionId, locals: $locals, globals: $globals) {
        id globals
        stack(limit: 1) { id dialog tag locals }
      }
    }`, {
      sessionId: this.id,
      globals: this.globals,
      locals: this.locals
    });
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
  async send({text, mediaUrl, mediaType, type, actions, items}) {
    if (!type) {
      if (text) {
        type = 'text';
      } else if (mediaUrl) {
        type = 'image';
      } else {
        throw new Error(`Attempt to send message: type not provided and cannot be inferred`);
      }
    }

    log.debug('send({text:%j, mediaUrl:%j, mediaType:%j, type:%j, actions:%j, items:%j})'+
      ' dialog:%s session:%s frame:%s',
      text, mediaUrl, mediaType, type, actions, items, this.dialogName, this.id, this.frameId);

    this.checkLock();

    await this.client.mutate(`($sessionId: String, $type: MessageType, $text: String,
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
  }

  checkLock() {
    if (this.locked) {
      throw new Error('Session locked: no operations allowed after start() or finish()');
    }
  }
}
