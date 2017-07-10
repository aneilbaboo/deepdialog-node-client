import {isString, isArray, isFunction, isUndefined, isNumber, isNull} from 'util';
import {isPlainObject} from 'lodash';
import assert from 'assert';

import micromustache from 'micromustache';

import {setPath} from './objpath';
import {anyPattern} from './constants';
import Dialog from './dialog';
var util = require('./util'); // so we can stub sleep in tests
import log from './log';

//
// Definitions
//
// flows = { key: flow, *}
// flow = flowCommand | [flowCommand*]
// flowCommand = string | handler | flowObject
// flowObject = waitCommand | messageCommand | ifCommand | startCommand
// waitCommand = { type: 'wait', seconds: float }
// conditionalCommand = { type: 'conditional', if: handler, then: flow [, else: flow] }
// startCommand = { type: 'start', start: startParam, then: flow, thenId: flowKey }
// startParam = string | {dialog:string, args:Object} | ([vars [, session[, path]]]) => {dialog, params}
// messageCommand = listCommand | carouselCommand | textCommand | imageCommand
// textCommand = {
//   type: 'text',
//   text: 'string'
//   actions: [action*] || actionsHandler
// }
// imageCommand = {
//   type: 'image',
//   text: string,
//   mediaUrl: string,
//   medialType: string, // optional
//   actions: [action*] || actionsHandler // optional
// }
// listCommand | carouselCommand = {
//   type: 'list' | 'carousel',
//   actions: [action*] || actionsHandler // optional,
//   items: [item*] || itemsHandler,
//   displaySettings: { imageAspectRatio: 'horizontal' | 'square' }
// }
// action = {
//  id: string,
//  type:'reply'|'postback'|'link'|'locationRequest'|'share'|'buy'
//  text: string, // except for share
//  uri: string // for type:uri
//  payload: string // for type:postback and type:reply
//  amount: int // for type:buy
//  currency: string // for type:buy
//  // the following are valid for type:reply and type:postback
//  // note that 'then' values may not be returned from dynamically
//  // generated actions.  This is because 'then' values need to be compiled
//  // and dynamic evaluation happens at run time
//  then: flow, // if flow is a handler, handler may return a flowKey
//  thenFlow: Array | string // representing a relative or absolute flow path
// }
// item = {
//   title: string,
//   description: string,
//   mediaUrl: string,
//   mediaType: string,
//   size: 'compact' | 'large',
//   actions: [action*] | {id:action*}
// }
// flowCommandType = text|image|list|carousel
// handler = ([session [, path [, arg]]]) => { }
//


/**
* FlowDialog - Allows users to script flows. See the [documentation on github](https://github.com/aneilbaboo/deepdialog-node-client/blob/aneil/flowDialog/docs/flowscript.md)
* @extends Dialog
*/
export default class FlowDialog extends Dialog {
  constructor({flows, handlers, ...dialogArgs}) {
    super(dialogArgs);
    this._flowHandlers = {};
    this._namedHandlers = handlers;
    var compiledFlows = this._compileFlows(flows || {});
    if (compiledFlows.onStart) {
      this.onStart(async (session) => {
        await compiledFlows.onStart(
          makeHandlerVars(session),
          session,
          ['onStart']
        );
      });
    }
  }

  /**
   * startFlow - Switches flow of control
   *
   * @param {type} path    Description
   * @param {type} session Description
   *
   * @return {type} Description
   */
  async startFlow(path, session) {
    var handler = this._getFlowHandler(path);
    await handler(makeHandlerVars(session), session, path);
  }

