import {expect} from 'chai';

import {App, Dialog} from '..';

describe('Feature tests', function () {
  context('App', function () {
    var app;
    var mainDialog, childDialog;

    beforeEach(function() {
      app = new App({
        appId: process.env.DEEPDIALOG_TEST_APPID,
        appSecret: process.env.DEEPDIALOG_TEST_APPSECRET
      });

    });

    it('should save an empty app with the server', async function () {
      var result = await app.save();
      expect(result).to.be.ok;
      var data = result.data;
      expect(data).to.be.ok;
      expect(data.id).to.equal(process.env.DEEPDIALOG_TEST_APPID);
      expect(data.mainDialog).to.equal("");
      expect(data.dialogs).to.equal([]);
      expect(data.nlpModels).to.equal([]);
    });

    it('should save an app containing data to the server', async function () {
      app.dialogs = [];
      app.nlpModels = [];
      app.mainDialog = "";

      mainDialog = new Dialog({
        name: 'MainDialog'
      });

      mainDialog.onIntent('hello', async function(session) {
        await session.respond('Hello there!');
      })

      childDialog = new Dialog({
        name: 'ChildDialog'
      });

      async function (session) {
x
      })
      app.addDialogs(mainDialog, childDialog);
    });



  });
});
