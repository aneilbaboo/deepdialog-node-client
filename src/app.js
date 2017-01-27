import {Client} from './client';
import {AppServer} from './appserver';
import {Dialog} from './dialog';
import {NLPModel} from './nlpModel';

import log from './log';

const AppUpdateOp = `($dialogs: [DialogInput], $nlpModels: [NLPModelInput], $mainDialog: String, $webhook: String) {
  appUpdate(dialogs: $dialogs, nlpModels: $nlpModels, mainDialog: $mainDialog, webhook: $webhook) {
    id
    mainDialog
    dialogs { name nlpModelName patterns { intent }}
    nlpModels { name accessId accessToken }
    webhook
  }
}`;

export class App {
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

  server() {
    return new AppServer(this);
  }

}