  /**
   * _compileFlow - Adds the flow to the dialog, adding handlers as needed
   *
   * @param {Dialog} dialog Description
   * @param {Object|Array|Function|string} flow   Description
   * @param {Array} path   Description
   * @param {Object} options - see _compileFlow
   * @param {Array} options.nextFlow used by the system to indicate the flow
   *                    that will be started after a flow breaker command
   *                    completes (see isFlowBreaker)
   *
   * @return {Function} returns a handler
   */
  _compileFlow(flow, path, options={}) {
    log.silly('_compileFlow(%j,%j,%j)', flow, path, options);
    flow = normalizeFlow(flow);

    var compiledCommands = [];
    var cmd;
    var nextflowCount = 0;
    var commandCount = 0;
    var addCompiledCommand = function (compiledCommand) {
      if (commandCount==0) {
        compiledCommands.push(async (vars, session)=>{
          log.debug('%s begin (session:%s)', flowKey, session.id);
          await compiledCommand(vars, session, path);
        });
      } else {
        compiledCommands.push(compiledCommand);
      }

      if (commandCount==(flow.length-1)) {
        compiledCommands.push((vars, session)=>log.debug('%s end (session:%s)', flowKey, session.id));
      }
      commandCount += 1;
    };

    while (flow.length>0) {
      [cmd, ...flow] = flow;
      if (isFunction(cmd)) {
        addCompiledCommand(cmd);
      } else if (isFlowBreaker(cmd)) {
        // the next flow should not be executed after a flow breaker.
        // Instead, it should execute after the flow breaker's subflow
        //  e.g., in the following flow,
        //     * the start command is a flow breaker
        //     * the start.then flow is a subflow
        //     * the text command "innerNextFlow!" is a next flow
        //
        // onStart: [
        //   { for: [{i:1}, ({i})=>i<3, {i:1}],
        //     do: [
        //      { start: "MyDialog", then: "subFlow!" }
        //      "innerNextFlow!"
        //     ]
        //   }
        //   "outerNextFlow!"
        // ]
        //
        // In this loop we must execute the following operations:
        //   * initialize iteration
        //   * test the condition,
        //        if it is true, continue;
        //        otherwise, start the outerNextFlow
        //   * run start command  (flow is broken)
        //     > we must wait for MyDialog to complete
        // Then, when MyDialog finishes,
        //   * run the subflow
        //   * run the inner nextFlow
        //   * increment the for loop variables
        //   * start the for loop flow at test condition
        //
        // The code below breaks the a flow into parts - e.g., the do
        //   flow will be broken into a part containing the start command
        //   and another flow containing the inner flow.
        // When the subflow is compiled, it is provided with the nextFlow
        //   path, and it calls it when it is complete.

        // Do not call anything after a flow breaker!
        let outerOptions = options;
        let flowBreakerOptions = {...options, nextFlow: undefined};

        // break the rest of the flow into a separate handler, if it exists
        if (flow.length>0) {
          nextflowCount += 1;
          let nextId = commandId(flow[0], options.strictFlowId) || `@nextflow(${nextflowCount})`;
          let nextFlowPath = appendFlowPathId(path, nextId);
          this._compileFlow(flow, nextFlowPath, outerOptions);
          flowBreakerOptions = {...options, nextFlow: nextFlowPath };
        } else {
          flowBreakerOptions = outerOptions;
        }
        // if the next flow exists, it will be invoked after
        // then/else/do flows are executed:
        addCompiledCommand(this._compileCommand(cmd, path, flowBreakerOptions));

        // the flow breaker terminates this flow, and prevents the nextFlow
        // from being immediately executed: clear the nextFlow from the options!
        options = { ...options, nextFlow: undefined};
        break;
      } else {
        addCompiledCommand(this._compileCommand(cmd, path, options));
      }
    }

    // if there is a nextFlow option then ensure that this is executed last
    if (options.nextFlow) {
      let nextFlowHandler = this._getFlowHandler(options.nextFlow);
      addCompiledCommand(async (vars, session) => {
        // note: if `value` was defined in the flow where the flow breaker
        // command started, it is undefined after the flow breaker
        // TODO: preserve `value` inside the next flow(s)
        //  see https://github.com/aneilbaboo/deepdialog-node-client/issues/10
        await nextFlowHandler(makeHandlerVars(session), session);
      });
    }

    var flowKey = this.flowKey(path);
    var handler = async (vars, session) => {
      for (let compiledCommand of compiledCommands) {
        try {
          await compiledCommand(vars, session, path);
        } catch (e) {
          if (e.break) {
            await this.startFlow(options.breakFlow, session);
            break;
          }
        }
        // session vars may have changed
        // update vars before calling the next command
        vars = makeHandlerVars(session, vars.value);
      }
    };

    return this._addFlowHandler(path, handler);
  }

  /**
   * _compileFlows - Description
   *
   * @param {Object} flows Key is path id, value is a flow
   * @param {Array} path
   * @param {Object} options - see _compileFlow
   *
   * @return {Object} An object mapping to handler functions
   */
  _compileFlows(flows, path, options={}) {
    log.silly('_compileFlows(%j, %j, %j)', flows, path, options);
    flows = normalizeFlows(flows);
    path = path || [];
    var result = {};
    for (let id in flows) {
      var flow = flows[id];
      var flowPath = appendFlowPathId(path, id);
      var handler = this._compileFlow(flow, flowPath, options);
      result[id] = handler;
    }
    log.silly('_compileFlows(%j)=>', result);
    return result;

  }
  _compileCommand(cmd, path, options={}) {
    if (isMessageType(cmd.type)) {
      return this._compileMessageCommand(cmd, path, options);
    } else {
      switch (cmd.type) {
        case 'start': return this._compileStartCommand(cmd, path, options);
        case 'finish': return this._compileFinishCommand(cmd, path, options);
        case 'conditional': return this._compileConditionalCommand(cmd, path, options);
        case 'wait': return this._compileWaitCommand(cmd, path, options);
        case 'set': return this._compileSetCommand(cmd, path, options);
        case 'setv': return this._compileSetVCommand(cmd, path, options);
        case 'exec': return this._compileExecCommand(cmd, path, options);
        case 'iteration': return this._compileIterationCommand(cmd, path, options);
        case 'break': return this._compileIterationBreak(cmd, path, options);
        default: throw new Error(`Failed while compiling unrecognized command: ${JSON.stringify(cmd)} at ${this.flowKey(path)}`);
      }
    }
  }

  _compileExecCommand(cmd, path) {
    var [handlerName, args] = normalizeExecCommand(cmd).exec;
    var handler = this._namedHandlers[handlerName];
    if (!handler) {
      throw new Error(`Attempt to exec undefined handler ${handler}`);
    }
    return async (vars, session) => {
      return await handler({...vars, ...args}, session, path);
    };
  }

  _compileSetCommand(cmd, path) {
    return async (vars, session) => {
      var expandedParams = await this._expandSetParam(cmd.set, vars, session, path);
      await session.save(expandedParams);
    };
  }

  _compileSetVCommand(cmd, path) {
    return async (vars, session) => {
      var expandedParams = await this._expandSetParam(cmd.setv, vars, session, path);
      session.setv(expandedParams);
    };
  }

