import Client from './client';
import AppServer from './app-server';
import Dialog from './dialog';
import NLPModel from './nlp-model';
import Session from './session';

import log from './log';

const AppUpdateOp = `($dialogs: [DialogInput], $nlpModels: [NLPModelInput], $mainDialog: String, $webhook: String) {
  appUpdate(dialogs: $dialogs, nlpModels: $nlpModels, mainDialog: $mainDialog, webhook: $webhook) {
    id
    mainDialog
    dialogs { name  nlpModelName startHandler defaultHandler resultHandlers { dialog tag } nlpInputHandlers { intent }}
    nlpModels { name accessId accessToken }
    webhook
  }
}`;

export default class App {
  constructor({appId, appSecret}) {
    this._client = new Client(appId, appSecret);
    this.mainDialog = null;
    this._dialogs = {};
    this._nlpModels = {};
    this._eventHandlers = {};
    this.https = true;
  }

  get domain() { return this._domain;  }
  set domain(value) { this._domain = value; }

  get webhook() {
    if (this.domain) {
      return `${this.https ? 'https' : 'http' }://${this.domain}/`;
    } else {
      return '';
    }
  }

  get client() { return this._client; }

  get dialogs() { return Object.values(this._dialogs); }
  set dialogs(dialogs) {
    this._dialogs = {};
    this.addDialogs(dialogs);
  }

  get nlpModels() { return Object.values(this._nlpModels); }
  set nlpModels(models) {
    this._nlpModels = {};
    this.addNLPModels(models);
  }

  getDialog(name) { return this._dialogs[name]; }

  getNLPModel(name) { return this._nlpModels[name]; }

  getEventHandler(event) { return this._eventHandlers[event]; }

  addDialogs(...dialogs) {
    if (dialogs) {
      for (let d of dialogs) {
        if (d instanceof Array) {
          this.addDialogs(...d);
        } else {
          if (d instanceof Dialog) {
            this._dialogs[d.name] = d;
          } else {
            throw new Error(`Expecting a Dialog instance, but received ${JSON.stringify(d)}`);
          }
        }
      }
    }
  }

  addNLPModels(...nlpModels) {
    if (nlpModels) {
      for (let n of nlpModels) {
        if (n instanceof Array) {
          this.addNLPModels(...n);
        } else {
          if (n instanceof NLPModel) {
            this._nlpModels[n.name] = n;
          } else {
            throw new Error(`Expecting a NLPModel instance, but reecived ${n}`);
          }

        }
      }
    }
  }

  async handleEvent(notification) {
    return await this.eventHandlers[notification.event](notification);
  }

  onEvent(event, fn) {
    this.eventHandlers[event] = fn;
  }


  /**
  * async - description
  *
  * @return {type}  description
  */
  async save() {
    var variables = {
      dialogs: this.dialogs.map(d=>d.toObject()),
      nlpModels: this.nlpModels.map(n=>n.toObject()),
      mainDialog: this.mainDialog,
      webhook: this.webhook
    };
    log.info("SAVE APP VARIABLES %j", variables);
    await this.client.mutate(AppUpdateOp, variables);

  }

  get server() {
    if (!this._server) {
      this._server = new AppServer(this);
    }
    return this._server;
  }

  //
  // Notification handling
  //

  async handleNotification(notification) {
    var promises = [];
    var appHandler = this._eventHandlers[event];
    var event = notification.event;

    if (appHandler) {
      promises.push(appHandler);
    }

    if (event.startsWith('frame_')) {
      promises.push(this.handleFrameEvent(notification));
    }

    await Promise.all(promises);
  }


  async handleFrameEvent(notification) {
    var session = this.sessionFromNotificationData(notification.session);
    var event = notification.event;

    switch (event) {
      case 'frame_start':
        await this.handleFrameStart(session, notification);
        break;

      case 'frame_result':
        await this.handleFrameResult(session, notification);
        break;

      case 'frame_input':
        await this.handleFrameInput(session, notification);
        break;

      case 'frame_default':
        await this.handleFrameDefault(session, notification);
        break;
    }
  }

  async handleFrameStart(session, notification) {
    var dialog = session.dialog;

    if (dialog.startHandler) {
      await Promise.resolve(dialog.startHandler(session, notification));
    } else {
      log.warn('Couldn\'t find start handler for dialog %s', dialog.name);
    }
  }

  async handleFrameInput(session, notification) {
    var dialog = session.dialog;
    var data = notification.data;

    if (data.intent) {
      var intent = notification.data.intent;
      var entities = notification.data.entities;
      var intentHandler = dialog.getIntentHandler(intent);
      if (intentHandler) {
        await Promise.resolve(intentHandler(session, entities, notification));
        return;
      }
    }
    log.warn('Dialog %s received intent %s, but no handler found', dialog.name, intent);
  }

  async handleFrameResult(session, notification) {
    log.info("handleFrameResult 1");
    var dialog = session.dialog;
    var completedFrame = notification.session.completedFrame[0];
    var resultHandler = dialog.getResultHandler(completedFrame.dialog, completedFrame.tag);
    log.info("handleFrameResult 2");
    if (resultHandler) {
      await Promise.resolve(resultHandler(session, completedFrame.result, notification));
    } else {
      log.error('Couldn\'t find result handler for %s.%s in dialog %s',
      completedFrame.dialog, completedFrame.tag, dialog.name);
    }
  }

  async handleFrameDefault(session, notification) {
    var dialog = session.dialog;

    if (dialog.defaultHandler) {
      await Promise.resolve(dialog.defaultHandler(session, notification));
    } else {
      log.warn('Couldn\t find default handler for dialog %s', dialog.name);
    }
  }

  sessionFromNotificationData(data) {
    var frame = data.stack[0];
    return new Session(this, {
      id: data.id,
      globals: data.globals,
      currentFrame: frame
    });
  }

}
