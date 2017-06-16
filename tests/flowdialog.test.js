import {expect} from 'chai';

import FlowDialog, {
  isFlow, isFlowCommand, isAction, isActionable,
  isCommandType, isActionType, isMessageType,
  inferCommandType, inferActionType,
  normalizeFlow, normalizeAction,
  normalizeActions} from '../src/flowdialog';

describe('FlowDialog definitions', function () {
  context('inferCommandType', function () {
    it('should be "text" if only text field is present', function () {
      expect(inferCommandType({text:'hello'})).to.equal('text');
    });
    it('should be "image" if mediaUrl key is present', function () {
      expect(inferCommandType({mediaUrl:'http://a.com/img.png'})).to.equal('image');
      expect(inferCommandType({text:'hi', mediaUrl:'http://a.com/img.png'})).to.equal('image');
    });
    it('should be falsey if neither mediaUrl or text are present', function () {
      expect(inferCommandType({actions:[]})).to.be.falsey;
      expect(inferCommandType({items:[]})).to.be.falsey;
    });
  });

  context('isCommandType', function () {
    it('should be true when the type is a command type', function () {
      ['wait','list','carousel','text','image'].forEach(type=>
        expect(isCommandType(type)).to.be.ok
      );
    });

    it('should be falsey for non-command types', function () {
      ['postback','reply',[],1].forEach(type=>
        expect(isCommandType(type)).to.be.falsey
      );
    });
  });

  context('isActionType', function () {
    it('should be true if the type is an action type', function () {
      ['reply','buy','postback','locationRequest','link','share'].forEach(type=>
        expect(isActionType(type)).to.be.ok
      );
    });
    it('should be false if the type is not an action type', function () {
      ['list', 'carousel','image',[],123].forEach(type=>
        expect(isActionType(type)).to.be.falsey
      );
    });
  });

  context('isMessageType', function () {
    it('should be true if type is one of the message types', function () {
      ['list','carousel','text','image'].forEach(type=>
        expect(isMessageType(type)).to.be.true
      );
    });
    it('should be false for "wait"', function () {
      expect(isMessageType("wait")).to.be.false;
    });

  });

  context('inferActionType', function () {
    it('should be "link" if uri key is present', function () {
      expect(inferActionType({uri:'http://...'})).to.be.ok;
    });
    it('should infer the default type when then or thenFlow is provided', function () {
      expect(inferActionType({then:[]}, 'postback')).to.equal('postback');
      expect(inferActionType({thenFlow:"a.b.c"}, 'postback')).to.equal('postback');
    });
  });

  context('isFlowCommand', function() {
    it('should be true if obj is a function', function () {
      expect(isFlowCommand((session, path, args)=>[session,path,args])).to.be.true;
    });
    it('should be true if obj is a string', function () {
      expect(isFlowCommand("hello")).to.be.true;
    });
  });

  context('isFlow', function () {
    it('should be true for array arg', function () {
      expect(isFlow([])).to.be.ok;
    });
    it('should be true for a function arg', function () {
      expect(isFlow((session, path, args)=>[session,path,args])).to.be.true;
    });
    it('should be true for a string', function () {
      expect(isFlow("this is a message")).to.be.ok;
    });
    it('should be true for objects with flow command type', function () {
      expect(isFlow({type:'text', text:'hello'})).to.be.ok;
      expect(isFlow({type:'list', items:[]})).to.be.ok;
      expect(isFlow({type:'carousel', items:[]})).to.be.ok;
    });
    it('should be true for objects where flow command type can be inferred', function () {
      expect(isFlow({text:'this is a message'})).to.be.ok;
      expect(isFlow({mediaUrl:'http://...'})).to.be.ok;
    });
  });

  context('isAction', function() {
    it('should be true for object with an action type', function () {
      ['reply','postback','buy','share','link','locationRequest'].forEach(type=>
        expect(isAction({type})).to.be.ok
      );
    });
    it('should be true for objects with an infered action type', function () {
      expect(isAction({amount:100})).to.be.ok;
      expect(isAction({uri:'http://...'})).to.be.ok;
    });
    it('should be true for objects with the default infered action type', function () {
      expect(isAction({then:['a message']})).to.be.ok;
      expect(isAction({thenFlow:'somepath'})).to.be.ok;
    });
  });

  context('isActionable', function () {
    it('should be true for if arg is a flow', function () {
      expect(isActionable("hello")).to.be.ok;
      expect(isActionable(["hello"])).to.be.ok;
    });
    it('should be true for action objects', function () {
      expect(isActionable({type:'postback'})).to.be.ok;
    });
    it('should be true for inferred actions', function () {
      expect(isActionable({amount:100})).to.be.ok;
      expect(isActionable({then:"hi"})).to.be.ok;
    });
  });
});

