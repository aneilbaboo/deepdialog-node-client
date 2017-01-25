import Client from './client';
import AppServer from './appserver';

const AppUpdateOp = `($dialogs: [Dialog], $nlpModels: [nlpModels], $mainDialog: String, $webhook: String) {
  appUpdate(dialogs: $dialogs, nlpModels: $nlpModels, mainDialog: $mainDialog) {
    id
    mainDialog
    dialogs
    nlpModels
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
    this.webhook = null;
  }

  get client() { return this._client; }

  get dialogs() { return Object.values(this._dialogs); }

  get nlpModels() { return Object.values(this._nlpModelsl); }

  getDialog(name) { return this._dialogs[name]; }

  getNLPModel(name) { return this._nlpModels[name]; }

  getEventHandler(event) { return this._eventHandlers[event]; }

  addDialogs(...dialogs) {
    for (let d of dialogs) {
      if (d instanceof Array) {
        this.addDialogs(d);
      } else {
        this._dialogs[d.name] = d;
      }
    }
  }

  addNLPModels(...nlpModels) {
    for (let n of nlpModels) {
      if (n instanceof Array) {
        this.addNLPModels(n);
      } else {
        this._nlpModels[n.name] = n;
      }
    }
  }

  async handleEvent(notification) {
    return await this.eventHandlers[notification.event](notification);
  }

  onEvent(event, fn) {
    this.eventHandlers[event] = fn;
  }

  async save() {
    await this.client.mutate(AppUpdateOp, {
      dialogs: this.dialogs,
      nlpModels: this.nlpModels,
      mainDialog: this.mainDialog,
      webhook: this.webhook
    });
  }

  server() {
    return new AppServer(this);
  }

}