  async _expandSetParam(params, vars, session, path) {
    var expandedVars = await this._expandCommandParam(params, vars, session, path);
    var processedVars = {};
    const destructureRegex = /\{([\s\w,]*)}/;

    for (let v in expandedVars) {
      let destructureMatch = destructureRegex.exec(v);
      if (destructureMatch) {
        let expanded = expandedVars[v];
        let destructuredVars = destructureMatch[1].split(",").map(s=>s.trim()).filter(s=>s.length>0);
        for (let dvar of destructuredVars) {
          processedVars[dvar] = expanded[dvar];
        }
      } else {
        setPath(processedVars, v, expandedVars[v]);
      }
    }
    return processedVars;
  }
  _compileWaitCommand(cmd, path) {
    return async (vars,session) => {
      var seconds = await this._expandCommandParam(cmd.wait, vars, session, path);
      await util.sleep(seconds * 1000); // stubbable in tests
    };
  }

  /**
   * _compileMessageCommand - converts a flow message command
   *            into parameters for Session.send, adding handlers as needed
   *
   * @param {Object} command describes a potentially hierarchical message
   * @param {Array} path    the ids leading to this command
   *
   * @return {Object} parameters suitable for session.send
   */
  _compileMessageCommand(command, path, options={}) {
    log.silly('_compileMessageCommand(%j,%j)', command, path);
    var compiledParams = {
      ...command,
      actions: this._compileMessageActions(command.actions, path, options, 'reply'),
      items: this._compileMessageItems(command.items, path, options),
      postbackFlows: undefined,
      replyFlows: undefined,
      id: undefined
    };

    if (command.postbackFlows) {
      this._compilePostbackFlows(command.postbackFlows, path, options);
    }
    if (command.replyFlows) {
      this._compileReplyFlows(command.replyFlows, path, options);
    }

    return async (vars, session) => {
      var expandedParams = await this._expandCommandParam(
        compiledParams, vars, session, path
      );

      log.silly('_compileMessageCommand(',command,',',path,') final expansion =>', expandedParams);
      await session.send(expandedParams);

      var {items,actions} = expandedParams;

      if (isFlowBreaker(command) && options.nextFlow) {
        // this command broke the flow.  That may be because it had dynamic
        // items or actions.  However, it is possible that the generated
        // items/actions are not actually flow-breaking (i.e., no reply actions).
        // If so, we need to immediately resume the nextFlow
        if (!itemsHasFlowBreakers(items) && !actionsHasFlowBreakers(actions)) {
          await this.startFlow(options.nextFlow, session);
        }
      }
    };
  }

  _compilePostbackFlows(flows, path, options) {
    let postbackFlows = this._compileFlows(flows, path, options);
    for (let flowId in postbackFlows) {
      let flowHandler = postbackFlows[flowId];
      let flowKey = this.flowKey(appendFlowPathId(path, flowId));
      this.onPostback(flowKey, async (session, value) => {
        await flowHandler(makeHandlerVars(session, value), session, path);
      });
    }
  }

  _compileReplyFlows(flows, path, options) {
    let replyFlows = this._compileFlows(flows, path, options);
    for (let flowId in replyFlows) {
      let flowHandler = replyFlows[flowId];
      let flowKey = this.flowKey(appendFlowPathId(path, flowId));
      this.onPayload(flowKey, async (session) => {
        await flowHandler(makeHandlerVars(session), session, path);
      });
    }
  }

  /**
   * _compileMessageItems - converts a flow message item into Session.send version,
   *                  adding handlers to the dialog as needed
   *
   * @param {type} items Description
   * @param {type} path  Description
   *
   * @return {Function} (vars, session) => Object
   */
  _compileMessageItems(items, path, options) {
    log.silly('_compileMessageItems(%j, %j, %j)', items, path, options);
    if (isFunction(items)) {
      return async (vars, session)=>{
        var itemsArray = await items(vars, session, path);

        return itemsArray.map(item=> ({
          ...item,
          actions: item.actions.map(action=>this._actionWithPayload(action, session))
        }));
      };
    } else if (isExecCommand(items)) {
      return this._compileExecCommand(items, path);
    } else if (items) {
      var normalizedItems = normalizeItems(items);
      var compiledItems = normalizedItems.map(item=>deleteUndefinedKeys({
        ...item,
        id: undefined,
        actions: this._compileMessageActions(
          item.actions,
          appendFlowPathId(path, item.id),
          options,
          'postback'
        )
      }));
      return async (vars, session) => {
        return this._expandCommandParam(compiledItems, vars, session, path);
      };
    }
  }

  /**
   * _compileMessageActions - Description
   *
   * @param {type} actions Description
   * @param {type} path    Description
   *
   * @return {type} Description
   */
  _compileMessageActions(actions, path, options, defaultType) {
    log.silly('_compileMessageActions(%j, %j, %j, %j)', actions, path, options, defaultType);
    if (isFunction(actions)) {
      return async (vars, session)=>{
        var resolvedActions = await actions(vars, session, path);
        return resolvedActions.map(action=>this._actionWithPayload(action, session));
      };
    } else if (isExecCommand(actions)) {
      return this._compileExecCommand(actions, path);
    } else if (actions) {
      actions = normalizeActions(actions, path, defaultType);
      var compiledActions = actions.map(action=>this._compileMessageAction(
        action, path, options, defaultType
      ));
      return async (vars, session)=>{
        return await Promise.all(compiledActions.map(ca=>ca(vars, session, path)));
      };
    }
  }

