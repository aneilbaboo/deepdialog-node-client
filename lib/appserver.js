
export default AppServer {
  constructor(app) {
    this.app = app;
  }

  dialogFromFrame(frame) {
    return this.app.getDialog(frame.dialog);
  }

  sessionFromData(data) {
    var frame = data.stack[0];
    return new Session(this, {
      id: data.id,
      globals: data.globals,
      currentFrame: frame
    });
  }

  async handleNotification(notification) {
    var event = notification.event;
    var session;
    var dialog;

    switch (event) {
      case 'frame_start':
        session = this.sessionFromData(notification.session);
        dialog = this.dialogFromFrame(app, session);

        if (dialog.startHandler) {
          await dialog.startHandler(session);
        } else {
          log.warn('Couldn\'t find start handler for %s', dialog.name);
        }
        break;

      case 'frame_end':
        session = this.sessionFromData(notification.session);
        dialog = this.dialogFromFrame(app, session);
        var completedFrame = notification.session.completedFrame[0];
        var resultHandler = dialog.resultHandlers[completedFrame.dialog, completedFrame.tag];
        if (resultHandler) {
          await resultHandler(completedFrame.result);
        } else {
          log.error('Couldn\'t find result handler for %s.%s',  completedFrame.dialog, completedFrame.tag);
        }
        break;

      case 'frame_message':
        session = this.sessionFromData(notification.session);
        dialog = this.dialogFromFrame(app, session);
        var intent = notification.match.intent;
        var entities = notification.match.entities;
        var intentHandler = dialog.intentHandlers[intent];
        if (intentHandler) {
          await intentHandler(session, entities);
        } else {
          log.warn('Dialog %s received intent %s, but no handler found', dialog, intent);
        }
        break;

      case 'frame_default':
        session = this.sessionFromData(notification.session);
        dialog = this.dialogFromFrame(app, session);

        if (dialog.defaultHandler) {
          await dialog.defaultHandler(session, notification);
        }
        break;
    }

    var eventHandler = this.app.eventHandlers[event] || this.app.eventHandlers.any;

    if (eventHandler) {
      await eventHandler(event);
    }
  }

  makeServer() {

    var server = express();
    server.use(bodyParser.urlencoded({extended: true, inflate:true}));
    server.use(bodyParser.json(true));
    server.use(compression());

    var appServer = this;

    server.use('/', async function (req, res) {
      var notifications = req.body.notifications;
      await Promise.all(notifications.map((n)=>appServer.handleNotification(appServer.app, n)));
      res.status(200);
    });

    return server;
  }

  async start(port) {
    var result = await this.app.sync();
    if (result.errors) {
      throw result.errors;
    }

    var server = this.makeServer();

    server.listen(port, function () {
      log.info('DeepDialog App server listening on port %s', port);
    });
  }
}
