import {expect} from 'chai';

import FlowDialog, {
  normalizeFlow,
  normalizeFlows,
  normalizeActions} from '../src/flowdialog';

describe.only('FlowDialog', function () {
  context('constructor', function () {
    it('should have an onStart handler when provided a flow named start', function () {
      var dialog = new FlowDialog({
        name:"TestFlowDialog",
        flows: {
          start: [ {type: "text", text: "hello" } ]
        }
      });

      expect(dialog.startHandler).is.ok;
    });
  });

  context('_compileFlow', function() {
    it('should return a handler which calls a session with message command parameters', function() {
      var sendParams = [];
      var fakeSession = {send(params,path,args) { sendParams.push([params,path,args]); }};
      var dialog = new FlowDialog({name:"TestFlowDialog", flows: {}});
      var path = ['start'];
      var handler = dialog._compileFlow(["a","b","c"],path);
      expect(handler).to.be.a.function;
      handler(fakeSession);
      expect(sendParams).to.deep.equal([
        [{type:'text',text:'a'},['start'],null],
        [{type:'text',text:'b'},['start'],null],
        [{type:'text',text:'b'},['start'],null]
      ]);
    });

    it('should return a handler which takes a session as argument', function() {
      var sendParams = [];
      var fakeSession = {send(params,path,args) { sendParams.push([params,path,args]); }};
      var dialog = new FlowDialog({name:"TestFlowDialog", flows: {}});
      var handler = dialog._compileFlow(["a","b","c"],[]);
      handler(fakeSession);
      expect(sendParams).to.deep.equal([
        [{type:'text',text:'a'},[],null],
        [{type:'text',text:'b'},[],null],
        [{type:'text',text:'b'},[],null]
      ]);
    });

    context('when provided a flow with hierarchical actions', function () {
      var fakeSession;
      var events;
      var dialog;
      var handler;
      beforeEach(function () {
        events = [];
        fakeSession = {send(params,path,args) { events.push([params,path,args]); }};
        dialog = new FlowDialog({name:"TestFlowDialog", flows: {}});
        handler = dialog._compileFlow([
          "Greetings",
          {
            type:'text',
            text:'Is this what you want?',
            actions: {
              yes: [
                "Great!",
                {
                  text:"Would you like anything else?",
                  actions: {
                    yes: "Awesome!",
                    no: "Oh poo"
                  }
                }
              ],
              no: "Oh, that's too bad!",
              askAgain: {
                type:'postback',

              }
            }
          }
        ]);
      });

      it('should return a function which runs the top level commands', function () {
        handler(fakeSession);
        expect(events).to.deep.equal({

        });
      });
    });
  });

});

describe('normalizeFlow', function () {
  it('should convert a strings into a single message command', function () {
    expect(normalizeFlow("a")).to.deep.equal([
      {type:'text', text:'a'}
    ]);
  });

  it('should convert a list of strings into message commands', function () {
    expect(normalizeFlow(["a","b","c"])).to.deep.equal([
      {type:'text', text:'a'},
      {type:'text', text:'b'},
      {type:'text', text:'c'}
    ]);
  });

  it('should convert a command into an array containing the command', function () {
    expect(normalizeFlow({type:'text', text:'a'})).to.deep.equal([
      {type:'text', text:'a'}
    ]);
  });

  it('should infer image type when mediaUrl is provided', function () {
    expect(normalizeFlow({mediaUrl:'http://imgur.com/someImage.jpg'})).to.deep.equal([
      {type:'image', mediaUrl:'http://imgur.com/someImage.jpg'}
    ]);
  });

  it('should infer text type when text is provided', function () {
    expect(normalizeFlow({text:'hello'})).to.deep.equal([
      {type:'text', text:'hello'}
    ]);
  });
});

describe('normalizeActions', function () {
  it('should convert an object containing named actions into the equivalent array', function () {
    expect(normalizeActions({
      a: { type: 'postback', text:'textA' },
      b: { type: 'reply', text:'textB' }
    })).to.deep.equal([
      { id:'a', type:'postback', text:'textA' },
      { id:'b', type:'reply', text:'textB' }
    ]);
  });

  it('should use the id of the action if text is not provided, except for share type', function () {
    expect(normalizeActions({
      a: { type: 'postback' },
      b: { type: 'share' }
    })).to.deep.equal([
      { id:'a', type:'postback', text:'a' },
      { id:'b', type:'share' }
    ]);
  });

  it('should infer a buy action when amount is provided', function () {
    expect(normalizeActions({
      a: { amount: 1000 },
    })).to.deep.equal([
      { id:'a', type:'buy', amount:1000 }
    ]);
  });

  it('should infer a link action when uri is provided', function () {
    expect(normalizeActions({
      a: { uri: 'http://google.com' },
    })).to.deep.equal([
      { id:'a', type:'link', uri:'http://google.com' }
    ]);
  });

  context('should infer the defaultType', function () {
    it('when exec is provided ', function () {
      expect(normalizeActions({
        a: { exec: "SomeFunction" },
      }, 'reply')).to.deep.equal([
        { id:'a', type:'reply', exec:"SomeFunction" }
      ]);
    });

    it('when then is provided', function () {
      expect(normalizeActions({
        a: { then: ["another","flow"] },
      }, 'postback')).to.deep.equal([
        { id:'a', type:'postback', then:["another","flow"] }
      ]);
    });

    it('when thenPath is provided', function () {
      expect(normalizeActions({
        a: { thenPath: ["id2","id2"] },
      }, 'postback')).to.deep.equal([
        { id:'a', type:'postback', thenPath: ["id2","id2"] }
      ]);
    });
  });
});

describe('', function () {

});