  /**
   * _compileMessageAction - Description
   *
   * @param {type} action      Description
   * @param {type} path        Description
   * @param {type} defaultType Description
   *
   * @return {type} Description
   */
  _compileMessageAction(action, path, options, defaultType) {
    if (isFunction(action)) {
      return async (vars, session)=>this._actionWithPayload(
        await action(vars, session, path),
        session
      );
    } else {
      var actionCopy = {type: defaultType, ...action};
      let actionPath = appendFlowPathId(path, action.id);
      let thenHandler;
      let actionFlowKey = this.flowKey(actionPath);

      // create or retrieve the thenHandler:
      if (action.then) {
        thenHandler = this._compileFlow(action.then, actionPath, options);
        delete actionCopy.then;
        actionCopy.thenFlow = actionPath;
      } else if (action.thenFlow) {
        thenHandler = this._getFlowHandler(action.thenHandler);
      } else if (options.nextFlow) {
        thenHandler = this._getFlowHandler(options.nextFlow);
      }

      // depending on the action type,
      // add an onPostback or onPayload handler:
      switch (actionCopy.type) {
        case 'postback':
          log.silly('_compileMessageActions adding postbackHandler at %j', actionFlowKey);
          this.onPostback(actionFlowKey, async (session, args) => {
            await thenHandler(makeHandlerVars(session, args), session, path);
          });
          break;
        case 'reply':
          log.silly('_compileMessageActions adding payloadHandler at %j', actionFlowKey);
          this.onPayload(actionFlowKey, async (session) => {
            await thenHandler(makeHandlerVars(session), session, path);
          });
          break;
        default:
          throw new Error(`Invalid action: then and thenFlow may only be used with `+
            `postback and reply type actions, but received: ${JSON.stringify(action)}`);
      }

      return async (vars, session)=>this._actionWithPayload(
        await this._expandCommandParam(actionCopy, vars, session, path, this._namedHandlers),
        session
      );
    }
  }

  _compileConditionalCommand(cmd, path, options={}) {
    log.silly('_compileConditionalCommand(%j,%j,%j)', cmd, path, options);
    var {id, if:test, then:thenFlow, else:elseFlow} = cmd;
    id = id || 'if';
    if (!thenFlow && !elseFlow) {
      throw new Error(`Invalid if command %j must contain then or else flow`, cmd);
    }
    var thenPath = appendFlowPathId(path, id, 'then');
    var elsePath = appendFlowPathId(path, id, 'else');
    var thenHandler = this._compileFlow(thenFlow || [], thenPath, options);
    var elseHandler = this._compileFlow(elseFlow || [], elsePath, options);
    return async (vars, session) => {
      var testResult = await this._expandCommandParam(test, vars, session, path);
      if (testResult) {
        await thenHandler(vars, session, thenPath);
      } else if (elseHandler) {
        await elseHandler(vars, session, elsePath);
      }
    };
  }

  _compileIterationCommand(cmd, path, options) {
    var {id, initializer, condition, increment, do:doFlow} = cmd; //normalizeIterationCommand(cmd);
    var compiledInitializer = this._compileIterationInitializer(initializer, path);
    var compiledCondition = this._compileIterationCondition(condition, path);
    var compiledIncrement = this._compileIterationIncrement(increment, path);
    var doPath = appendFlowPathId(path, id, 'do');
    var loopPath = appendFlowPathId(path, id, 'loop'); // includes the condition
    var endPath = appendFlowPathId(path, id, 'end');

    // must install the loopFlow so we can compile the doFlow which
    // references it
    var compiledLoop = async (vars, session) => {
      var condition = await compiledCondition(vars, session);
      if (condition) {
        await this.startFlow(doPath, session);
      } else {
        await this.startFlow(endPath, session);
      }
    };
    this._addFlowHandler(loopPath, compiledLoop);

    assert(isArray(doFlow));
    doFlow.push(compiledIncrement);

    this._compileFlow(doFlow, doPath, {
      ...options,
      nextFlow: loopPath,
      breakFlow: endPath
    });

    this._compileFlow([], endPath, options); // could eventually put a finally block here

    return async (vars, session) => {
      await compiledInitializer(vars, session);
      await this.startFlow(loopPath, session);
    };
  }

  _compileIterationInitializer(initializer, path) {
    if (isFunction(initializer)) {
      return initializer;
    } else if (isPlainObject(initializer)) {
      return async (vars, session) => {
        let initialVars = await this._expandCommandParam(initializer, vars, session, path);
        await session.save(initialVars);
      };
    } else if (!isUndefined(initializer)) {
      throw new Error(`Invalid initializer in for command: ${initializer}`);
    }
  }

  _compileIterationCondition(condition, path) {
    if (isFunction(condition)) {
      return condition;
    } else if (isPlainObject(condition)) {
      return async (vars, session) => {
        var expandedCondition = await this._expandCommandParam(condition, vars, session, path);
        for (let varName in condition) {
          if (vars[varName]>=expandedCondition[varName]) {
            return false;
          }
        }
        return true;
      };
    }
    throw new Error(`Invalid iteration condition. Expecting a function or `+
      `object, but received: ${condition}`
    );
  }

  _compileIterationIncrement(increment, path) {
    if (isFunction(increment)) {
      return increment;
    } else if (isPlainObject(increment)) {
      return async (vars, session) => {
        var expandedIncrement = await this._expandCommandParam(increment, vars, session, path);
        var iterVars = {};
        for (let varName in expandedIncrement) {
          iterVars[varName]=vars[varName]+expandedIncrement[varName];
        }
        await session.save(iterVars);
      };
    }
    throw new Error(`Invalid iteration condition. Expecting a function or `+
      `object, but received: ${increment}`
    );
  }

  _compileFinishCommand(cmd, path) {
    return async (vars, session) => {
      var result = await this._expandCommandParam(cmd.finish, vars, session, path);
      await session.finish(result);
    };
  }

