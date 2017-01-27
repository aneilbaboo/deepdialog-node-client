import {expect} from 'chai';
import dotEnv from 'dotEnv';

import {App, Dialog, NLPModel, Client, log} from '..';

dotEnv.load();

async function queryApp() {
  // check app data
  var client = new Client(
    process.env.DEEPDIALOG_TEST_APPID,
    process.env.DEEPDIALOG_TEST_APPSECRET
  );

  var app = await client.query(`{
    app {
      id accessToken webhook mainDialog
      dialogs { name patterns { intent } nlpModelName }
      nlpModels { name provider accessId accessToken }
    }
  }`);
  return app;
}

describe('Feature tests', function () {


  context('App', function () {
    var app;
    var mainDialog, childDialog;
    var mainNLP, childNLP;

    beforeEach(async function() {
      app = new App({
        appId: process.env.DEEPDIALOG_TEST_APPID,
        appSecret: process.env.DEEPDIALOG_TEST_APPSECRET
      });
      app.dialogs = [];
      app.nlpModels = [];
      app.mainDialog = '';
      app.domain = null;
      app.https = false;

      await app.save();
      log.info('Saved blank app');
    });

    it('should save an empty app with the server', async function () {
      await app.save();

      var data = await queryApp();
      expect(data.app.id).to.equal(process.env.DEEPDIALOG_TEST_APPID);
      expect(data.app.mainDialog).to.equal(null);
      expect(data.app.webhook).to.equal(null);
      expect(data.app.dialogs).to.deep.equal([]);
      expect(data.app.nlpModels).to.deep.equal([]);
    });

    it('should save an app containing data to the server', async function () {
      app.domain = "mydialogserver.com";
      app.mainDialog = 'MainDialog';

      mainNLP = new NLPModel({
        name: 'mainNLP',
        provider: 'apiai',
        accessId: 'testAppIdMain',
        accessToken: 'testAccessTokenMain'
      });

      childNLP = new NLPModel({
        name: 'childNLP',
        provider: 'apiai',
        accessId: 'testAppIdChild',
        accessToken: 'testAccessTokenChild'
      });

      mainDialog = new Dialog('MainDialog');
      mainDialog.nlpModelName = 'mainNLP';

      mainDialog.onIntent('hello', async function(session) {
        await session.respond('Hello there!');
      });

      childDialog = new Dialog('ChildDialog');
      childDialog.nlpModelName = 'childNLP';

      childDialog.onIntent('buy_tickets', async function (session, entities) {
        await session.respond(`Ok, that's great, let's get you some ${entities.ticket_type} tickets.`);
      });

      log.info("Adding dialogs... %j %j", mainDialog, childDialog);
      app.addDialogs(mainDialog, childDialog);
      app.addNLPModels(mainNLP, childNLP);
      await app.save();

      // check the result directly on the server

      var data = await queryApp();
      expect(data).to.be.ok;
      expect(data.app.id).to.equal(process.env.DEEPDIALOG_TEST_APPID);
      expect(data.app.accessToken).to.equal(process.env.DEEPDIALOG_TEST_APPSECRET);
      expect(data.app.webhook).to.equal('http://mydialogserver.com/');

      expect(data.app.dialogs).to.be.an('array');
      expect(data.app.dialogs.length).to.equal(2);

      var d1, d2;
      if (data.app.dialogs[0].name=='MainDialog') {
        [d1, d2] = data.app.dialogs;
      } else {
        [d2, d1] = data.app.dialogs;
      }

      expect(d1).to.deep.equal({
        name: 'MainDialog', nlpModelName: 'mainNLP' , patterns: [{ intent: 'hello' }]
      });
      expect(d2).to.deep.equal({
        name: 'ChildDialog', nlpModelName: 'childNLP' , patterns: [{ intent: 'buy_tickets' }]
      });

      var n1, n2;
      if (data.app.nlpModels[0].name=='mainNLP') {
        [n1, n2] = data.app.nlpModels;
      } else {
        [n2, n1] = data.app.nlpModels;
      }

      expect(n1).to.deep.equal({
        name: 'mainNLP', provider: 'apiai', accessId: 'testAppIdMain', accessToken: 'testAccessTokenMain'
      });

      expect(n2).to.deep.equal({
        name: 'childNLP', provider: 'apiai', accessId: 'testAppIdChild', accessToken: 'testAccessTokenChild'
      });
    });

  });
});
