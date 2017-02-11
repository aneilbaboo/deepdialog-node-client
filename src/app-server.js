import express from 'express';
import promiseRouter from 'express-promise-router';
import bodyParser from 'body-parser';
import compression from 'compression';

import {sleep} from './util';
import log from './log';

export default class AppServer {
  constructor(app) {
    this.app = app;
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

    var server = this.makeServer();
    var started = false;

    this.server = server.listen(port, function () {
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

  makeServer() {
    var app = this.app;
    var server = express();
    var router = promiseRouter();

    server.use(bodyParser.urlencoded({extended: true, inflate:true}));
    server.use(bodyParser.json(true));
    server.use(compression());
    server.use("/", router);

    router.post('/', async function (req, res) {
      var notifications = req.body.notifications;
      if (notifications) {
        log.info('Processing notifications: %j', notifications);
        try {
          await Promise.all(notifications.map((n)=>app.handleNotification(n)));
          res.status(200).send({result:"success"});
          return;
        } catch (e) {
          res.status(500).send({error: { statusCode: 500, message: 'Internal server error' } });
          log.error(e);
        }
      } else {
        res.status(400).send({error: { statusCode: 400, message: "Malformed request"}});
      }

    });

    return server;
  }
}