  _compileIterationBreak(cmd, path, options) {
    var breakFlow = options.breakFlow;
    var breakError = new Error(`Invalid break encountered at ${this.flowKey(path)}`);
    breakError.break = true;
    if (!breakFlow) {
      throw breakError;
    }

    return function () { throw breakError; };
  }

  _compileStartCommand(cmd, path, options) {
    log.silly('_compileStartCommand(%j,%j,%j)',cmd,path,options);
    var {start, then} = cmd;
    var dialogName;
    var thenPath = appendFlowPathId(path, cmd.id, 'then');
    var compiledStartParam;

    if (isFunction(start)) {
      dialogName = anyPattern;
      compiledStartParam = start;
    } else {
      [dialogName] = normalizeStartParam(start);
      compiledStartParam = start;
    }

    // require result handler if there is a nextFlow
    if (options.nextFlow) {
      then = then || [];
    }

    if (then) {
      let thenHandler = this._compileFlow(then, thenPath, options);
      var tag = this.flowKey(thenPath);
      this.onResult(dialogName, tag, async (session, value) => {
        await thenHandler(makeHandlerVars(session, value), session, path);
      });
    }

    return async (vars, session) => {
      var startParam = await this._expandCommandParam(compiledStartParam, vars, session, thenPath);
      var [dialogName, args] = normalizeStartParam(startParam);
      await session.start(dialogName, args, tag);
    };
  }

  _actionWithPayload(action, session) {
    log.silly('_actionWithPayload(%j)', action);
    if (action.then) {
      throw new Error(`Flows are not permitted in dynamically generated actions.  Use thenFlow instead of then in %j`);
    }

    if (action.thenFlow) {
      switch (action.type) {
        case 'postback':
          return session.postbackActionButton(
            this.flowKey(action.thenFlow),
            action.text,
            action.value
          );

        case 'reply':
          return {
            type: 'reply',
            text: action.text,
            payload: this.flowKey(action.thenFlow)
          };

        default:
          throw new Error(`Invalid action - thenFlow is only permitted in postback and reply actions: ${action}`);
      }
    } else {
      return action;
    }
  }


  //
  // Expansion
  //

  /**
   * expandCommandParam - deep converts all value handlers and string templates
   *   in an object or array to their values.
   *
   * @param {Object|Array|string|Number|handler} param
   * @param {Object} vars    Description
   * @param {Session} session Description
   * @param {Array} path    Description
   *
   * @return {object} The expanded value
   */
  async _expandCommandParam(param, vars, session, path) {
    if (isFunction(param)) {
      return await param(vars, session, path);
    } else if (isArray(param)) {
      return await Promise.all(param.map(elt=>this._expandCommandParam(elt, vars, session, path)));
    } else if (isPlainObject(param)) {
      if (isExecCommand(param)) {
        let handler = this._compileExecCommand(param, path);
        return await handler(vars, session);
      } else {
        return await this._expandObjectParam(param, vars, session, path);
      }
    } else if (isString(param)) {
      return micromustache.render(param, vars);
    } else {
      return param;
    }
  }

  async _expandObjectParam(param, vars, session, path, handlers) {
    let keys = Object.keys(param);
    return deleteUndefinedKeys(await zipPromisesToHash(keys,
      keys.map(k=>this._expandCommandParam(
        param[k], vars, session, path, handlers)
      )
    ));
  }

  //
  // Flow handler access
  //

  /**
   * flowKey - converts arrays and strings into fully-resolved flowKeys
   *               MyDialog.flowKey("a.b.c") => "MyDialog:a.b.c"
   *               MyDialog.flowKey(['a','b','c']) => "MyDialog:a.b.c"
   *
   * @param {Array|string} path
   *
   * @return {string} returns a string of the form 'DialogName:x.y.z'
   */
  flowKey(path) {
    if (isString(path)) {
      var splitPath = path.split(":");
      if (splitPath.length==2 && splitPath[0]==this.name && splitPath[1].length>0) { // if it has 2 components...
        return path;
      } else if (splitPath.length==1 && path.length>0) {
        return `${this.name}:${path}`;
      }
    } else if (isArray(path) && path.length>0) {
      var reducedPath = appendFlowPathId([], ...path); // respects #id semantics
      return `${this.name}:${reducedPath.join(".")}`;
    }
    throw new Error(`Invalid path ${path} provided to ${this.name}.flowKey.`);
  }

  _getFlowHandler(path) {
    var fkey = this.flowKey(path);
    var result = this._flowHandlers[fkey];
    if (!result) {
      throw new Error(`Attempt to access undefined flowHandler ${fkey}`);
    }
    return result;
  }

  _addFlowHandler(path, handler) {
    log.silly('_addFlowHandler(%j, function(){...})', path);
    var fkey = this.flowKey(path);
    if (this._flowHandlers[fkey]) {
      throw new Error(`Attempt to create handler with duplicate key: ${fkey}`);
    } else {
      this._flowHandlers[fkey] = handler;
    }
    return handler;
  }
}

//
//
// Utility functions
//
//

// const _fnRegex = /(\w+)\([\w,]*\)/;


//
//
// NORMALIZATION
//
//

export function normalizeFlows(flows) {
  log.silly('normalizeFlows(',flows,')');
  if (isPlainObject(flows)) {
    var normFlows = {};
    for (var id in flows) {
      normFlows[id] = normalizeFlow(flows[id]);
    }
  } else {
    throw new Error(`Expecting an Object describing flows, but received: ${JSON.stringify(flows)}`);
  }
  return normFlows;
}

