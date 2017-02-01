import {expect} from 'chai';
import dotEnv from 'dotEnv';
import rp from 'request-promise';

import {App, Session, Dialog, NLPModel, Client, log} from '..';

dotEnv.load();

async function query(op, vars) {
  // check app data
  var client = new Client(
    process.env.DEEPDIALOG_TEST_APPID,
    process.env.DEEPDIALOG_TEST_APPSECRET
  );

  var result = await client.query(op, vars);
  return result;
}

async function queryApp() {
  // check app data
  return await query(`{
    app {
      id accessToken webhook mainDialog
      dialogs { name startHandler resultHandlers { dialog tag } defaultHandler nlpInputHandlers { intent } nlpModelName }
      nlpModels { name provider accessId accessToken }
    }
  }`);
}

async function queryEndpointConfiguration(endpointType, appKeyId) {
  return await query(`($id: String) {
    app {
      endpointConfigurations(id: $id) {
        endpointType appKeyId appKeySecret webhookSecret
      }
    }
  }`, {endpointType: endpointType, appKeyId: appKeyId});
}

async function postJSON(webhook, data) {
  var options = {
    uri: webhook,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify(data)
  };

  var result = await rp(options);

  return JSON.parse(result);
}

describe('Feature test', function () {


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
      app.resultHandlers = [];
      app.startHandler = null;
      app.defaultHandler = null;
      app.mainDialog = '';
      app.domain = null;
      app.https = false;

      await app.save();
      log.info('Saved blank app');
    });

    it('should save empty fields on the server', async function () {
      await app.save();

      var data = await queryApp();
      expect(data.app.id).to.equal(process.env.DEEPDIALOG_TEST_APPID);
      expect(data.app.mainDialog).to.equal(null);
      expect(data.app.webhook).to.equal(null);
      expect(data.app.dialogs).to.deep.equal([]);
      expect(data.app.nlpModels).to.deep.equal([]);
    });

    it('should save multiple dialogs and nlpModels to the server', async function () {
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

      mainDialog.onStart(async function(session) {
        await session.respond("Welcome to the main dialog");
      });

      mainDialog.onIntent('hello', async function(session, {entities}) {
        await session.respond(`Hello there, ${entities.name}!`);
      });

      mainDialog.onIntent('hello2', async function(session, {entities}) {
        await session.respond(`Hello there, ${entities.name}!`);
      });

      mainDialog.onResult('ChildDialog', 'result_tag', async function(session, result) {
        await session.respond(`The result from ChildDialog is ${JSON.stringify(result)}`);
      });

      mainDialog.onDefault(async function(session) { // eslint-disable-line
      });

      childDialog = new Dialog('ChildDialog');
      childDialog.nlpModelName = 'childNLP';

      childDialog.onIntent('buy_tickets', async function (session, {entities}) {
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
        name: 'MainDialog', nlpModelName: 'mainNLP',
        startHandler: true,
        resultHandlers: [{dialog:'ChildDialog', tag: 'result_tag'}],
        nlpInputHandlers: [{ intent: 'hello' }, { intent: 'hello2'}],
        defaultHandler: true
      });

      expect(d2).to.deep.equal({
        name: 'ChildDialog', nlpModelName: 'childNLP',
        startHandler: false,
        defaultHandler: false,
        resultHandlers: [],
        nlpInputHandlers: [{ intent: 'buy_tickets' }]
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

  context('endpoints', function () {
    it('endpointConfigurationUpdate updates the endpoint', async function () {
      var app = new App({
        appId: process.env.DEEPDIALOG_TEST_APPID,
        appSecret: process.env.DEEPDIALOG_TEST_APPSECRET
      });

      await app.endpointConfigurationUpdate({
        endpointType: 'smooch',
        appKeyId: 'appKeyId1',
        appKeySecret: 'appKeySecret1',
        webhookSecret: 'webhookSecret1'
      });

      var result = await queryEndpointConfiguration('smooch', 'appKeyId1');

      expect(result.endpointType).to.equal('smooch');
      expect(result.appKeyId).to.equal('appKeyId1');
      expect(result.appKeySecret1).to.equal('appKeySecret1');
      expect(result.webhookSecret).to.equal('webhookSecret1');

      await app.endpointConfigurationUpdate({
        endpointType: 'smooch',
        appKeyId: 'appKeyId1',
        appKeySecret: 'appKeySecret2',
        webhookSecret: 'webhookSecret2'
      });

      var result2 = await queryEndpointConfiguration('smooch', 'appKeyId1');

      expect(result2.endpointType).to.equal('smooch');
      expect(result2.appKeyId).to.equal('appKeyId1');
      expect(result2.appKeySecret1).to.equal('appKeySecret2');
      expect(result2.webhookSecret).to.equal('webhookSecret2');
    });

    it('endpointConfigurationDelete deletes the endpoint', async function () {
      var app = new App({
        appId: process.env.DEEPDIALOG_TEST_APPID,
        appSecret: process.env.DEEPDIALOG_TEST_APPSECRET
      });

      var config = await app.endpointConfigurationUpdate({
        endpointType: 'smooch',
        appKeyId: 'appKeyId1',
        appKeySecret: 'appKeySecret1',
        webhookSecret: 'webhookSecret1'
      });

      await app.endpointConfigurationDelete(config.id);

      expect(app.endpointConfigurationGet('smooch'));

    });
  });

  context('events', function () {
    var app;
    var mainNLP, childNLP;

    beforeEach(function() {
      app = new App({
        appId: process.env.DEEPDIALOG_TEST_APPID,
        appSecret: process.env.DEEPDIALOG_TEST_APPSECRET
      });
      app.domain = "localhost";
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
      app.addNLPModels(mainNLP, childNLP);
    });

    it('should correctly handle the frame_start event with onStart handler', async function() {
      var mainDialog;

      mainDialog = new Dialog('MainDialog');

      var session, raw;
      mainDialog.onStart((s, r) => { session = s; raw = r; });
      app.addDialogs(mainDialog);

      await app.server.start(1234);

      var notification = {
        event: 'frame_start',
        session: {
          id: 'session-id',
          globals: {GlobalVar:1},
          stack: [{ dialog: 'MainDialog', locals:{localVar:2}}]
        }
      };

      await postJSON('http://localhost:1234',{
        notifications: [notification]
      });
      app.server.stop();

      expect(session).to.be.an.instanceof(Session);
      expect(session.id).to.equal('session-id');
      expect(session.globals).to.deep.equal({GlobalVar:1});
      expect(session.locals).to.deep.equal({localVar:2});
      expect(raw).to.deep.equal(notification);

    });

    it('should correctly handle the frame_input event with onIntent handler', async function () {
      var mainDialog;

      mainDialog = new Dialog('MainDialog');

      var session, entities, raw;
      mainDialog.onIntent('hello', (s, e, r) => { session = s; entities=e; raw=r; });
      app.addDialogs(mainDialog);

      await app.server.start(1234);

      var notification = {
        event: 'frame_input',
        inputType: 'nlp',
        data: { intent: 'hello', entities: { name: 'Bob' }},
        session: {
          id: 'session-id',
          globals: {GlobalVar:1},
          stack: [{ dialog: 'MainDialog', locals:{localVar:2}}]
        }
      };

      await postJSON('http://localhost:1234',{
        notifications: [notification]
      });
      app.server.stop();

      expect(session).to.be.an.instanceof(Session);
      expect(session.id).to.equal('session-id');
      expect(entities).to.deep.equal({name: 'Bob'});
      expect(raw).to.deep.equal(notification);

    });

    it('should correctly handle the frame_result event with onResult handler', async function () {
      var mainDialog;

      mainDialog = new Dialog('MainDialog');

      var session, result, raw;
      mainDialog.onResult('HelloDialog', 'resultTag', (s, r1, r2) => { session = s; result=r1; raw=r2; });
      app.addDialogs(mainDialog);

      await app.server.start(1234);

      var notification = {
        event: 'frame_result',
        data: { intent: 'hello', entities: { name: 'Bob' }},
        session: {
          id: 'session-id',
          globals: {GlobalVar:1},
          stack: [{ dialog: 'MainDialog', locals:{localVar:2}}],
          completedFrame: [{
            id: 'competedFrameId',
            dialog: 'HelloDialog',
            tag: 'resultTag',
            result: { abc:123}
          }],

        }
      };

      await postJSON('http://localhost:1234',{
        notifications: [notification]
      });

      app.server.stop();


      expect(session).to.be.an.instanceof(Session);
      expect(session.id).to.equal('session-id');
      expect(result).to.deep.equal({abc:123});
      expect(raw).to.deep.equal(notification);

    });

    it('should correctly handle the frame_default event with onDefault handler', async function () {
      var mainDialog;

      mainDialog = new Dialog('MainDialog');

      var session, raw;
      mainDialog.onDefault((s, r) => { session = s; raw=r; });
      app.addDialogs(mainDialog);

      await app.server.start(1234);

      var notification = {
        event: 'frame_default',
        data: { intent: 'hello', entities: { name: 'Bob' }},
        session: {
          id: 'session-id',
          globals: {GlobalVar:1},
          stack: [{ dialog: 'MainDialog', locals:{localVar:2}}]
        }
      };

      await postJSON('http://localhost:1234',{
        notifications: [notification]
      });

      app.server.stop();

      expect(session).to.be.an.instanceof(Session);
      expect(session.id).to.equal('session-id');
      expect(raw).to.deep.equal(notification);

    });
  });
});
