import assert from 'assert';

const UpdateOp =
`mutation {
  sessionUpdate(id: $id, locals: $locals, globals: $globals) { }
}`;

const StartFrameOp =
`($id: String, $dialog: String, $tag: String, $locals: Object, $globals: Object) {
  sessionStartFrame(id: $id, dialog: $dialog, tag: $tag, locals: $locals, globals: $globals) {
    id
    globals
    stack(limit: 1) { id locals }
  }
}`;

const EndFrameOp =
`($id: String, $result: Object) {
  sessionEndFrame(id: $id, result: $result) {
    id
    stack(limit: 1) { id dialog tag locals }
  }
}`;

const SendResponseOp =
`($id: String, $text: String) {
  sessionSendResponse(id: $id, text: $text)
}`;

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
  get locals() { return this._currentFrame.locals; }
  get dialogName() { return this._currentFrame.dialog; }
  get dialog() { return this.app.getDialog(this._currentFrame.dialog); }
  get tag() { return this._currentFrame.tag; }

  get(variable) {
    return this.locals[variable] || this.globals[variable];
  }

  set(variable, value) {
    if (variable instanceof Object) {
      for (let k in variable) {
        this.set(k, variable[k]);
      }
    } else {
      if (variable[0]==variable[0].toUpperCase()) {
        this.globals[variable] = value;
      } else {
        this.locals[variable] = value;
      }
    }
  }

  async start({dialog, tag, locals}) {
    this.checkLock();

    this.locked = true;
    try {
      await this.client.mutate(StartFrameOp, {
        sessionId: this.id,
        parentFrameId: this.frameId,
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

  async finish(result) {
    this.checkLock();

    this.locked = true;
    try {
      await this.client.mutate(EndFrameOp, {
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

  async save() {
    this.checkLock();
    await this.client.mutate(UpdateOp, {
      sessionId: this.id,
      globals: this.globals,
      locals: this.locals
    });
  }

  async respond({text}) {
    this.checkLock();
    await this.client.mutate(SendResponseOp, {
      sessionId: this.id,
      text: text
    });
  }

  checkLock() {
    if (this.locked) {
      throw new Error('Session locked: no operations allowed after start() or finish()');
    }
  }
}