export function normalizeFlow(flow) {
  if (isArray(flow)) {
    log.silly('normalizeFlow(array: %j)', flow);
    return flow.map(normalizeFlowCommand);
  } else if (!flow) {
    return [];
  } else {
    return [normalizeFlowCommand(flow)];
  }
}

export function normalizeFlowCommand(command) {
  if (isFunction(command)) {
    return command;
  } else if (isString(command)) {
    return {type:'text', text:command};
  } else if (isPlainObject(command)) {
    var type = command.type || inferCommandType(command);

    if (type) {
      command = {type, ...command};
      switch (type) {
        case 'list':
        case 'carousel':
        case 'text':
        case 'image':
          return normalizeMessageCommand(command);
        case 'set':
          return normalizeSetCommand(command);
        case 'conditional':
          return normalizeConditionalCommand(command);
        case 'start':
          return normalizeStartCommand(command);
        case 'exec':
          return normalizeExecCommand(command);
        case 'iteration':
          return normalizeIterationCommand(command);
        default:
          return command;
      }
    }
  }

  throw new Error(`Invalid command: ${JSON.stringify(command)}`);
}

export function normalizeExecCommand(command) {
  log.silly('normalizeExecCommand(%j)', command);
  if (isString(command.exec)) {
    return { ...command, exec: [command.exec, {}]};
  } else if (isArray(command.exec)) {
    return command;
  } else {
    throw new Error(`Invalid exec command ${command}`);
  }
}

export function normalizeSetCommand(command) {
  log.silly('normalizeSetCommand(%j)', command);
  return command;
}

export function normalizeConditionalCommand(command) {
  log.silly('normalizeConditionalCommand(%j)', command);
  if (command.hasOwnProperty('if')) {
    return {id: command.id || 'if', ...command};
  } else if (command.hasOwnProperty('when')) {
    return {
      id: command.id || 'when',
      type: 'conditional',
      if: command.when,
      then: command.do
    };
  } else if (command.hasOwnProperty('unless')) {
    return {
      id: command.id || 'unless',
      type: 'conditional',
      if: command.unless,
      then: [],
      else: command.do
    };
  }
}

export function normalizeIterationCommand(command) {
  log.silly('normalizeIterationCommand(%j)', command);

  if (command.while) {
    return {
      id: command.id || 'while',
      type: 'iteration',
      condition: command.while,
      do: command.do,
      finally: command.finally,
    };
  } else if (command.until) {
    var negatedCondition = negateCondition(command.until);
    return {
      id: command.id || 'until',
      type: 'iteration',
      condition: negatedCondition,
      do: command.do,
      finally: command.finally,
    };
  }
  // else if (command.forEach) {
  //   var initializer = command.forEach;
  //   if (!isPlainObject(initializer)) {
  //     throw new Error(`Expecting a plain Object argument to forEach in ${JSON.stringify(command)}`);
  //   }
  //   return {
  //     id: command.id || 'forEach',
  //     type: 'iteration',
  //     initializer: initializer,
  //     condition: normalizeForEachCondition(initializer),
  //     increment: normalizeForEachIncrement(initializer),
  //     do: command.do,
  //     finally: command.finally ? [forEachFinally, command.finally] : forEachFinally
  //   };
  // }
  else if (command.for) {
    let initializer = normalizeIterationInitializer(command.for[0]);
    let condition = normalizeIterationCondition(initializer, command.for[1]);
    let increment = normalizeIterationIncrement(initializer, command.for[2]);
    return {
      id: command.id || 'for',
      type: 'iteration',
      initializer, condition, increment,
      do: command.do,
      finally: command.finally
    };
  } else if (command.condition && command.do) {
    return command;
  }
  throw new Error(`Invalid iteration command: ${JSON.stringify(command)}`);
}

export function negateCondition(condition) {
  if (isFunction(condition)) {
    return async (vars, session) => !(await condition(vars, session));
  } else {
    return !condition;
  }
}

export function normalizeIterationInitializer(initializer) {
  if (isString(initializer)) {
    return {[initializer]:0};
  } else if (isFunction(initializer) || isPlainObject(initializer)) {
    return initializer;
  } else if (isUndefined(initializer)) {
    return;
  }
  throw new Error(`Invalid initializer in iteration command: ${initializer}`);
}

export function normalizeIterationCondition(initializer, condition) {
  if (isNumber(condition) && isPlainObject(initializer)) {
    let iterVars = Object.keys(initializer);
    return (vars)=>iterVars.every(iv=>vars[iv]<condition);
  } else if (isPlainObject(condition)) {
    let iterVars = Object.keys(condition);
    return (vars)=>iterVars.every(iv=>vars[iv]<condition);
  } else if (isFunction(condition)) {
    return condition;
  }
  throw new Error(`Invalid condition in iteration command: ${initializer}`);
}

export function normalizeIterationIncrement(initializer, increment) {
  if (isNumber(increment) && isPlainObject(initializer)) {
    let result = {};
    for (let varName in initializer) {
      result[varName] = increment;
    }
    return result;
  } else if (isPlainObject(increment) || isFunction(increment)) {
    return increment;
  }
  throw new Error(`Invalid condition in iteration command: ${initializer}`);
}

export function normalizeStartCommand(command) {
  log.silly('normalizeStartCommand(%j)', command);
  if (!isFunction(command.start)) {
    var [dialog, _] = normalizeStartParam(command.start);
  }
  var id = command.id || `start(${dialog || '?'})`;
  return {...command, id};
}

