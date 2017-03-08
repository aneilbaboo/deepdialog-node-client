import url from 'url';

import Client from './client';
import AppServer from './app-server';
import Dialog from './dialog';
import NLPModel from './nlp-model';
import Session from './session';

import log from './log';

export default class App {
  constructor({appId, appSecret, mainDialog, hostURL, deepDialogServer}) {
    deepDialogServer = deepDialogServer || 'https://api.deepdialog.ai';
    var ddGraphQLURL = url.resolve(deepDialogServer, 'graphql');
    this._client = new Client(appId, appSecret, ddGraphQLURL);
    this._dialogs = {};
    this._nlpModels = {};
    this._mainDialog = mainDialog;
    this._hostURL = hostURL;
    this._eventHandlers = {};
    this.https = true;
  }

  get mainDialog() { return this._mainDialog; }
  set mainDialog(val) { this._mainDialog = val; }

  get hostURL() { return this._hostURL; }
  set hostURL(val) { this._hostURL = val; }

  get domain() { return this._domain;  }
  set domain(value) { this._domain = value; }

  get webhook() {
    if (this.hostURL) {
      return url.resolve(this.hostURL,'webhook');
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
  * save - description
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

    log.debug('Saving app %j', variables);

    await this.client.mutate(`($dialogs: [DialogInput], $nlpModels: [NLPModelInput],
      $mainDialog: String, $webhook: String) {
        appUpdate(dialogs: $dialogs, nlpModels: $nlpModels,
          mainDialog: $mainDialog, webhook: $webhook) {
            id
            mainDialog
            dialogs { name  nlpModelName startHandler
              resultHandlers { dialog tag } inputHandlers }
              nlpModels { name accessId accessToken }
              webhook
            }
          }`,
          variables);
  }

  createServer() {
    return new AppServer(this);
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
    log.silly('Handling notification: %j', notification);
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


  /**
   * App#handleFrameEvent - Top level frame event handler which delegates
   *                        to specific frame_* event handlers
   *
   * @param  {Object} notification description
   */
  async handleFrameEvent(notification) {
    var session = this.sessionFromNotificationData(notification);
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
    var startHandler = dialog.startHandler;
    log.info('Received frame_start for session:%s locals: %j', session.id, session.locals);
    if (startHandler) {
      await Promise.resolve(startHandler(session, session.locals, notification));
    } else {
      log.warn('Couldn\'t find start handler for dialog %s', dialog.name);
    }
  }

  async handleFrameInput(session, notification) {
    var dialog = session.dialog;
    var data = notification.data;
    var result = dialog.getInputHandler(data);
    log.info('Received frame_input for session: %s notification: %j', session.id, notification);

    if (result) {
      var [inputHandler, extractor] = result;
      await Promise.resolve(inputHandler(session, extractor(notification), notification));
    } else {
      log.warn('Dialog %s received %j, but no handler found', dialog.name, data);
    }
  }

  async handleFrameResult(session, notification) {
    var dialog = session.dialog;
    var completedFrame = notification.session.completedFrame[0];
    var resultHandler = dialog.getResultHandler(completedFrame.dialog, completedFrame.tag);

    log.info('Received frame_result for session: %s notification: %j', session.id, notification);

    if (resultHandler) {
      await Promise.resolve(resultHandler(session, completedFrame.result, notification));
    } else {
      log.error("Couldn't find result handler for %s|%s in dialog %s",
      completedFrame.dialog, completedFrame.tag, dialog.name);
    }
  }

  sessionFromNotificationData(data) {
    var currentFrame = data.matchedFrame || data.session.stack[0];
    return new Session({
      app: this,
      id: data.session.id,
      globals: data.session.globals,
      currentFrame: currentFrame
    });
  }

  async getSessions(params) {
    var {id, before, limit} = params;
    log.debug('App#getSessions %j', params);
    let sessions = await this.client.query(`($id: String,
      $before: string, $limit: string) {
        app { sessions(id:$id, before:$before, limit:$limit) {
          id globals stack(limit:1) { id locals tag dialog }
        }}
      }`,
      {id:id, limit:limit, before:before}
    );
    log.debug('App#getSessions => %j', sessions);
    return sessions.map((s)=>new Session({
      app: this,
      id: s.id,
      globals: s.globals,
      currentFrame: s.stack[0]
    }));
  }
}
