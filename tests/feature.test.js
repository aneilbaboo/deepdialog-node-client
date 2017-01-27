import {expect} from 'chai';

import {App, Dialog, NLPModel} from '..';

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

      mainNLP = new NLPModel({
        name: 'mainNLP',
        provider: 'apiai',
        accessToken: process.env.APIAI_TEST_MAINNLP_ACCESS_TOKEN
      });

      childNLP = new NLPModel({
        name: 'childNLP',
        provider: 'apiai',
        accessToken: process.env.APIAI_TEST_CHILDNLP_ACCESS_TOKEN
      });

      mainDialog = new Dialog({
        name: 'MainDialog',
        nlpModelName: 'mainNLP'
      });

      mainDialog.onIntent('hello', async function(session) {
        await session.respond('Hello there!');
      });

      childDialog = new Dialog({
        name: 'ChildDialog',
        nlpModelName: 'childNLP'
      });

      childDialog.onIntent('buy_tickets', async function (session, entities) {
        await session.respond(`Ok, that's great, let's get you some ${entities.ticket_type} tickets.`);
      });

      app.addDialogs(mainDialog, childDialog);
      app.addNLPModels(mainNLP, childNLP);
      await app.save();
    });



  });
});
