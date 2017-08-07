import {isFunction} from 'util';

import sinon from 'sinon';
import chai, {expect} from 'chai';
import chaiMatchPattern from 'chai-match-pattern';
chai.use(chaiMatchPattern);

var util = require('../src/util'); // need to require so we can stub the module

import {anyPattern} from '../src/constants';
import Session from '../src/session';
import FlowDialog, {
  isFlow, isFlowCommand, isAction, isActionable,
  isCommandType, isActionType, isMessageType,
  isExecCommand, isFlowBreaker,
  inferCommandType, inferActionType,
  normalizeFlow, normalizeAction, normalizeExecCommand,
  normalizeIterationCommand, normalizeSwitchCommand,
  normalizeActions, normalizeMessageCommand,
  isValidFlowId, appendFlowPathId, flowPathFromKey,
  flowIdToText, zipPromisesToHash,
  makeHandlerVars
} from '../src/flowdialog';
import {$} from '../src/dollar-operator';

describe('DeepDialog Script', function () {
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
        expect(inferCommandType({actions:[]})).to.be.undefined;
        expect(inferCommandType({items:[]})).to.be.undefined;
      });
      it('should be "start" if "start" key is present', function () {
        expect(inferCommandType({start:"MyDialog"})).to.equal('start');
      });
      it('should be "finish" if "finish" key is present', function () {
        expect(inferCommandType({finish:true})).to.equal('finish');
      });
      it('should be "finish" if "finish" key is present even if value is falsey', function () {
        expect(inferCommandType({finish:false})).to.equal('finish');
        expect(inferCommandType({finish:null})).to.equal('finish');
      });
      it('should be "wait" if "seconds" key is present', function () {
        expect(inferCommandType({wait:5})).to.equal("wait");
      });
      it('should be "conditional" if "if" key is present', function () {
        expect(inferCommandType({if:()=>{}})).to.equal("conditional");
      });
      it('should be "conditional" if "when" key is present', function () {
        expect(inferCommandType({when:()=>{}})).to.equal("conditional");
      });
      it('should be "conditional" if "unless" key is present', function () {
        expect(inferCommandType({unless:()=>{}})).to.equal("conditional");
      });
      it('should be "switch" if "switch" key is present', function () {
        expect(inferCommandType({switch:()=>{}})).to.equal("switch");
      });
    });

    context('isFlowBreaker', function () {
      it('should be true for a conditional command', function () {
        expect(isFlowBreaker({type:'conditional'})).to.be.ok;
      });
      it('should be true for a start command', function () {
        expect(isFlowBreaker({type:'start'})).to.be.ok;
      });
      it('should be true for an iteration command', function () {
        expect(isFlowBreaker({type:'iteration'})).to.be.ok;
      });
      it('should be false for a simple message command', function () {
        expect(isFlowBreaker({type:'text'})).to.be.false;
      });
      it('should be true for a message command with reply actions', function () {
        expect(isFlowBreaker({
          type:'text',
          actions:[{type:'reply', then:'dothen'}]
        })).to.be.true;
      });
      it('should be false for a message command with no reply actions', function () {
        expect(isFlowBreaker({
          type:'text',
          actions:[{type:'link', uri:'https://..'}]
        })).to.be.false;
      });
      it('should be true for a message command with items with reply actions', function () {
        expect(isFlowBreaker({
          type:'text',
          items: [
            { actions:[{type:'reply', then:'dothen'}] }
          ]
        })).to.be.true;
      });
      it('should be false for a message command with items with no reply actions', function () {
        expect(isFlowBreaker({
          type:'text',
          items: [
            { actions:[{type:'link', uri:'https://..'}] }
          ]
        })).to.be.false;
      });
      it('should be true for a message command with an items handler', function () {
        expect(isFlowBreaker({
          type:'text',
          items: ()=>{}
        })).to.be.true;
      });
      it('should be true for a message command with items containing an actions handler', function () {
        expect(isFlowBreaker({
          type:'text',
          items: [ { actions: ()=>{} } ]
        })).to.be.true;
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
          expect(isCommandType(type)).to.be.false
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
          expect(isActionType(type)).to.be.false
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
      it('should handle multiple ids correctly', function () {
        expect(appendFlowPathId(['a','b'], 'c','d')).to.deep.equal([
          'a','b','c','d'
        ]);
        expect(appendFlowPathId(['a','b'], '#c','d')).to.deep.equal([
          '#c','d'
        ]);
        expect(appendFlowPathId(['a','b'], 'c','#d')).to.deep.equal([
          '#d'
        ]);
      });
      it('should handle number ids', function () {
        expect(appendFlowPathId(['a','b'], 0)).to.deep.equal([
          'a','b',0
        ]);
        expect(appendFlowPathId(['a','b'], 0, 'c')).to.deep.equal([
          'a','b',0,'c'
        ]);
        expect(appendFlowPathId(['a','b'], 1)).to.deep.equal([
          'a','b',1
        ]);
        expect(appendFlowPathId(['a','b'], 1, 'c')).to.deep.equal([
          'a','b',1,'c'
        ]);
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

    context('normalizeSwitchCommand', function () {
      it('should normalize object cases', function () {
        expect(normalizeSwitchCommand({
          switch:true,
          cases: {
            a: ['a'],
            b: ['b']
          }
        })).to.deep.equal({
          type: 'switch',
          id: 'switch',
          switch:true,
          cases: [ {id:'a', do:['a']}, {id:'b', do:['b']}],
          default: undefined
        });
      });
      it('should leave array cases as is', function () {
        expect(normalizeSwitchCommand({
          switch:true,
          cases: [ {id:'a', do:['a']}, {id:'b', do:['b']}]
        })).to.deep.equal({
          type: 'switch',
          id: 'switch',
          switch:true,
          cases: [ {id:'a', do:['a']}, {id:'b', do:['b']}],
          default: undefined
        });
      });
      it('should preserve the default clause', function () {
        expect(normalizeSwitchCommand({
          switch:true,
          cases: [ {id:'a', do:['a']}, {id:'b', do:['b']}],
          default: ["default"]
        })).to.deep.equal({
          type:'switch',
          id: 'switch',
          switch:true,
          cases: [ {id:'a', do:['a']}, {id:'b', do:['b']}],
          default: ["default"]
        });
      });
      it('should contain the provided id', function () {
        expect(normalizeSwitchCommand({
          id: 'test',
          switch:true,
          cases: [ {id:'a', do:['a']}, {id:'b', do:['b']}]
        })).to.deep.equal({
          type: 'switch',
          id: 'test',
          switch:true,
          cases: [ {id:'a', do:['a']}, {id:'b', do:['b']}],
          default: undefined
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

    context('normalizeIterationCommand', function () {
      it('should expand the minimal form to increment, condition, initializer components', function () {
        var normalForm = normalizeIterationCommand({
          for: ['i', 10, 2],
          do: "hello {{i}}"
        });
        expect(normalForm).to.matchPattern({
          id: 'for',
          type: 'iteration',
          initializer: {i:0},
          condition: isFunction,
          increment: {i:2},
          do: "hello {{i}}"
        });
        expect(normalForm.condition({i:0})).to.be.true;
        expect(normalForm.condition({i:9})).to.be.true;
        expect(normalForm.condition({i:10})).to.be.false;
        expect(normalForm.condition({i:100})).to.be.false;
      });

      it('should leave the normal form as is', function () {
        var normalForm = normalizeIterationCommand({
          for: [{i:1}, 10, {i:5}],
          do: "hello {{i}}"
        });
        expect(normalForm).to.matchPattern({
          id: 'for',
          type: 'iteration',
          initializer: {i:1},
          condition: isFunction,
          increment: {i:5},
          do: "hello {{i}}"
        });
      });

      it('should correctly transform a while expression', function () {
        var normalForm = normalizeIterationCommand({
          while: ({x})=>!x, // flip the boolean
          do: "hello {{x}}"
        });
        expect(normalForm).to.matchPattern({
          id: 'while',
          type: 'iteration',
          condition: isFunction,
          do: "hello {{x}}"
        });
        expect(normalForm.initializer).to.be.undefined;
        expect(normalForm.increment).to.be.undefined;

        // the condition flips the boolean in var x
        expect(normalForm.condition({x:true})).to.be.false;
        expect(normalForm.condition({x:false})).to.be.ok;
      });

      it('should correctly transform an until expression', async function () {
        var normalForm = normalizeIterationCommand({
          until: ({x})=>!x, // flip the boolean
          do: "hello {{x}}"
        });
        expect(normalForm).to.matchPattern({
          id: 'until',
          type: 'iteration',
          condition: isFunction,
          do: "hello {{x}}"
        });
        expect(normalForm.initializer).to.be.undefined;
        expect(normalForm.increment).to.be.undefined;

        // until should flip the boolean twice
        expect(await normalForm.condition({x:true})).to.be.ok;
        expect(await normalForm.condition({x:false})).to.be.false;
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

    context('expandSetParam', function () {
      var dialog;

      beforeEach(function () {
        dialog = new FlowDialog({name: "TestFlowDialog"});
      });

      it('should expand functions in a provided object', async function() {
        expect(await dialog._expandSetParam({a:()=>1, b:2, c:$.z}, {z:3})).to.deep.equal({
          a:1, b:2, c:3
        });
      });

      it('should implement destructuring semantics when the key is {v1,v2,...}', async function () {
        expect(await dialog._expandSetParam({"{a}": ()=>({a:1, b:2, c:3})})).to.deep.equal(
          {a:1}
        );
        expect(await dialog._expandSetParam({"{a,c}": ()=>({a:1, b:2, c:3})})).to.deep.equal(
          {a:1, c:3}
        );
        expect(await dialog._expandSetParam({"{b}": ()=>({a:1, b:2, c:3})})).to.deep.equal(
          {b:2}
        );
        expect(await dialog._expandSetParam({"{_d_}": ()=>({a:1, b:2, c:3, _d_:4})})).to.deep.equal(
          {_d_:4}
        );
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

    context('#flowKey', function () {
      var dialog;
      beforeEach(function () {
        dialog = new FlowDialog({ name: "TestDialog" });
      });

      it('should return a flowKey given a path', function () {
        expect(dialog.flowKey(['a'])).to.equal('TestDialog:a');
        expect(dialog.flowKey(['a','b','c'])).to.equal('TestDialog:a.b.c');
        expect(dialog.flowKey(['a','b','#c'])).to.equal('TestDialog:#c');
        expect(dialog.flowKey(['a','b',0])).to.equal('TestDialog:a.b.0');
      });

      it('should return a flowKey given a string missing the dialog name', function () {
        expect(dialog.flowKey('a')).to.equal('TestDialog:a');
        expect(dialog.flowKey('a.b.c')).to.equal('TestDialog:a.b.c');
      });

      it('should return a flowKey given a fully-resolved flowKey', function () {
        expect(dialog.flowKey('TestDialog:a.b.c')).to.equal('TestDialog:a.b.c');
      });

      it('should return a flowKey given a fully-resolved flowKey', function () {
        expect(dialog.flowKey('TestDialog:a.b.c')).to.equal('TestDialog:a.b.c');
      });

      it('should throw an error in other situations', function () {
        expect(()=>dialog.flowKey('TestDialog:')).to.throw();
        expect(()=>dialog.flowKey('DifferentDialog:a.b.c')).to.throw();
        expect(()=>dialog.flowKey('a:b:c')).to.throw();
        expect(()=>dialog.flowKey({a:1})).to.throw();
      });
    });

    context('#_compileFlow', function() {
      it('should return a handler which calls a session with message command parameters', async function() {
        var sendParams = [];
        var fakeSession = {send(params) { sendParams.push(params); }};
        var dialog = new FlowDialog({name:"TestFlowDialog", flows: {}});
        var path = ['start'];
        var handler = dialog._compileFlow(["say a","say b","say c"],path);
        expect(handler).to.be.a('function');
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

        it('should call session.start with the provided dialog instance', async function () {
          var dialog = new FlowDialog({name:"TestFlowDialog", flows: {}});
          var dialogInstance = new FlowDialog({name:"MyDialog"});
          var topLevelHandler = dialog._compileFlow([
            { start: dialogInstance }
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
          var session;

          beforeEach(function () {
            dialog = new FlowDialog({name:"TestFlowDialog", flows: {}});
            session = {
              push(args) { events.push({push:args}); },
              send(params) { events.push({send:params}); }
            };
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

            expect(dialog._flowHandlers['TestFlowDialog:a.b.start(MyDialog).then']).to.be.ok;

            expect(Object.keys(dialog.resultHandlers)).to.deep.equal([
              "MyDialog|TestFlowDialog:a.b.start(MyDialog).then"
            ]);

          });

          it('the dialog result handler should execute code', async function () {
            dialog._compileFlow([{
              start: ()=> ["MyDialog", {a:1}],
              then: async (vars, session, path) => {
                await session.push({vars, path});
              }
            }], [
              'a','b'
            ]);

            var onResultFlowHandler = dialog._getFlowHandler('TestFlowDialog:a.b.start(?).then');

            await onResultFlowHandler({a:1}, session, []);

            expect(events).to.deep.equal([
              {push:{ vars: {a:1}, path:['a','b','start(?)','then']}}
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
              `${anyPattern}|TestFlowDialog:a.b.start(?).then`
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
              `${anyPattern}|TestFlowDialog:a.b.user-custom-id.then`
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

            var resultHandler = dialog.getResultHandler('MyDialog|TestFlowDialog:a.b.start(MyDialog).then');
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
                  path: ['a','b', 'start(MyDialog)', 'then']
                }
              }
            ]);
          });

          context('when options.nextFlow is set,', function () {
            beforeEach(function () {
              dialog._addFlowHandler(['the-next-flow'], function (vars, session) {
                session.push({vars, nextFlow:true});
              });
              dialog._compileFlow([
                {
                  id: "user-custom-id",
                  start: ()=> ["MyDialog", {a:1}],
                  then: async (vars, session, path) => {
                    await session.push({vars, path});
                  }
                }
              ],
              // path
              [ 'a','b' ],
              // options:
              { nextFlow: ['the-next-flow'] });
            });

            it('the dialog should install a result handler that invokes the nextFlow', async function () {
              expect(dialog.resultHandlers).to.have.key('_|TestFlowDialog:a.b.user-custom-id.then');
              var resultHandler = dialog.getResultHandler('_|TestFlowDialog:a.b.user-custom-id.then');
              session.locals = {a:1};
              await resultHandler(session, 'the-result');
              expect(events).to.deep.equal([
                {push: {vars: {a:1, value:'the-result'}, path:['a','b','user-custom-id', 'then']}},
                {push: {vars: {a:1}, nextFlow:true}}  // vars constructed from session
              ]);
            });
          });

        });
      });

      context('set and setv commands', function () {
        it('should call session save with the literal argument to set', async function () {
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

        it('should call session save with the handler value to set', async function () {
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

        it('should call session save, automatically generating objects in a path', async function () {
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

        it('should call session set, using destructuring when a destructuring key is present', async function () {
          var session = { save: sinon.stub() };
          var dialog = new FlowDialog({name:"TestFlowDialog", flows: {}});

          var handler = dialog._compileFlow([
            { set: {"{a,c}": ()=>({a:1,b:2, c:3, d:4}) } }
          ], ['onStart']);
          await handler({}, session, []);
          expect(session.save.withArgs(
            sinon.match({a:1, c:3})
          ).calledOnce).to.be.true;
        });

        it('should call session setv when command is setv, implementing the same param semantics as set', async function () {
          var session = { setv: sinon.stub() };
          var dialog = new FlowDialog({name:"TestFlowDialog", flows: {}});

          var handler = dialog._compileFlow([
            {
              setv:{
                a: 1, // literals
                b: ()=>2,  // functions
                "{y,z}":()=>({w:3, x:4, y:5, z:6})} // spread operator
            }
          ], ['onStart']);
          await handler({}, session, []);
          expect(session.setv.withArgs(
            sinon.match({a:1, b:2, y:5, z:6})
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
          expect(dialog._getFlowHandler('TestFlowDialog:onStart.if.then')).to.be.a('function');
          expect(dialog._getFlowHandler('TestFlowDialog:onStart.if.else')).to.be.a('function');
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
            sinon.match({a:1}),'the-session',['onStart', 'if' ,'then']).calledOnce
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
            sinon.match({a:1}),'the-session',['onStart', 'if', 'else']).calledOnce
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
            sinon.match({a:1}),'the-session',['onStart', 'if','then']).calledOnce
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
            sinon.match({a:1}),'the-session',['onStart', 'if', 'else']).calledOnce
          ).to.be.true;

        });

        it('should run the nextFlow if the test is true and a nextFlow is provided', async function () {
          var dialog = new FlowDialog({name:"TestFlowDialog", flows: {}});
          var ifStub = sinon.stub().returns(true);
          var events = [];
          var session = { async send(params) { events.push(params); }};

          var handler = dialog._compileFlow([
            { if:ifStub,
              then:"then",
              else:"else"
            },
            "next"
          ], ['onStart']);

          await handler({}, session, []);

          expect(events).to.deep.equal([
            { type: 'text', text: 'then' },
            { type: 'text', text: 'next' }
          ]);
        });

        it('should run the nextFlow if the test is true and a nextFlow is provided', async function () {
          var dialog = new FlowDialog({name:"TestFlowDialog", flows: {}});
          var ifStub = sinon.stub().returns(true);
          var events = [];
          var session = { async send(params) { events.push(params); }};

          var handler = dialog._compileFlow([
            { if:ifStub,
              then:"then",
              else:"else"
            },
            { id:'afterIf',
              text: "next"
            }
          ], ['onStart']);

          await handler({}, session, []);

          expect(events).to.deep.equal([
            { type: 'text', text: 'then' },
            { type: 'text', text: 'next' }
          ]);
        });

        it('should run the do flow if when condition is true', async function () {
          var dialog = new FlowDialog({name:"TestFlowDialog", flows: {}});
          var doStub = sinon.stub();

          var handler = dialog._compileFlow([
            { when:()=>true,
              do:doStub
            }
          ], ['onStart']);

          await handler({a:1},"the-session",[]);
          expect(doStub.calledOnce).to.be.ok;
        });

        it('should not run the do flow if when condition is false', async function () {
          var dialog = new FlowDialog({name:"TestFlowDialog", flows: {}});
          var doStub = sinon.stub();

          var handler = dialog._compileFlow([
            { when:()=>false,
              do:doStub
            }
          ], ['onStart']);

          await handler({a:1},"the-session",[]);
          expect(doStub.notCalled).to.be.ok;
        });

        it('should run the do flow if unless condition is false', async function () {
          var dialog = new FlowDialog({name:"TestFlowDialog", flows: {}});
          var doStub = sinon.stub();

          var handler = dialog._compileFlow([
            { unless:()=>false,
              do:doStub
            }
          ], ['onStart']);

          await handler({a:1},"the-session",[]);
          expect(doStub.called).to.be.ok;
        });

        it('should not run the do flow if unless condition is true', async function () {
          var dialog = new FlowDialog({name:"TestFlowDialog", flows: {}});
          var doStub = sinon.stub();

          var handler = dialog._compileFlow([
            { unless:()=>true,
              do:doStub
            }
          ], ['onStart']);

          await handler({a:1},"the-session",[]);
          expect(doStub.notCalled).to.be.ok;
        });
      });

      context('switch command', function () {
        it('should run the provided case', async function () {
          var case1Stub = sinon.stub();
          var dialog = new FlowDialog({name:"TestFlowDialog", flows: {}});
          var handler = dialog._compileFlow({
            switch: 'case1',
            cases: {
              case1: case1Stub
            }
          },
          ['onStart'],
          {}); // no options
          await handler({a:1},'the-session',[]);
          expect(case1Stub.callCount).to.equal(1);
        });

        it('should execute cases in order when no breaks are provided', async function () {
          var case1Stub = sinon.stub();
          var case2Stub = sinon.stub();
          var case3Stub = sinon.stub();
          var dialog = new FlowDialog({name:"TestFlowDialog", flows: {}});
          var handler = dialog._compileFlow({
            switch: ({a})=>a,
            cases: {
              case1: case1Stub,
              case2: case2Stub,
              case3: case3Stub
            }
          },
          ['onStart'],
          {}); // no options

          await handler({a:'case1'},'the-session',[]);
          expect(case1Stub.callCount).to.equal(1);
          expect(case2Stub.callCount).to.equal(1);
          expect(case3Stub.callCount).to.equal(1);

          await handler({a:'case2'},'the-session',[]);
          expect(case1Stub.callCount).to.equal(1);
          expect(case2Stub.callCount).to.equal(2);
          expect(case3Stub.callCount).to.equal(2);

          await handler({a:'case3'},'the-session',[]);
          expect(case1Stub.callCount).to.equal(1);
          expect(case2Stub.callCount).to.equal(2);
          expect(case3Stub.callCount).to.equal(3);
        });

        it('should handle number cases', async function () {
          var case0Stub = sinon.stub();
          var case1Stub = sinon.stub();
          var case2Stub = sinon.stub();
          var dialog = new FlowDialog({name:"TestFlowDialog", flows: {}});
          var handler = dialog._compileFlow({
            switch: ({a})=>a,
            cases: {
              0: case0Stub,
              1: case1Stub,
              2: case2Stub
            }
          },
          ['onStart'],
          {}); // no options

          await handler({a:0},'the-session',[]);
          expect(case0Stub.callCount).to.equal(1);
          expect(case1Stub.callCount).to.equal(1);
          expect(case2Stub.callCount).to.equal(1);

          await handler({a:1},'the-session',[]);
          expect(case0Stub.callCount).to.equal(1);
          expect(case1Stub.callCount).to.equal(2);
          expect(case2Stub.callCount).to.equal(2);

          await handler({a:2},'the-session',[]);
          expect(case0Stub.callCount).to.equal(1);
          expect(case1Stub.callCount).to.equal(2);
          expect(case2Stub.callCount).to.equal(3);
        });

        it('should execute the default flow if no matching cases are found', async function () {
          var case1Stub = sinon.stub();
          var case2Stub = sinon.stub();
          var case3Stub = sinon.stub();
          var defaultStub = sinon.stub();
          var dialog = new FlowDialog({name:"TestFlowDialog", flows: {}});
          var handler = dialog._compileFlow({
            switch: ({a})=>a,
            cases: {
              case1: case1Stub,
              case2: case2Stub,
              case3: case3Stub
            },
            default: defaultStub
          },
          ['onStart'],
          {}); // no options

          await handler({a:'not-present'},'the-session',[]);
          expect(case1Stub.notCalled).to.be.ok;
          expect(case2Stub.notCalled).to.be.ok;
          expect(case3Stub.notCalled).to.be.ok;
          expect(defaultStub.callCount).to.equal(1);
        });

        context('when a break is encountered', function () {

          it('in the first case, it should stop executing', async function () {
            var case1Stub = sinon.stub();
            var case2Stub = sinon.stub();
            var case3Stub = sinon.stub();
            var defaultStub = sinon.stub();
            var dialog = new FlowDialog({name:"TestFlowDialog", flows: {}});
            var handler = dialog._compileFlow({
              switch: ({a})=>a,
              cases: {
                case1: [ case1Stub, {break:true} ],
                case2: case2Stub,
                case3: case3Stub
              },
              default: defaultStub
            },
            ['onStart'],
            {}); // no options

            await handler({a:'case1'},'the-session',[]);
            expect(case1Stub.callCount).to.equal(1);
            expect(case2Stub.notCalled).to.be.ok;
            expect(case3Stub.notCalled).to.be.ok;
            expect(defaultStub.notCalled).to.be.ok;
          });

          it('in middle case, it should stop executing', async function () {
            var case1Stub = sinon.stub();
            var case2Stub = sinon.stub();
            var case3Stub = sinon.stub();
            var defaultStub = sinon.stub();
            var dialog = new FlowDialog({name:"TestFlowDialog", flows: {}});
            var handler = dialog._compileFlow({
              switch: ({a})=>a,
              cases: {
                case1: case1Stub,
                case2: [case2Stub, {break:true}],
                case3: case3Stub
              },
              default: defaultStub
            },
            ['onStart'],
            {}); // no options

            await handler({a:'case1'},'the-session',[]);
            expect(case1Stub.callCount).to.equal(1);
            expect(case2Stub.callCount).to.equal(1);
            expect(case3Stub.notCalled).to.be.ok;
            expect(defaultStub.notCalled).to.be.ok;
          });
        });

        context('when a nextFlow exists', function () {
          it('should transfer control to the nextFlow from a break when default is present', async function () {
            var case1Stub = sinon.stub();
            var case2Stub = sinon.stub();
            var case3Stub = sinon.stub();
            var defaultStub = sinon.stub();
            var nextFlowStub = sinon.stub();
            var dialog = new FlowDialog({name:"TestFlowDialog", flows: {}});
            var handler = dialog._compileFlow([
              {
                switch: ({a})=>a,
                cases: {
                  case1: case1Stub,
                  case2: [case2Stub, {break:true}],
                  case3: case3Stub
                },
                default: defaultStub
              },
              nextFlowStub
            ],
            ['onStart'],
            {}); // no options

            await handler({a:'case1'},'the-session',[]);
            expect(case1Stub.callCount).to.equal(1);
            expect(case2Stub.callCount).to.equal(1);
            expect(nextFlowStub.callCount).to.equal(1);
            expect(case3Stub.notCalled).to.be.ok;
            expect(defaultStub.notCalled).to.be.ok;
          });

          it('should transfer control to the nextFlow from a break when default is not present', async function () {
            var case1Stub = sinon.stub();
            var case2Stub = sinon.stub();
            var case3Stub = sinon.stub();
            var nextFlowStub = sinon.stub();
            var dialog = new FlowDialog({name:"TestFlowDialog", flows: {}});
            var handler = dialog._compileFlow([
              {
                switch: ({a})=>a,
                cases: {
                  case1: case1Stub,
                  case2: [case2Stub, {break:true}],
                  case3: case3Stub
                }
              },
              nextFlowStub
            ],
            ['onStart'],
            {}); // no options

            await handler({a:'case1'},'the-session',[]);
            expect(case1Stub.callCount).to.equal(1);
            expect(case2Stub.callCount).to.equal(1);
            expect(nextFlowStub.callCount).to.equal(1);
            expect(case3Stub.notCalled).to.be.ok;
          });

          it('should transfer control to the nextFlow when no break is present', async function () {
            var case1Stub = sinon.stub();
            var case2Stub = sinon.stub();
            var case3Stub = sinon.stub();
            var nextFlowStub = sinon.stub();
            var dialog = new FlowDialog({name:"TestFlowDialog", flows: {}});
            var handler = dialog._compileFlow([
              {
                switch: ({a})=>a,
                cases: {
                  case1: case1Stub,
                  case2: case2Stub,
                  case3: case3Stub
                }
              },
              nextFlowStub
            ],
            ['onStart'],
            {}); // no options

            await handler({a:'case1'},'the-session',[]);
            expect(case1Stub.callCount).to.equal(1);
            expect(case2Stub.callCount).to.equal(1);
            expect(case3Stub.callCount).to.equal(1);
            expect(nextFlowStub.callCount).to.equal(1);
          });
        });
      });

      context('iteration command', function () {
        it('break pseudo command should throw an error when called inside a regular flow', function () {
          var dialog = new FlowDialog({name:"TestFlowDialog", flows: {}});
          expect(()=>dialog._compileFlow([
            {break:true}
          ])).to.throw();
        });

        it('continue pseudo command should throw an error when called inside a regular flow', function () {
          var dialog = new FlowDialog({name:"TestFlowDialog", flows: {}});
          expect(()=>dialog._compileFlow([
            {continue:true}
          ])).to.throw();
        });

        context('using for syntax,', function () {
          it('should install a handler which iterates the specified number of times', async function () {
            var dialog = new FlowDialog({name:"TestFlowDialog", flows: {}});
            var handler = dialog._compileFlow([
              { for: [{i:1}, ({i})=>i<6, {i:2}],
                do: [
                  "Hello {{i}}"
                ]
              }
            ], ['onStart']);
            var events = [];
            var session = {
              vars: {},
              async send(params) { events.push(params); },
              async save(obj) {
                this.vars = {...this.vars,...obj};
              },
              get globals() { return {}; },
              get locals() { return this.vars; }
            };

            await handler({}, session);
            expect(events).to.deep.equal([
              {type: 'text', text: 'Hello 1'},
              {type: 'text', text: 'Hello 3'},
              {type: 'text', text: 'Hello 5'},
            ]);
          });

          it('should accept a do flow which is not an array', async function () {
            var dialog = new FlowDialog({name:"TestFlowDialog", flows: {}});
            var handler = dialog._compileFlow([
              { for: [{i:1}, ({i})=>i<6, {i:2}],
                do: "Hello {{i}}"
              }
            ], ['onStart']);
            var events = [];
            var session = {
              vars: {},
              async send(params) { events.push(params); },
              async save(obj) {
                this.vars = {...this.vars,...obj};
              },
              get globals() { return {}; },
              get locals() { return this.vars; }
            };

            await handler({}, session);
            expect(events).to.deep.equal([
              {type: 'text', text: 'Hello 1'},
              {type: 'text', text: 'Hello 3'},
              {type: 'text', text: 'Hello 5'},
            ]);
          });

          it('should stop iterating when it encounters a break command', async function () {
            var dialog = new FlowDialog({name:"TestFlowDialog", flows: {}});
            var handler = dialog._compileFlow([
              { for: [{i:1}, ({i})=>i<6, {i:2}],
                do: [
                  "Hello {{i}}",
                  {break:true}
                ]
              },
              "Done!"
            ], ['onStart']);
            var events = [];
            var session = {
              vars: {},
              async send(params) { events.push(params); },
              async save(obj) {
                this.vars = {...this.vars,...obj};
              },
              get globals() { return {}; },
              get locals() { return this.vars; }
            };

            await handler({}, session);
            expect(events).to.deep.equal([
              {type: 'text', text: 'Hello 1'},
              {type: 'text', text: 'Done!'}
            ]);

            // increment not executed:
            expect(session.vars).to.deep.equal({i:1});
          });

          it('should continue iterating when it encounters a continue command', async function () {
            var dialog = new FlowDialog({name:"TestFlowDialog", flows: {}});
            var handler = dialog._compileFlow([
              { for: [{i:1}, ({i})=>i<6, {i:2}],
                do: [
                  { if: ({i})=>i==3,
                    then: { continue: true}
                  },
                  "Hello {{i}}"
                ]
              },
              "Done!"
            ], ['onStart']);
            var events = [];
            var session = {
              vars: {},
              async send(params) { events.push(params); },
              async save(obj) {
                this.vars = {...this.vars,...obj};
              },
              get globals() { return {}; },
              get locals() { return this.vars; }
            };

            await handler({}, session);
            expect(events).to.deep.equal([
              {type: 'text', text: 'Hello 1'},
              {type: 'text', text: 'Hello 5'},
              {type: 'text', text: 'Done!'}
            ]);
          });

          context('when it contains a dialog start (i.e., flow breaking) command', function () {
            var dialog, events, session, onStartHandler;
            beforeEach(function () {
              dialog = new FlowDialog({name:"TestFlowDialog", flows: {}});
              onStartHandler = dialog._compileFlow([
                {
                  for: [{i:1}, ({i})=>i<6, {i:2}],
                  do: [
                    {
                      start: ["ChildDialog", ({i})=>({a:i*10})],
                      then: "start.then: iter={{i}} result={{value}}"
                    },
                    "nextFlow: iter={{i}}"
                  ]
                },
                "outer nextFlow"
              ], ['onStart']);
              events = [];
              session = {
                vars: {},
                async start(dialog, args) {
                  events.push({start:{dialog, args}});
                },
                async send(params) {
                  events.push({send:params}); },
                async save(obj) {
                  this.vars = {...this.vars,...obj};
                },
                get globals() { return {}; },
                get locals() { return this.vars; }
              };
            });

            it('should call the flow breaking command after calling the initializer', async function () {
              await onStartHandler({}, session);
              expect(session.vars).to.deep.equal({i:1});
              expect(events).to.deep.equal([
                {start:{dialog:"ChildDialog", args:{a:10}}}
              ]);
            });

            context("when the dialog returns a result, it should execute the subflow " +
            "(the start.then flow), then execute the nextFlow, then increment "+
            "the counter ", function () {
              it('and if the condition is still met, should start the do flow again', async function () {
                var resultHandler = dialog.getResultHandler('ChildDialog|TestFlowDialog:onStart.for.do.start(ChildDialog).then');
                session.vars = {i:1};
                await resultHandler(session, "the-result");
                expect(events).to.deep.equal([
                  { send: { type:'text', text:'start.then: iter=1 result=the-result'}},
                  { send: { type:'text', text:'nextFlow: iter=1'}},
                  // i + increment 2 = 3 ;  a = i*10
                  { start: { dialog: 'ChildDialog', args: { a:30 }}}
                ]);
              });

              it('and if the condition is NOT met, should exit the loop and execute '+
              'the outer next', async function () {
                var resultHandler = dialog.getResultHandler('ChildDialog', 'TestFlowDialog:onStart.for.do.start(ChildDialog).then');
                session.vars = {i:5};
                await resultHandler(session, "the-result");
                expect(events).to.deep.equal([
                  { send: { type:'text', text:'start.then: iter=5 result=the-result'}},
                  { send: { type:'text', text:'nextFlow: iter=5'}},
                  // i + increment 2 = 7; condition 7<6 fails
                  // child dialog is not called / outer next flow executes
                  { send: { type: 'text', text:'outer nextFlow' }}
                ]);
              });
            });
          });
        });

        context('using until syntax,', function () {
          it('should execute the until loop until the condition is true', async function () {
            var dialog = new FlowDialog({name:"TestFlowDialog", flows: {}});
            var events = [];
            var session = {
              async send(params) { events.push({send:params}); },
              async save(params) {
                this.locals=params;
              },
              locals:{},
              globals:{}
            };
            var handler = dialog._compileFlow([
              { until: $.i.$gt(2),
                do: [
                  "i={{i}}",
                  {set: {i: $.i.$add(1)}}
                ]
              }
            ], ['onStart']);
            session.locals={i:0};
            await handler({}, session);
            expect(events).to.deep.equal([
              {send:{type:"text", text:"i=0"}},
              {send:{type:"text", text:"i=1"}},
              {send:{type:"text", text:"i=2"}}
            ]);
          });

        });

        context('using while syntax,', function () {
          it('should execute the while loop while the condition is true', async function () {
            var dialog = new FlowDialog({name:"TestFlowDialog", flows: {}});
            var events = [];
            var session = {
              async send(params) { events.push({send:params}); },
              async save(params) {
                this.locals=params;
              },
              locals:{},
              globals:{}
            };
            var handler = dialog._compileFlow([
              { while: $.i.$lt(3),
                do: [
                  "i={{i}}",
                  {set: {i: $.i.$add(1)}}
                ]
              }
            ], ['onStart']);
            session.locals={i:0};
            await handler({}, session);
            expect(events).to.deep.equal([
              {send:{type:"text", text:"i=0"}},
              {send:{type:"text", text:"i=1"}},
              {send:{type:"text", text:"i=2"}}
            ]);
          });

        });

        it('should correctly run an iteration with a nested conditional', async function () {
          var dialog = new FlowDialog({name:"TestFlowDialog", flows: {}});
          var events = [];
          var session = {
            async send(params) { events.push({send:params}); },
            async save(params) {
              this.locals=params;
            },
            locals:{},
            globals:{}
          };
          var isEven = (x)=>x%2==0;
          var handler = dialog._compileFlow([
            {
              until: $.i.$gt(2),
              do: [
                {
                  if: $.i.$(isEven),
                  then: "{{i}} is even",
                  else: "{{i}} is odd"
                },
                {set: {i:$.i.$add(1)}}
              ]
            }
          ],
          ['onStart']);

          session.locals = {i:0};
          await handler({}, session);
          expect(events).to.deep.equal([
            {send:{type:"text", text:"0 is even"}},
            {send:{type:"text", text:"1 is odd"}},
            {send:{type:"text", text:"2 is even"}}
          ]);
        });
      });

      context('message command', function () {
        context('containing a postback action with a then flow', function () {
          it('should add a flow handler for the then action', async function () {
            var dialog = new FlowDialog({name:"TestFlowDialog", flows: {}});
            dialog._compileFlow([
              {
                type: 'text',
                actions: {
                  postback: { type: 'postback', then: 'postback action'}
                }
              }
            ], [
              'onStart'
            ]);
            expect(dialog._flowHandlers).to.have.keys(
              'TestFlowDialog:onStart',
              'TestFlowDialog:onStart.postback'
            );
            expect(dialog.postbackHandlers).to.have.keys(
              'TestFlowDialog:onStart.postback'
            );

            var postbackHandler = dialog._getFlowHandler('onStart.postback');
            var events = [];
            var session = { async send(params) { events.push(params); } };
            await postbackHandler({a:1},session);

            expect(events).to.deep.equal([{
              type: 'text',
              text: 'postback action'
            }]);
          });

          it('should not add a next flow handler if a next flow exists', async function () {
            var dialog = new FlowDialog({name:"TestFlowDialog", flows: {}});
            var flowHandler = dialog._compileFlow([
              {
                type: 'text',
                text: 'the-message',
                actions: {
                  postback: {
                    type: 'postback',
                    then: 'postback action'
                  }
                }
              },
              "this is",
              "the next flow"
            ], [
              'onStart'
            ]);

            var postbackHandler = dialog._getFlowHandler('onStart.postback');
            var events = [];
            var session = {
              async send(params) { events.push(params); },
              postbackActionButton() {
                return { type: 'payload', text:"postback", payload:"some-hash"};
              }
            };
            await flowHandler({a:1}, session);
            await postbackHandler({a:1},session);

            expect(events).to.deep.equal([
              {
                type: 'text', text: 'the-message',
                actions: [
                  { type: 'payload', text:"postback",payload:"some-hash"}
                ]
              },
              { type: 'text', text: 'this is' },
              { type: 'text', text: 'the next flow' },

              // postback action is a text message that happens
              // when the user presses the button, but after the nextFlow
              // completes:
              { type: 'text', text: 'postback action'}
            ]);
          });
        });

        context('containing a reply action with a then flow', function () {
          it('should add a flow handler for the then action', async function () {
            var dialog = new FlowDialog({name:"TestFlowDialog", flows: {}});
            dialog._compileFlow([
              {
                type: 'text',
                actions: {
                  reply: { type: 'reply', then: 'reply action'}
                }
              }
            ], [
              'onStart'
            ]);
            expect(dialog._flowHandlers).to.have.keys(
              'TestFlowDialog:onStart',
              'TestFlowDialog:onStart.reply'
            );

            var [payloadHandler] = dialog.getInputHandler({payload:'TestFlowDialog:onStart.reply'});
            var events = [];
            var session = { async send(params) { events.push(params); } };
            await payloadHandler(session);

            expect(events).to.deep.equal([{
              type: 'text',
              text: 'reply action'
            }]);
          });

          it('should add a next flow handler if a next flow exists', async function () {
            var dialog = new FlowDialog({name:"TestFlowDialog", flows: {}});
            var flowHandler = dialog._compileFlow([
              {
                type: 'text',
                actions: {
                  reply: { type: 'reply', then: 'reply action'}
                }
              },
              "this is",
              "the next flow"
            ], [
              'onStart'
            ]);

            var replyHandler = dialog._getFlowHandler('onStart.reply');
            var events = [];
            var session = { async send(params) { events.push(params); } };
            await flowHandler({a:1}, session);
            await replyHandler({a:1},session);

            expect(events).to.deep.equal([
              {
                type: 'text',
                actions: [
                  { type: 'reply', text: 'reply', payload: 'TestFlowDialog:onStart.reply'}
                ]
              },

              // user clicks reply
              { type: 'text', text: 'reply action' },

              // only after the user clicks the reply action
              // does the next flow execute:
              { type: 'text', text: 'this is' },
              { type: 'text', text: 'the next flow' }
            ]);
          });
        });

        context('containing items with postback and reply actions with then flows', function () {
          it('should not add a flow handler items with a postback', async function () {
            var dialog = new FlowDialog({name:"TestFlowDialog", flows: {}});
            dialog._compileFlow([
              {
                type: 'text',
                items: {
                  firstItem: {
                    actions: {
                      postback: { type: 'postback', then: 'postback action'}
                    }
                  }
                }
              }
            ], [
              'onStart'
            ]);
            expect(dialog._flowHandlers).to.have.keys(
              'TestFlowDialog:onStart',
              'TestFlowDialog:onStart.firstItem.postback'
            );
            expect(dialog.postbackHandlers).to.have.keys(
              'TestFlowDialog:onStart.firstItem.postback'
            );

            var postbackHandler = dialog._getFlowHandler('onStart.firstItem.postback');
            var events = [];
            var session = { async send(params) { events.push(params); } };
            await postbackHandler({a:1},session);

            expect(events).to.deep.equal([{
              type: 'text',
              text: 'postback action'
            }]);
          });

          it('should not add a next flow handler when only postback actions are present', async function () {
            var dialog = new FlowDialog({name:"TestFlowDialog", flows: {}});
            dialog._compileFlow([
              {
                type: 'text',
                items: {
                  firstItem: {
                    actions: {
                      postback: { type: 'postback', then: 'postback action'}
                    }
                  }
                }
              },
              "this is",
              "the next flow"
            ], [
              'onStart'
            ]);

            expect(dialog._flowHandlers).to.have.keys(
              'TestFlowDialog:onStart',
              'TestFlowDialog:onStart.firstItem.postback'
            );
            var postbackHandler = dialog._getFlowHandler('onStart.firstItem.postback');
            var events = [];
            var session = { async send(params) { events.push(params); } };
            await postbackHandler({a:1},session);

            expect(events).to.deep.equal([
              { type: 'text', text: 'postback action' }
            ]);
          });
        });

        context('containing a dynamically generated list of items', function () {
          it('should add a reply flow handler when reply items are provided', async function () {
            var dialog = new FlowDialog({name:"TestFlowDialog", flows: {}});
            dialog._compileFlow([
              {
                type: 'text',
                items: ()=> ([
                  {
                    id: 'firstItem',
                    actions: [
                      { reply: { type: 'reply', thenFlow: '#flow2'} }
                    ]
                  }
                ]),
                replyFlows: {
                  "#flow2":  "Hello from flow2"
                }
              },
              "this is",
              "the next flow"
            ], [
              'onStart'
            ]);
            expect(dialog._flowHandlers).to.have.keys(
              'TestFlowDialog:onStart',
              'TestFlowDialog:#flow2',
              'TestFlowDialog:onStart.@nextflow(1)' // replyFlows causes flow breaking
            );

            var replyHandler = dialog._getFlowHandler('TestFlowDialog:#flow2');
            var events = [];
            var session = { async send(params) { events.push(params); } };
            await replyHandler({a:1},session);

            // postback handler doesn't trigger the next flow
            expect(events).to.deep.equal([
              { type: 'text', text: 'Hello from flow2' },
              { type: 'text', text: 'this is' },
              { type: 'text', text: 'the next flow' }
            ]);
          });

          it("should add a postback flow handler which action's value to the handler", async function () {
            var dialog = new FlowDialog({name:"TestFlowDialog", flows: {}});
            var flowHandler = dialog._compileFlow([
              {
                type: 'list',
                items: ()=> [
                  {
                    id: 'firstItem',
                    actions: [{
                      text: 'buttonText',
                      type: 'postback',
                      value: "FOO",
                      thenFlow: '#flow1'
                    }]
                  }
                ],
                postbackFlows: {
                  "#flow1":  "Hello from flow1. Postback value={{value}}"
                }
              }
            ], [
              'onStart'
            ]);

            expect(dialog._flowHandlers).to.have.keys(
              'TestFlowDialog:onStart',
              'TestFlowDialog:#flow1'
            );
            expect(dialog.postbackHandlers).to.have.keys(
              'TestFlowDialog:#flow1'
            );


            // low-level postback handler:
            var postbackHandler = dialog.getPostbackHandler('TestFlowDialog:#flow1');
            var events = [];
            var postbackActionButtonArgs;
            var session = {
              async send(params) { events.push(params); },
              postbackActionButton(postbackName, text, args) {
                postbackActionButtonArgs = {postbackName, text, args};
                return {
                  text, type:'postback',
                  payload: { method: postbackName, args }
                };
              }
            };

            // Flow starts
            await flowHandler({}, session);
            events = [];  // clear the events - we won't test this

            await postbackHandler(session, "FOO");

            expect(postbackActionButtonArgs).to.deep.equal({
              postbackName: 'TestFlowDialog:#flow1',
              text: 'buttonText', // id becomes the name
              args: 'FOO'
            });
            // postback handler doesn't trigger the next flow
            expect(events).to.deep.equal([{
              type: 'text',
              text: 'Hello from flow1. Postback value=FOO'
            }]);
          });
        });

        context('containing various other actions', function () {
          var makeFlowWithActions = function (actions) {
            var dialog = new FlowDialog({name:"TestFlowDialog", flows: {}});
            return dialog._compileFlow([
              {
                text: "text",
                actions
              }
            ], [
              'onStart'
            ]);
          };

          it('should compile a link action', async function () {
            var handler = makeFlowWithActions({
              myLink: {
                uri: "http://something.com"
              }
            });
            var events = [];
            var session = { async send(params) { events.push(params); } };
            await handler({a:1},session);

            // postback handler doesn't trigger the next flow
            expect(events).to.deep.equal([
              { type: 'text', text: "text",
                actions: [{
                  type:'link',
                  text: 'myLink',
                  uri:'http://something.com'
                }]
              }
            ]);
          });

          it('should compile a buy action', async function () {
            var handler = makeFlowWithActions({
              shoes: {
                amount: 5000
              }
            });
            var events = [];
            var session = { async send(params) { events.push(params); } };
            await handler({a:1},session);

            // postback handler doesn't trigger the next flow
            expect(events).to.deep.equal([
              { type: 'text', text: "text",
                actions: [{
                  type:'buy',
                  text: 'shoes',
                  amount: 5000
                }]
              }
            ]);
          });

          it('should compile a locationRequest', async function () {
            var handler = makeFlowWithActions({
              "my location": {
                type: 'locationRequest'
              }
            });
            var events = [];
            var session = { async send(params) { events.push(params); } };
            await handler({a:1},session);

            // postback handler doesn't trigger the next flow
            expect(events).to.deep.equal([
              { type: 'text', text: "text",
                actions: [{
                  type:'locationRequest',
                  text: 'my location'
                }]
              }
            ]);
          });

          it('should compile a share action', async function () {
            var handler = makeFlowWithActions({
              "share": {
                type: 'share'
              }
            });
            var events = [];
            var session = { async send(params) { events.push(params); } };
            await handler({a:1},session);

            // postback handler doesn't trigger the next flow
            expect(events).to.deep.equal([
              { type: 'text', text: "text",
                actions: [{
                  type:'share'
                }]
              }
            ]);
          });



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
                            items: { // these are postbacks - not flow breaking!
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

  describe('FlowDialog helpers', function () {
    context('makeHandlerVars', function () {
      it('should store globals, locals and volatiles', function () {
        var session = new Session({app:{}, globals:{A:1}, currentFrame: {locals:{b:2}}, volatiles:{c:3}});
        expect(makeHandlerVars(session)).to.deep.equal({A:1, b:2, c:3});
      });
      it('should provide a value key if second arg is defined', function () {
        var session = new Session({app:{}, globals:{A:1}, currentFrame:{locals:{b:2}}, volatiles:{c:3}});
        expect(makeHandlerVars(session, 'the-value')).to.deep.equal({A:1, b:2, c:3, value: 'the-value'});
        expect(makeHandlerVars(session, undefined)).to.deep.equal({A:1, b:2, c:3});
      });
    });
  });
});

// useful sort comparison fn when deep-equal checking two arrays of unordered objects
function jsonSort(x,y) {
  return JSON.stringify(x)>JSON.stringify(y);
}