describe('FlowDialog normalization', function () {
  context('normalizeAction', function () {
    it('should convert a flow into an action object where text is the id and defaultType is the action type', function () {
      expect(normalizeAction('the-id','this is a message', 'reply')).to.deep.equal({
        id: 'the-id',
        text: 'the-id',
        type: 'reply',
        then: [{type:'text', text:'this is a message'}]
      });
      expect(normalizeAction('the-id',{text:'this is a message'}, 'reply')).to.deep.equal({
        id: 'the-id',
        text: 'the-id',
        type: 'reply',
        then: [{type:'text', text:'this is a message'}]
      });
      expect(normalizeAction('the-id',{type:'wait', seconds:5}, 'reply')).to.deep.equal({
        id: 'the-id',
        text: 'the-id',
        type: 'reply',
        then: [{type:'wait', seconds:5}]
      });
    });
    it('should return an action containing the provided id if none is provided in the action', function () {
      expect(normalizeAction('the-id', {text:'hi',type:'postback'})).to.deep.equal({
        id: 'the-id',
        text: 'hi',
        type: 'postback'
      });
      expect(normalizeAction('the-id', {id:'existing-id', text:'hi',type:'postback'})).to.deep.equal({
        id: 'existing-id',
        text: 'hi',
        type: 'postback'
      });
    });
    it('should return an action where id is used for text if text is not provided', function () {
      expect(normalizeAction('the-id', {id:'existing-id', type:'link'})).to.deep.equal({
        id:'existing-id',
        text:'the-id',
        type:'link'
      });
      expect(normalizeAction('the-id', {id:'existing-id', text:'provided-text', type:'link'})).to.deep.equal({
        id:'existing-id',
        text:'provided-text',
        type:'link'
      });
    });
    it('should return an action containing no text, if type is share', function () {
      expect(normalizeAction('the-id', {type:'share'})).to.deep.equal({
        id:'the-id',
        type:'share'
      });
      expect(normalizeAction('the-id', {id:'provided-id', type:'share'})).to.deep.equal({
        id:'provided-id',
        type:'share'
      });
    });

  });

  context('normalizeActions', function () {
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
        purchase: { amount: 1000 },
      })).to.deep.equal([
        { id:'purchase', type:'buy', text:'purchase', amount:1000 }
      ]);
    });

    it('should infer a link action when uri is provided', function () {
      expect(normalizeActions({
        google: { uri: 'http://google.com' },
      })).to.deep.equal([
        {
          id:'google',
          text:'google',
          type:'link',
          uri:'http://google.com' }
      ]);
    });

    context('should infer the defaultType', function () {
      it('when then is provided', function () {
        expect(normalizeActions({
          yes: { then: ["another","flow"] },
        }, 'postback')).to.deep.equal([
          { id:'yes', text:'yes', type:'postback', then:["another","flow"] }
        ]);

        // also sanity-check that text does not get overwritten by id
        expect(normalizeActions({
          yes: { text: 'oh yes!', then: ["another","flow"] },
        }, 'postback')).to.deep.equal([
          {
            id:'yes',
            text:'oh yes!',
            type:'postback',
            then:["another","flow"]
          }
        ]);
      });

      it('when thenFlow is provided', function () {
        expect(normalizeActions({
          a: { thenFlow: ["id2","id2"] },
        }, 'postback')).to.deep.equal([
          {
            id:'a',
            text:'a',
            type:'postback',
            thenFlow: ["id2","id2"]
          }
        ]);
      });
    });
  });

  context('normalizeFlow', function () {
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
});

describe('FlowDialog', function () {
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
    it('should return a handler which calls a session with message command parameters', async function() {
      var sendParams = [];
      var fakeSession = {send(params) { sendParams.push(params); }};
      var dialog = new FlowDialog({name:"TestFlowDialog", flows: {}});
      var path = ['start'];
      var handler = dialog._compileFlow(["say a","say b","say c"],path);
      expect(handler).to.be.a.function;
      await handler({}, fakeSession);
      expect(sendParams).to.deep.equal([
        {type:'text',text:'say a'},
        {type:'text',text:'say b'},
        {type:'text',text:'say c'}
      ]);
    });

    it('should return a handler which takes a session as argument', async function() {
      var events = [];
      var fakeSession = {
        push(path, vars) { events.push({path, vars}); }
      };
      var dialog = new FlowDialog({name:"TestFlowDialog", flows: {}});
      var handler = dialog._compileFlow(
        (vars, session, path)=> {session.push(path, vars);}
      , ['compiledPath']);
      await handler({a:1}, fakeSession, ['providedPath']);
      expect(events).to.deep.equal([
        {path:['compiledPath'], vars:{a:1}}
      ]);
    });

    context('when provided a flow with hierarchical actions', function () {
      var fakeSession;
      var events;
      var dialog;
      var handler;
      beforeEach(async function () {
        events = [];
        fakeSession = { send(params) { events.push(params); }};
        dialog = new FlowDialog({name:"TestFlowDialog", flows: {}});
        handler = dialog._compileFlow(
          [
            "Greetings!",
            {
              type:'text',
              text:'Is this what you want?',
              actions: {
                yes: [
                  "Great!",
                  {
                    text:"Would you like anything else?",
                    actions: {
                      yes: ["Awesome!", {finish:"want something else"}],
                      no: ["Oh poo", {finish:"doesn't want something else"}]
                    }
                  }
                ],
                no: ["Oh, that's too bad!", {finish:"not what I want"}],
                askAgain: {
                  text: 'ask again',
                  then: [
                    (vars, session, path) => {
                      session.push("askAgain", path, vars);
                    },
                    {
                      start:"FirstChildDialog",
                      then: {
                        start:({value})=>["SecondChildDialog",{value}]

                      }
                    }
                  ]
                }
              }
            }
          ],
          ['start']
        );
        await handler({}, fakeSession);
      });

      it('the handler should run the top level commands', function () {
        expect(events).to.deep.equal([
          { type: 'text', text: 'Greetings!' },
          {
            type: 'text',
            text: 'Is this what you want?',
            actions: [
              {
                type: 'reply',
                text: 'yes',
                payload: 'TestFlowDialog:start.yes'
              },
              {
                type: 'reply',
                text: 'no',
                payload: 'TestFlowDialog:start.no'
              },
              {
                type: 'reply',
                text: 'ask again',
                payload: 'TestFlowDialog:start.askAgain'
              }
            ]
          }
        ]);
      });

      it('the dialog should have the expected postback and payload handlers', function (){
        expect(dialog.inputHandlers).to.deep.equal([
          {payload:'TestFlowDialog:start|no'},
          {payload:'TestFlowDialog:start|yes'}
        ]);
      });
    });
  });
});
