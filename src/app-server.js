import express from 'express';
import promiseRouter from 'express-promise-router';
import bodyParser from 'body-parser';
import compression from 'compression';
import {sleep} from './util';
import log from './log';
import morgan from 'morgan';

export default class AppServer {
  constructor(app) {
    this.app = app;
    this.expressApp = this.makeExpressApp();
  }

  use(route, fn) {
    this.expressApp.use(route, fn);
  }
  /**
   * start- starts the app server this function resolves when the server actually starts
   *
   * @param  {number} port description
   * @return {AppServer}      description
   */
  async start(port, fn) {
    if (this.server) {
      throw new Error(`Server already started`);
    }

    var started = false;

    this.server = this.expressApp.listen(port, function () {
      log.info('DeepDialog App server listening on port %s', port);
      started = true;
    });

    while(!started) {
      await sleep(10);
    }

    await Promise.resolve(fn(this.app));

    return this;
  }


  /**
   * stop - stops the server
   *
   * @return {type}  description
   */
  stop() {
    if (this.server) {
      this.server.close();
      this.server = null;
    }
  }

  makeExpressApp() {
    var app = this.app;
    var expressApp = express();
    var router = promiseRouter();

    expressApp.use(bodyParser.urlencoded({extended: true, inflate:true}));
    expressApp.use(bodyParser.json(true));
    expressApp.use(compression());
    expressApp.use(morgan('common'));
    expressApp.use("/", router);

    router.post('/webhook', async function (req, res) {
      var notifications = req.body.notifications;
      if (notifications) {
        log.info('Processing notifications: %j', notifications);
        try {
          await Promise.all(notifications.map((n)=>app.handleNotification(n)));
          res.status(200).send({handled:true});
          return;
        } catch (e) {
          res.status(500).send({error: { statusCode: 500, message: 'Internal server error' } });
          log.error(e);
        }
      } else {
        res.status(400).send({error: { statusCode: 400, message: "Malformed request"}});
      }

    });

    return expressApp;
  }
}
