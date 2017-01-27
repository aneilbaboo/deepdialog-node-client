
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
`($id: String, text: String) {
  sessionSendResponse(id: $id, text: $text)
}`;

export class Session {
  constructor(client, {id, globals, currentFrame}) {
    this.id = id;
    this.currentFrame = currentFrame;
    this.globals = globals;
    this.locked = false;
  }

  get locals() { return this.currentFrame.locals; }
  get dialog() { return this.currentFrame.dialog; }
  get tag() { return this.currentFrame.tag; }

  get(variable) {
    return this.locals[variable] || this.globals[variable];
  }

  set(variable, value) {
    if (variable[0]==variable[0].toUpperCase()) {
      this.globals[variable] = value;
    } else {
      this.locals[variable] = value;
    }
  }

  async start({dialog, tag, locals}) {
    this.checkLock();

    await this.client.mutate(StartFrameOp, {
      sessionId: this.id,
      parentFrameId: this.frameId,
      dialog: dialog,
      tag: tag,
      locals: locals,
      globals: this.globals
    });

    this.locked = true;
  }

  async finish(result) {
    this.checkLock();

    await this.client.mutate(EndFrameOp, {
      sessionId: this.id,
      frameId: this.frameId,
      result: result,
      suppressNotification: true
    });

    this.locked = true;
  }

  async save() {
    this.checkLock();
    await this.client.send(UpdateOp, {
      sessionId: this.id,
      globals: this.globals,
      locals: this.locals
    });
  }

  async respond({text}) {
    this.checkLock();
    await this.client.send(SendResponseOp, {
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