export function normalizeMessageCommand(command) {
  log.silly('normalizeMessageCommand(%j)', command);
  var actions = command.actions ? normalizeActions(command.actions, 'reply') : undefined;
  var items = command.items ? normalizeItems(command.items) : undefined;
  var flows = command.flows ? normalizeFlows(command.flows) : undefined;

  return deleteUndefinedKeys({...command, actions, items, flows});
}

export function normalizeItems(items) {
  //log.silly('normalizeItems(%j)', items);
  if (isFunction(items)) {
    return items;
  } else if (isArray(items)) {
    return items.map(item=>({
      ...item,
      actions: normalizeActions(item.actions, 'postback')
    }));
  } else if (isPlainObject(items)) {
    var normalizedItems = [];
    for (let k in items) {
      var item = items[k];
      normalizedItems.push({
        id: k,
        title: item.title || k,
        actions: normalizeActions(item.actions, 'postback')
      });
    }
    return normalizedItems;
  } else if (!items) {
    return undefined;
  } else {
    throw new Error(`Expecting an Array or Object describing items, but received: ${JSON.stringify(items)}`);
  }
}

/**
 * normalizeActions - adds
 *
 * @param {Array} actions Description
 *
 * @return {Array} An object conforming to the action specification of the Session.send api
 */
export function normalizeActions(actions, defaultType) {
  log.silly('normalizeActions(%j,%j)', actions, defaultType);
  if (isArray(actions)) {
    return actions.map(action=>normalizeAction(action.id, action, defaultType));
  } else if (isPlainObject(actions)) {
    var normalizedActions = [];
    for (let k in actions) {
      var action = normalizeAction(k, actions[k], defaultType);
      var type = action.type;
      if (!type) {
        throw new Error(`Action type must be one of buy, link, postback, `+
          `reply, share or locationRequest. Unable to infer type of object: ${action}`);
      }
      normalizedActions.push(action);
    }
    return normalizedActions;
  } if (!actions) {
    return undefined;
  } else {
    throw new Error(`Expecting an Array or Object describing actions, but received: ${JSON.stringify(actions)}`);
  }
}

export function normalizeAction(id, action, defaultType) {
  log.silly('normalizeAction(%j, %j, %j)', id, action, defaultType);
  if (isAction(action)) {
    var type = action.type || inferActionType(action, defaultType);
    return deleteUndefinedKeys({
      ...action,
      id: action.id || id,
      text: type=='share' ? undefined :  action.text || id,
      type
    });
  } else if (isFlow(action)) {
    return {
      id: id,
      type: defaultType,
      text: id,
      then: normalizeFlow(action)
    };
  } else {
    throw new Error(`Unable to normalize action ${JSON.stringify(action)} for id:${id}`);
  }
}

function normalizeStartParam(param) {
  if (isString(param)) {
    return [param, undefined];
  } else if (isArray(param) && param.length==2) {
    return param;
  } else {
    throw new Error(`Invalid start parameter. ` +
      `Expecting {start:dialog...} or {start:[dialog, args]...}`);
  }
}

//
// Definitions
//
export function isFlow(obj) {
  return isArray(obj) || isFunction(obj) || isFlowCommand(obj);
}

export function isFlowCommand(obj) {
  return isString(obj) || isFunction(obj) || (
    isPlainObject(obj) && isCommandType(obj.type || inferCommandType(obj))
  );
}

export function commandId(cmd, strict) {
  var id;
  if (isFunction(cmd)) {
    id = cmd.name;
  } else if (isPlainObject(cmd)) {
    id = cmd.id;
  }
  if (!id && strict) {
    var cmdStr = isFunction(cmd) ? cmd.toString() : JSON.stringify(cmd);
    throw new Error(
      `Command following a flow breaking command must have an id `+
      `or handler must be a named function: ${cmdStr}`
    );
  }
  return id;
}

/**
 * isFlowBreaker - Commands which may require the server to relinquish control
 *          in the middle of a flow.  For example, a message containing action
 *          buttons breaks the flow because the server must wait for user input.
 *          Starting a dialog breaks the flow because the dialog may require
 *          user input or to be hosted in a separate app.
 *
 * @param {Object|Function} cmd a normalized command object
 *
 * @return {boolean} Description
 */
export function isFlowBreaker(cmd) {
  return !!(
    (!isArray(cmd) && isPlainObject(cmd)) &&
    (
      cmd.type=='conditional' ||
      cmd.type=='iteration' ||
      cmd.type=='start' ||
      cmd.type=='break' ||
      cmd.type=='finish' ||
      (
        isMessageType(cmd.type) && (
          actionsHasFlowBreakers(cmd.actions) ||
          itemsHasFlowBreakers(cmd.items) ||
          cmd.replyFlows
        )
      )
    )
  );
}

export function itemsHasFlowBreakers(items) {
  return isFunction(items) || (items && items.some(item=>actionsHasFlowBreakers(item.actions)));
}

export function actionsHasFlowBreakers(actions) {
  return isFunction(actions) || (actions && actions.some(action=>action.type=='reply'));
}

export function isExecCommand(obj) {
  return isPlainObject(obj) && (isString(obj.exec) || isArray(obj.exec));
}

export function isAction(obj) {
  return !!(isPlainObject(obj) && isActionType(obj.type || inferActionType(obj,'reply')));
}

export function isActionable(obj) {
  return isFlow(obj) || isAction(obj);
}

export function isActionType(type) {
  return ['reply','postback','link','share','buy','locationRequest'].includes(type);
}

export function isMessageType(type) {
  return ['text','image','list','carousel'].includes(type);
}

export function isCommandType(type) {
  return isMessageType(type) || ['wait', 'finish', 'start'].includes(type);
}

