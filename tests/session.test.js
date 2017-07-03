import {expect} from 'chai';

import {Session, App, Dialog} from '../src';

describe('Session', function () {
  context('Constructor', function () {
    var session;
    var app;

    before(function() {
      app = new App({});
      app.addDialogs(new Dialog({name: 'theDialog'}));
      session = new Session({
        app: app,
        id: 'session-id',
        globals: { Global: 1},
        currentFrame: {
          id: 'frame-id',
          dialog: 'theDialog',
          tag: 'theTag',
          locals: { local: 2}
        }
      });
    });

    it('should set the id', function () {
      expect(session.id).to.equal('session-id');
    });

    it('should set globals', function () {
      expect(session.globals).to.deep.equal({Global:1});
    });

    it('should set dialog', function () {
      expect(session.dialogName).to.equal('theDialog');
      expect(session.dialog).to.be.an.instanceof(Dialog);
      expect(session.dialog.name).to.equal('theDialog');
    });

    it('should set tag', function () {
      expect(session.tag).to.equal('theTag');
    });

    it('should set locals', function () {
      expect(session.locals).to.deep.equal({local:2});
    });

    it('should set the frameId', function() {
      expect(session.frameId).to.equal('frame-id');
    });

    it('should fail if id is missing', function () {
      expect(()=>{ new Session({app: app, globals:{}, currentFrame:{}}); }).to.throw(Error);
    });

    it('should fail if id is missing', function () {
      expect(()=>{ new Session({app: app, globals:{}, currentFrame:{}}); }).to.throw(Error);
    });

    it('should fail if client is not a Client instance', function () {
      expect(()=>{ new Session("not a client inst", {id: '123', globals:{}, currentFrame: {}}); }).to.throw(Error);
    });

  });

  context('variables', function () {
    var session;
    beforeEach(function() {
      var app = new App({});
      session = new Session({app: app,
        id: 'session-id',
        globals: { Global: 1},
        currentFrame: {
          dialog: 'theDialog',
          tag: 'theTag',
          locals: { local: 2}
        }
      });
    });

    it('should get a local var', function () {
      expect(session.get('local')).to.equal(2);
    });

    it('should get a global var', function() {
      expect(session.get('Global')).to.equal(1);
    });

    it('should set a single lowercase var as a local', function () {
      session.set('newvar', 'new');
      expect(session.locals.newvar).to.equal('new');
    });

    it('should set a single uppercase var as a global', function () {
      session.set('NewVar', 'NEW');
      expect(session.globals.NewVar).to.equal('NEW');
    });

    it('should set the keys and values of an object as local and global vars', function () {
      session.set({Global1:1, local1:1, Global2:2, local2:2});
      expect(session.locals).to.deep.equal({local:2, local1:1, local2:2});
      expect(session.globals).to.deep.equal({Global:1, Global1:1, Global2:2});
    });

    it('should set a single local var and value, when given two args', function() {
      session.set('local3',3);
      expect(session.locals.local3).to.equal(3);
    });

    it('should set a single global var and value, when given two args', function() {
      session.set('Global3',3);
      expect(session.globals.Global3).to.equal(3);
    });
  });

});
