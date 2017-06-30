import {expect} from 'chai';
import sinon from 'sinon';
var util = require('../src/util'); // need to stub the module

import {anyPattern} from '../src/constants';
import FlowDialog, {
  isFlow, isFlowCommand, isAction, isActionable,
  isCommandType, isActionType, isMessageType,
  isExecCommand,
  inferCommandType, inferActionType,
  normalizeFlow, normalizeAction, normalizeExecCommand,
  normalizeActions, normalizeMessageCommand,
  isValidFlowId, appendFlowPathId, flowPathFromKey,
  flowIdToText, zipPromisesToHash
} from '../src/flowdialog';

describe('FlowScript', function () {
  var sandbox;

  beforeEach(function () {
    sandbox = sinon.sandbox.create();
  });

  afterEach(function () {
    sandbox.restore();
  });

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
      it('should be "start" if "start" key is present', function () {
        expect(inferCommandType({start:"MyDialog"})).to.equal('start');
      });
      it('should be "finish" if "finish" key is present', function () {
        expect(inferCommandType({finish:true})).to.equal('finish');
      });
      it('should be "wait" if "seconds" key is present', function () {
        expect(inferCommandType({wait:5})).to.equal("wait");
      });
      it('should be "conditional" if "if" key is present', function () {
        expect(inferCommandType({if:()=>{}})).to.equal("conditional");
      });
    });

    context('isExecCommand', function () {
      it('should be false for non-objects, but should not throw errors', function () {
        expect(isExecCommand(1)).to.be.false;
        expect(isExecCommand("hello")).to.be.false;
        expect(isExecCommand([1])).to.be.false;
      });
      it("should be false for objects which don't contain a handler key", function () {
        expect(isExecCommand({type:'hello'})).to.be.false;
      });
      it("should be true for objects which contain a handler key", function () {
        expect(isExecCommand({handler:'hello'})).to.be.false;
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

  describe('Flow path and ids', function () {
    context('isValidFlowId', function () {
      it('should be true for simple ids of word chars and underscore', function () {
        expect(isValidFlowId("a")).to.be.ok;
        expect(isValidFlowId("abcd")).to.be.ok;
        expect(isValidFlowId("_abcd")).to.be.ok;
        expect(isValidFlowId("1")).to.be.ok;
        expect(isValidFlowId("1234567890()!@$%^&*()_-=_+[]{}\\;abcdefghijklmnopqrstuvwxyz ABCDEFGHIJKLMNOPQRSTUVWXYZ<,>?/")).to.be.ok;
      });
      it('should be true for hash ids', function () {
        expect(isValidFlowId("#a")).to.be.ok;
        expect(isValidFlowId("#abcd")).to.be.ok;
        expect(isValidFlowId("#_abcd")).to.be.ok;
        expect(isValidFlowId("#1")).to.be.ok;
        expect(isValidFlowId("#1234567890()!@$%^&*()_-=_+[]{}\\;abcdefghijklmnopqrstuvwxyz ABCDEFGHIJKLMNOPQRSTUVWXYZ<,>?/")).to.be.ok;
      });
      it('should be false if a pipe character is present', function () {
        expect(isValidFlowId("a|b")).to.be.false;
      });
      it('should be false if a carriage return or line feed character is present', function () {
        expect(isValidFlowId("a\nb")).to.be.false;
        expect(isValidFlowId("a\rb")).to.be.false;
      });
      it('should be false for a single hash character', function () {
        expect(isValidFlowId("#")).to.be.false;
      });
      it('should be false if hash is present after the first character', function () {
        expect(isValidFlowId("a#a")).to.be.false;
      });
      it('should be false if the id contains a period', function () {
        expect(isValidFlowId("hello.there")).to.be.false;
      });
    });

    context('appendFlowPathId', function () {
      it('should join ids with a dot', function () {
        expect(appendFlowPathId(['a','b','c'],'d')).to.deep.equal(['a','b','c','d']);
        expect(appendFlowPathId([],'a')).to.deep.equal(['a']);
      });
      it('should throw an error if an invalid id is provided', function () {
        expect(()=>appendFlowPathId(['a'],'.b')).to.throw();
        expect(()=>appendFlowPathId(['a'],'b#a')).to.throw();
      });
      it('should reset the path when a hash id is provided', function () {
        expect(appendFlowPathId(['a','b','c'],"#d")).to.deep.equal(['#d']);
      });
    });

    context('flowPathFromKey', function () {
      it('should return a flow path given a relative flow path key', function () {
        expect(flowPathFromKey('a.b.c')).to.deep.equal(['a','b','c']);
      });
      it('should return a flow path given a dialog flow path key', function () {
        expect(flowPathFromKey('MyDialog:a.b.c')).to.deep.equal(['a','b','c']);
      });
      it('should raise an error if arg is not a string', function () {
        expect(()=>flowPathFromKey(['a','b'])).to.throw();
        expect(()=>flowPathFromKey(1)).to.throw();
      });
    });

    context('flowIdToText', function () {
      it('should strip the leading hash', function () {
        expect(flowIdToText('#abc')).to.equal('abc');
      });
      it('other strings should be returned without change', function () {
        expect(flowIdToText('abc')).to.equal('abc');
      });
    });
  });

  describe('FlowDialog normalization', function () {
    context('normalizeExecCommand', function () {
      it('should normalize an exec command with a string arg', function () {
        expect(normalizeExecCommand({exec:"handler"})).to.deep.equal({
          exec: ["handler", {}]
        });
      });
      it('should not transform an array arg', function () {
        expect(normalizeExecCommand({exec:['handler', {a:1}]})).to.deep.equal({
          exec: ["handler", {a:1}]
        });
      });
    });

    context('normalizeMessageCommand', function () {
      it('should convert actions in a list item into postback buttons', function () {
        expect(normalizeMessageCommand({
          type:'list',
          items: {
            first: {
              title: 'first item',
              actions: {
                button: {
                  text: 'push me',
                  then: "Hello!"
                }
              }
            }
          }
        })).to.deep.equal({
          type: 'list',
          items: [
            {
              id: 'first',
              title: 'first item',
              actions: [
                {
                  id: 'button',
                  text: 'push me',
                  type: 'postback',
                  then: 'Hello!'
                }
              ]
            }
          ]
        });
      });
    });

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

  describe('Command parameter expansion', function () {
    context("zipPromisesToHash", function () {
      it('should return a hash given keys and an array of promises', async function () {
        var fn = async (val) => val;
        expect(await zipPromisesToHash(
          ['a','b','c'],
          [fn(1),fn(2),fn(3)]
        )).to.deep.equal({
          a:1,b:2,c:3
        });
      });
    });

    context('expandCommandParam', function () {
      var dialog;

      beforeEach(function () {
        dialog = new FlowDialog({name: "TestFlowDialog"});
      });

      it('should evaluate a function with vars, session and path', async function () {
        var session ={
          async makeValue(vars, path) {
            return {vars,path};
          }
        };
        var valueHandler = async (vars, session, path)=>await session.makeValue(vars,path);
        var result = await dialog._expandCommandParam(
          valueHandler,
          {a:1},
          session,
          ['root','child']
        );

        expect(result).to.deep.equal(
          {vars: {a:1}, path:['root','child']}
        );
      });

      it('should return non-object, non-array, non-string, non-function params as is', async function () {
        expect(await dialog._expandCommandParam(123, {a:1}, "session", ['root'])).to.equal(123);
        expect(await dialog._expandCommandParam(null, {a:1}, "session", ['root'])).to.equal(null);
        expect(await dialog._expandCommandParam(undefined, {a:1}, "session", ['root'])).to.equal(undefined);
      });

      it('should return a rendered string, given a mustache template', async function () {
        expect(await dialog._expandCommandParam(
          "{{a}} {{b.c.d}}",
          {a:"hello", b:{c:{d:"there"}}},
          "session",
          ['root','child']
        )).to.equal("hello there");
      });

      it('should expand an non-async exec param', async function () {
        dialog._namedHandlers = {
          myAsyncHandler(vars, session, path) {
            return [vars, session, path];
          }
        };
        expect(await dialog._expandCommandParam({
          exec: 'myAsyncHandler'
        },
        {a:1},
        "the-session",
        ['onStart']
        )).to.deep.equal([
          {a:1},
          "the-session",
          ['onStart']
        ]);
      });

      it('should expand an async exec param', async function () {
        dialog._namedHandlers = {
          async myAsyncHandler(vars, session, path) {
            return [vars, session, path];
          }
        };
        expect(await dialog._expandCommandParam({
          exec: 'myAsyncHandler'
        },
        {a:1},
        "the-session",
        ['onStart']
        )).to.deep.equal([
          {a:1},
          "the-session",
          ['onStart']
        ]);
      });

      it('should expand items in a list', async function () {
        var session ={
          async makeValue(vars, path) {
            return {vars,path};
          }
        };

        expect(await dialog._expandCommandParam(
          [ null,
            "{{a}} {{b.c.d}}",
            async (vars, session, path)=>session.makeValue(vars,path),
            {template:"{{a}}"}
          ],
          {a:"hello", b:{c:{d:"there"}}},
          session,
          ['root'])
        ).to.deep.equal([
          null,
          "hello there",
          {vars:{a:"hello", b:{c:{d:"there"}}}, path:['root']},
          {template:"hello"}
        ]);
      });

      it('should expand an Object recursively', async function () {
        var session ={
          async makeValue(vars, path) {
            return {vars,path};
          }
        };

        dialog._namedHandlers = {
          async myHandler() { return "customHandlerResult"; }
        };

        expect(await dialog._expandCommandParam(
          {
            k1: "{{a}} {{b.c.d}}",
            k2: {
              k3: async (vars, session, path)=>session.makeValue(vars,path),
              k4: [{template:"{{a}}"},  "{{b.c.d}}"],
              k5: { exec: 'myHandler' }
            }
          },
          {a:"hello", b:{c:{d:"there"}}},
          session,
          ['root'])
        ).to.deep.equal({
          k1:"hello there",
          k2: {
            k3:{vars:{a:"hello", b:{c:{d:"there"}}}, path:['root']},
            k4: [{template:"hello"}, "there"],
            k5: "customHandlerResult"
          }
        });
      });

    });

  });


  describe('FlowDialog', function () {
    context('constructor', function () {
      it('should have an onStart handler when provided a flow named onStart', function () {
        var dialog = new FlowDialog({
          name:"TestFlowDialog",
          flows: {
            onStart: [ {type: "text", text: "hello" } ]
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

      context('when provided handlers', function () {
        it('should pass (vars, session, path) to a command handler', async function() {
          var events = [];
          var fakeSession = {
            push(path, vars) { events.push({path, vars}); }
          };
          var dialog = new FlowDialog({name:"TestFlowDialog", flows: {}});
          var handler = dialog._compileFlow(
            (vars, session, path)=> {session.push(path, vars);}
            , ['compiledPath']
          );
          await handler({a:1}, fakeSession, ['providedPath']);
          expect(events).to.deep.equal([
            {path:['compiledPath'], vars:{a:1}}
          ]);
        });

        it('should use the value provided by a handler for message.text', async function () {
          var events = [];
          var fakeSession = {
            async send(params) { events.push({send:params}); },
            async record(path, vars, value) {
              events.push({record:{path, vars}});
              return value;
            }
          };
          var dialog = new FlowDialog({name:"TestFlowDialog", flows: {}});
          var handler = dialog._compileFlow([
            {
              text: (vars, session, path) => fakeSession.record(path, vars, "dynamic-text")
            }
          ], ['compiledPath']);
          await handler({a:1}, fakeSession, ['providedPath']);
          expect(events.sort(jsonSort)).to.deep.equal([
            {send:{type:'text', text:'dynamic-text'}},
            {record: {path:['compiledPath'], vars:{a:1}}}
          ].sort(jsonSort));
        });

      });

      context('start command', function () {
        var session;
        var events;
        beforeEach(function () {
          events = [];
          session = {
            async start(dialog, args, tag) {
              events.push(dialog, args, tag);
            }
          };
        });

        it('should call session.start with the provided dialog', async function () {
          var dialog = new FlowDialog({name:"TestFlowDialog", flows: {}});

          var topLevelHandler = dialog._compileFlow([
            { start: "MyDialog" }
          ], ['onStart']);
          await topLevelHandler({}, session);
          expect(events).to.deep.equal(["MyDialog", undefined, undefined]);
        });

        it('should call session.start with the provided dialog and args', async function () {
          var dialog = new FlowDialog({name:"TestFlowDialog", flows: {}});

          var topLevelHandler = dialog._compileFlow([
            { start: ["MyDialog", {a:1}] }
          ], ['onStart']);
          await topLevelHandler({}, session);
          expect(events).to.deep.equal(["MyDialog", {a:1}, undefined]);
        });

        it('should call session.start with dynamically generated dialog and args', async function () {
          var dialog = new FlowDialog({name:"TestFlowDialog", flows: {}});

          var topLevelHandler = dialog._compileFlow([
            { start: async ()=>["MyDialog", {a:1}] }
          ], ['onStart']);
          await topLevelHandler({}, session);
          expect(events).to.deep.equal(["MyDialog", {a:1}, undefined]);
        });

        context('when it contains a then flow,', function () {
          var dialog;

          beforeEach(function () {
            dialog = new FlowDialog({name:"TestFlowDialog", flows: {}});
          });

          it('the dialog should install a result handler with the correct flow key ', function () {

            dialog._compileFlow([{
              start: ["MyDialog", {a:1}],
              then: async (vars, session, path) => {
                await session.push({push:{vars, path}});
              }
            }], [
              'a','b'
            ]);

            expect(Object.keys(dialog.resultHandlers)).to.deep.equal([
              "MyDialog|TestFlowDialog:a.b.start(MyDialog)"
            ]);
          });

          it('the dialog should install a result handler with the correct flow key '+
          ' when the dialog name is not known at compile time', function () {

            dialog._compileFlow([{
              start: ()=> ["MyDialog", {a:1}],
              then: async (vars, session, path) => {
                await session.push({push:{vars, path}});
              }
            }], [
              'a','b'
            ]);

            expect(Object.keys(dialog.resultHandlers)).to.deep.equal([
              `${anyPattern}|TestFlowDialog:a.b.start(?)`
            ]);
          });

          it('the dialog should install a result handler with the correct flow key '+
          ' when a user-specifies an id', function () {

            dialog._compileFlow([{
              id: "user-custom-id",
              start: ()=> ["MyDialog", {a:1}],
              then: async (vars, session, path) => {
                await session.push({push:{vars, path}});
              }
            }], [
              'a','b'
            ]);

            expect(Object.keys(dialog.resultHandlers)).to.deep.equal([
              `${anyPattern}|TestFlowDialog:a.b.user-custom-id`
            ]);
          });

          it('the result handler should call the then flow with the globals,'+
          ' locals and result value in vars', async function () {

            dialog._compileFlow([{
              start: ["MyDialog", {a:1}],
              then: async (vars, session, path) => {
                await session.push({push:{vars, path}});
              }
            }], [
              'a','b'
            ]);

            var resultHandler = dialog.getResultHandler('MyDialog|TestFlowDialog:a.b.start(MyDialog)');
            var session = {
              get globals() { return {A:1}; },
              get locals() { return {b:2}; },
              async push(params) { events.push(params); }
            };

            await resultHandler(session, "this_is_the_result");

            expect(events).to.deep.equal([
              {
                push:{
                  vars:{value:"this_is_the_result", A:1, b:2},
                  path: ['a','b', 'start(MyDialog)']
                }
              }
            ]);
          });
        });
      });

      context('set command', function () {
        it('should call session set with the literal argument to set', async function () {
          var session = { save: sinon.stub() };
          var dialog = new FlowDialog({name:"TestFlowDialog", flows: {}});

          var handler = dialog._compileFlow([
            {set:{b:1}}
          ], ['onStart']);
          await handler({}, session, []);
          expect(session.save.withArgs(
            sinon.match({b:1})
          ).calledOnce).to.be.true;
        });

        it('should call session set with the handler value to set', async function () {
          var session = { save: sinon.stub() };
          var dialog = new FlowDialog({name:"TestFlowDialog", flows: {}});

          var handler = dialog._compileFlow([
            {set:()=>({b:1})}
          ], ['onStart']);
          await handler({}, session, []);
          expect(session.save.withArgs(
            sinon.match({b:1})
          ).calledOnce).to.be.true;
        });

        it('should call session set, automatically generating objects in a path', async function () {
          var session = { save: sinon.stub() };
          var dialog = new FlowDialog({name:"TestFlowDialog", flows: {}});

          var handler = dialog._compileFlow([
            {set:()=>({"a.b.c":1, "a.b.d":2, "a.e":3 })}
          ], ['onStart']);
          await handler({}, session, []);
          expect(session.save.withArgs(
            sinon.match({a:{b:{c:1, d:2}, e:3}})
          ).calledOnce).to.be.true;
        });
      });

      context('finish command', function () {
        it('should call session finish with the literal argument to finish', async function () {
          var result;
          var session = { async finish(arg) { result=arg; }};
          var dialog = new FlowDialog({name:"TestFlowDialog", flows: {}});

          var handler = dialog._compileFlow([
            {finish:"the-result"}
          ], ['onStart']);
          await handler({}, session, []);
          expect(result).to.equal('the-result');
        });

        it('should call session finish with the handler result to finish', async function () {
          var result;
          var session = { async finish(arg) { result=arg; }};
          var dialog = new FlowDialog({name:"TestFlowDialog", flows: {}});

          var handler = dialog._compileFlow([
            {finish:async (vars, session, path)=>result={vars,path} }
          ], ['onStart']);
          await handler({a:1}, session, []);
          expect(result).to.deep.equal({vars:{a:1},path:['onStart']});
        });
      });

      context('wait command', function () {
        var sleepStub;
        beforeEach(function () {
          sleepStub = sandbox.stub(util, 'sleep');
        });

        it('should call sleep with the 1000 * literal argument to wait', async function () {
          var dialog = new FlowDialog({name:"TestFlowDialog", flows: {}});

          var handler = dialog._compileFlow([
            {wait:5}
          ], ['onStart']);
          await handler({}, "the-session", []);
          expect(sleepStub.withArgs(5000).calledOnce).to.be.true;
        });

        it('should call sleep with the literal argument to wait', async function () {
          var valueHandlerStub = sinon.stub();
          var dialog = new FlowDialog({name:"TestFlowDialog", flows: {}});

          valueHandlerStub.returns(5);
          var handler = dialog._compileFlow([{
            wait: valueHandlerStub
          }], ['onStart']);

          await handler({a:1}, "the-session", []);
          expect(sleepStub.withArgs(5000).calledOnce).to.be.true;
          expect(valueHandlerStub.withArgs(
            sinon.match({a:1}, 'the-session', ['onStart'])).calledOnce
          ).to.be.true;
        });

      });

      context('conditional command', function () {
        it('should create the appropriate flow handlers', function () {
          var dialog = new FlowDialog({name:"TestFlowDialog", flows: {}});
          dialog._compileFlow([
            { if:true,
              then:()=>{},
              else:()=>{}
            }
          ], ['onStart']);
          expect(dialog._getFlowHandler('TestFlowDialog:onStart.if_then')).to.be.a.function;
          expect(dialog._getFlowHandler('TestFlowDialog:onStart.if_else')).to.be.a.function;
        });

        it('should run the then flow if literal arg to if: is truthy', async function () {
          var dialog = new FlowDialog({name:"TestFlowDialog", flows: {}});
          var thenStub = sinon.stub();
          var elseStub = sinon.stub();

          var handler = dialog._compileFlow([
            { if:true,
              then:thenStub,
              else:elseStub
            }
          ], ['onStart']);

          await handler({a:1},"the-session",[]);
          expect(thenStub.withArgs(
            sinon.match({a:1}),'the-session',['onStart', 'if_then']).calledOnce
          ).to.be.true;
          expect(elseStub.notCalled).to.be.true;
        });

        it('should run the else flow if literal arg to if: is falsey', async function () {
          var dialog = new FlowDialog({name:"TestFlowDialog", flows: {}});
          var thenStub = sinon.stub();
          var elseStub = sinon.stub();

          var handler = dialog._compileFlow([
            { if:false,
              then:thenStub,
              else:elseStub
            }
          ], ['onStart']);

          await handler({a:1},"the-session",[]);
          expect(thenStub.notCalled).to.be.true;
          expect(elseStub.withArgs(
            sinon.match({a:1}),'the-session',['onStart', 'if_else']).calledOnce
          ).to.be.true;

        });

        it('should run the then flow if handler value to if: is truthy', async function () {
          var dialog = new FlowDialog({name:"TestFlowDialog", flows: {}});
          var ifStub = sinon.stub().returns(true);
          var thenStub = sinon.stub();
          var elseStub = sinon.stub();


          var handler = dialog._compileFlow([
            { if:ifStub,
              then:thenStub,
              else:elseStub
            }
          ], ['onStart']);

          await handler({a:1},"the-session",[]);
          expect(ifStub.withArgs(
            sinon.match({a:1}),'the-session',['onStart']).calledOnce
          ).to.be.true;
          expect(thenStub.withArgs(
            sinon.match({a:1}),'the-session',['onStart', 'if_then']).calledOnce
          ).to.be.true;
          expect(elseStub.notCalled).to.be.true;
        });

        it('should run the else flow if handler value to if: is falsey', async function () {
          var dialog = new FlowDialog({name:"TestFlowDialog", flows: {}});
          var ifStub = sinon.stub().returns(false);
          var thenStub = sinon.stub();
          var elseStub = sinon.stub();

          var handler = dialog._compileFlow([
            { if:ifStub,
              then:thenStub,
              else:elseStub
            }
          ], ['onStart']);

          await handler({a:1},"the-session",[]);
          expect(ifStub.withArgs(
            sinon.match({a:1}),'the-session',['onStart']).calledOnce
          ).to.be.true;
          expect(thenStub.notCalled).to.be.true;
          expect(elseStub.withArgs(
            sinon.match({a:1}),'the-session',['onStart', 'if_else']).calledOnce
          ).to.be.true;

        });
      });

      context('when provided a flow with hierarchical actions', function () {
        var dialog;
        var topLevelHandler;

        beforeEach(function () {
          dialog = new FlowDialog({name:"TestFlowDialog", flows: {}});

          topLevelHandler = dialog._compileFlow(
            [
              "Greetings!",
              {
                type:'text',
                text:'Is this what you want?',
                actions: {
                  sure: [
                    "Great!",
                    {
                      text:"Would you like anything else?",
                      actions: {
                        yes: [
                          "Awesome!",
                          {
                            type:'list',
                            items: {
                              cookies: {
                                actions: {
                                  order: "Cookies coming up!"
                                }
                              },
                              cream: {
                                actions: {
                                  order: "I'll get some cream!"
                                }
                              }
                            }
                          },
                          {finish:"Want something else?"}],
                        no: ["Oh poo", {finish:"doesn't want something else"}]
                      }
                    }
                  ],
                  nah: ["Oh, that's too bad!", {finish:"not what I want"}],
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
            ['onStart']
          );
        });

        it('the dialog should have the expected payload handlers', function (){
          var inputHandlerPatterns = dialog.inputHandlers.map(h=>h[0]).sort(jsonSort);
          expect(inputHandlerPatterns).to.deep.equal([
            {payload:'TestFlowDialog:onStart.sure'},
            {payload:'TestFlowDialog:onStart.sure.yes'},
            {payload:'TestFlowDialog:onStart.sure.no'},
            {payload:'TestFlowDialog:onStart.nah'},
            {payload:'TestFlowDialog:onStart.askAgain'}
          ].sort(jsonSort));
        });

        it('the dialog should have the expected postback handlers', function () {
          expect(Object.keys(dialog.postbackHandlers).sort(jsonSort)).to.deep.equal([
            'TestFlowDialog:onStart.sure.yes.cookies.order',
            'TestFlowDialog:onStart.sure.yes.cream.order'
          ]);
        });

        it('the top level handler should execute the commands at the beginning of the flow', async function () {
          var events = [];
          var fakeSession = { send(params) { events.push(params); }};
          await topLevelHandler({}, fakeSession);
          expect(events).to.deep.equal([
            { type: 'text', text: 'Greetings!' },
            {
              type: 'text',
              text: 'Is this what you want?',
              actions: [
                {
                  type: 'reply',
                  text: 'sure',
                  payload: 'TestFlowDialog:onStart.sure'
                },
                {
                  type: 'reply',
                  text: 'nah',
                  payload: 'TestFlowDialog:onStart.nah'
                },
                {
                  type: 'reply',
                  text: 'ask again',
                  payload: 'TestFlowDialog:onStart.askAgain'
                }
              ]
            }
          ]);
        });

        it('a nested payload handler should have the expected behavior', async function () {
          var events = [];
          var fakeSession = {
            send(params) { events.push({send:params}); },
            finish(result) { events.push({finish:result}); },
            postbackActionButton(method, text, args) {
              return {
                type: 'postback',
                text: text,
                payload: `this.postbackToken(${method},${args})` // would actually be a JWT
              };
            }
          };
          var handler = dialog._getFlowHandler('TestFlowDialog:onStart.sure.yes');
          await handler({}, fakeSession, ['onStart']);

          expect(events).to.deep.equal([
            {send: { type: 'text', text: 'Awesome!' }},
            {
              send: {
                type:'list',
                items: [
                  {
                    title: "cookies",
                    actions: [
                      {
                        text: "order",
                        type: "postback",
                        payload: "this.postbackToken(TestFlowDialog:onStart.sure.yes.cookies.order,undefined)"
                      }
                    ]
                  },
                  {
                    title: "cream",
                    actions: [
                      {
                        text: "order",
                        type: "postback",
                        payload: "this.postbackToken(TestFlowDialog:onStart.sure.yes.cream.order,undefined)"
                      }
                    ]
                  }
                ]
              }
            },
            {finish: "Want something else?"}
          ]);
        });

      });
    });
  });
});

// useful sort comparison fn when deep-equal checking two arrays of unordered objects
function jsonSort(x,y) {
  return JSON.stringify(x)>JSON.stringify(y);
}