export function inferActionType(action, defaultType) {
  if (action.uri) {
    return 'link';
  } else if (action.amount) {
    return 'buy';
  } else if (action.then || action.thenFlow) {
    return defaultType;
  }
}

export function inferCommandType(command) {
  if (command.mediaUrl) {
    return 'image'; // this must come before command.text inference
  } else if (command.text) {
    return 'text';
  } else if (command.hasOwnProperty('finish')) { // value could be null or false
    return 'finish';
  } else if (command.start) {
    return 'start';
  } else if (command.wait) {
    return 'wait';
  } else if (command.set) {
    return 'set';
  } else if (command.setv) {
    return 'setv';
  } else if (
    command.hasOwnProperty('if') ||
    command.hasOwnProperty('when') ||
    command.hasOwnProperty('unless')
  ) { // could be null
    return 'conditional';
  } else if (command.exec) {
    return 'exec';
  } else if (
    command.for ||
    command.hasOwnProperty('while') ||
    command.hasOwnProperty('until')
  ) {
    return 'iteration';
  } else if (command.break) {
    return 'break';
  }
}

export function makeHandlerVars(session, value) {
  if (value!=undefined) {
    return {...session.globals, ...session.locals, ...session.volatiles, value};
  } else {
    return {...session.globals, ...session.locals, ...session.volatiles };
  }
}

export function deleteUndefinedKeys(o) {
  for (let k in o) {
    if (o[k]===undefined) {
      delete o[k];
    }
  }
  return o;
}

//
// Flow path helpers
//

export function isValidFlowId(id) {
  return isString(id) && /^[#]?[^\.#:|\r\n]+$/.test(id);
}

export function appendFlowPathId(path, ...ids) {
  var [id, ...rest] = ids;
  if (rest.length==0) {
    if (!isValidFlowId(id))  {
      throw new Error(`Invalid flow id (${id}). Ids must start with a `+
      `word character or # and must not contain periods or colons.`);
    }
    return (id.startsWith('#')) ? [id] : [...path, id];
  } else {
    var result= appendFlowPathId(appendFlowPathId(path, id), ...rest);
    return result;
  }
}

export function flowIdToText(id) {
  return id.startsWith("#") ? id.slice(1) : id;
}

export function flowPathFromKey(flowKey) {
  if (!isString(flowKey)) {
    throw new Error(`Expecting a string, but received ${flowKey}`);
  }

  var idComponents = flowKey.split(':');
  var pathComponents = idComponents.length>1 ? idComponents[1] : idComponents[0];
  return pathComponents.split('.');
}


/**
 * zipPromisesToHash - Takes an array of keys and promises,
 *                        resolves the promises and assigns the values
 *
 * @param {type} keys     Description
 * @param {type} promises Description
 *
 * @return {type} Description
 */
export async function zipPromisesToHash(keys, promises) {
  var result = {};
  var values = await Promise.all(promises);
  keys.forEach((key, idx) => result[key] = values[idx]);
  return result;
}

// Variable access sugar: $.myVar instead of ({myVar})=>myVar
// E.g.,
// { if: $.myVar, then: [ ... ] }
// instead of
// { if: ({myVar})=>myVar, then: [ ... ] }
//
export const $ = handlerPropertyProxy(vars=>vars);

export const dollarOperators = {
  gt: (value, other)=>value>other,
  gte: (value, other)=>value>=other,
  lt: (value, other)=>value<other,
  lte: (value, other)=>value<=other,
  equals: (value, other)=>value==other,
  isTruthy: (value)=>!!value,
  isFalsey: (value)=>!value,
  isNull: (value)=>isNull(value),
  isUndefined: (value)=>isUndefined(value),
  isString: (value)=>isString(value),
  isArray: (value)=>isArray(value),
  isPlainObject: (value)=>isPlainObject(value),
  isNumber: (value)=>isNumber(value),
  add: (value, other)=>value+other,
  sub: (value, other)=>value-other,
  mul: (value, other)=>value*other,
  div: (value, other)=>value/other,
  pow: (value, other)=>Math.pow(value, other)
};

function dollarOperatorHandler(target, opName) {
  return function (...args) {
    return handlerPropertyProxy(function (vars) {
      var value = target(vars);
      args = syncExpandCommandParam(args, vars);
      // class method - e.g., string.toLowerCase
      if (value && isFunction(value[opName])) {
        return value[opName](...args);
      } else {
        // dollar operators
        var op = dollarOperators[opName];
        if (op) {
          return op(value, ...args);
        }
      }
    });
  };
}

function syncExpandCommandParam(param, vars) {
  if (isFunction(param)) {
    return param(vars);
  } else if (isArray(param)) {
    return param.map(p=>syncExpandCommandParam(p, vars));
  } else if (isPlainObject(param)) {
    let result = {};
    for (let k in param) {
      result[k] = syncExpandCommandParam(param[k], vars);
    }
  } else {
    return param;
  }
}

function handlerPropertyProxy(handler) {
  return new Proxy(handler, {
    get (target, property) {
      if (
        target.hasOwnProperty(property) ||
        !isString(property) ||
        property=='call' ||
        property=='inspect'
      ) {
        return target[property];
      } else if (property.startsWith('$')) {
        // it's a function call
        // e.g., $.a.b.$toLowerCase()
        let opName = property.slice(1);
        return dollarOperatorHandler(target, opName);
      } else {
        var nextTarget = vars=>(target(vars) || {})[property];
        return handlerPropertyProxy(nextTarget);
      }
    }
  });
}
