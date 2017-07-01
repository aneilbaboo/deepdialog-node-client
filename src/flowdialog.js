import {isObject, isString, isArray, isFunction} from 'util';
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

  async startFlow(session, path) {
    await this._getFlowHandler(path)(makeHandlerVars(session), session, path);
  }

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
      if (splitPath.length==2 && splitPath[0]==this.name) { // if it has 2 components...
        return path;
      } else if (splitPath.length==1 && path.length>0) {
        return `${this.name}:${path}`;
      }
    } else if (isArray(path) && path.length>0) {
      var reducedPath = path.reduce(appendFlowPathId,[]); // respects #id semantics
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

  /**
   * _compileFlows - Description
   *
   * @param {Object} flows Key is path id, value is a flow
   * @param {Array} path
   *
   * @return {Object} An object mapping to handler functions
   */
  _compileFlows(flows, path) {
    log.silly('_compileFlows(%j)', flows);
    flows = normalizeFlows(flows);
    path = path || [];
    var result = {};
    for (let id in flows) {
      var flow = flows[id];
      var flowPath = appendFlowPathId(path, id);
      var handler = this._compileFlow(flow, flowPath);
      result[id] = handler;
    }
    log.silly('_compileFlows(%j)=>', result);
    return result;
  }

  /**
   * _compileFlow - Adds the flow to the dialog, adding handlers as needed
   *
   * @param {Dialog} dialog Description
   * @param {type} flow   Description
   * @param {type} path   Description
   *
   * @return {Function} returns a handler
   */
  _compileFlow(flow, path) {
    log.silly('_compileFlow(%j,%j)', flow, path);
    flow = normalizeFlow(flow);
    var compiledCommands = [];

    for (let cmd of flow) {
      if (isFunction(cmd)) {
        compiledCommands.push(cmd);
      } else {
        compiledCommands.push(this._compileCommand(cmd, path));
      }
    }

    var handler = async (vars, session) => {
      for (let compiledCommand of compiledCommands) {
        await compiledCommand(vars, session, path);
        // session vars may have changed
        // update vars before calling the next command
        vars = {value:vars.value, ...makeHandlerVars(session)};
      }
    };

    return this._addFlowHandler(path, handler);
  }

  _compileCommand(cmd, path) {
    if (isMessageType(cmd.type)) {
      return this._compileMessageCommand(cmd, path);
    } else {
      switch (cmd.type) {
        case 'start': return this._compileStartCommand(cmd, path);
        case 'finish': return this._compileFinishCommand(cmd, path);
        case 'conditional': return this._compileConditionalCommand(cmd, path);
        case 'wait': return this._compileWaitCommand(cmd, path);
        case 'set': return this._compileSetCommand(cmd, path);
        case 'exec': return this._compileExecCommand(cmd, path);
        //case 'iteration': return this._compileIterationCommand(cmd);
        default: throw new Error(`Failed while compiling unrecognized command: ${cmd}`);
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
      var expandedVars = await this._expandCommandParam(cmd.set, vars, session, path);
      var processedVars = {};
      for (let v in expandedVars) {
        setPath(processedVars, v, expandedVars[v]);
      }
      await session.save(processedVars);
    };
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
  _compileMessageCommand(command, path) {
    log.silly('_compileMessageCommand(%j,%j)', command, path);

    var compiledParams = {
      ...command,
      actions: this._compileMessageActions(command.actions, path, 'reply'),
      items: this._compileMessageItems(command.items, path),
      flows: undefined
    };

    return async (vars, session) => {
      var expandedParams = await this._expandCommandParam(
        compiledParams, vars, session, path
      );

      log.silly('_compileMessageCommand(',command,',',path,') final expansion =>', expandedParams);
      await session.send(expandedParams);
    };
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
  _compileMessageItems(items, path) {
    log.silly('_compileMessageItems(%j, %j)', items, path);
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
          appendFlowPathId(path, item.id))
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
  _compileMessageActions(actions, path, defaultType) {
    log.silly('_compileMessageActions(%j, %j)', actions, path);
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
        action, path, defaultType
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
  _compileMessageAction(action, path, defaultType) {
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
        thenHandler = this._compileFlow(action.then, actionPath);
        delete actionCopy.then;
        actionCopy.thenFlow = actionPath;
      } else if (action.thenFlow) {
        thenHandler = this._getFlowHandler(action.thenHandler);
      }

      // depending on the action type,
      // add an onPostback or onPayload handler:
      switch (actionCopy.type) {
        case 'postback':
          log.silly('_compileMessageActions adding postbackHandler at %j', actionFlowKey);
          this.onPostback(actionFlowKey, thenHandler);
          break;
        case 'reply':
          log.silly('_compileMessageActions adding payloadHandler at %j', actionFlowKey);
          this.onPayload(actionFlowKey, thenHandler);
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

  _compileConditionalCommand(cmd, path) {
    var {id, if:test, then:thenFlow, else:elseFlow} = cmd;
    id = id || 'if';
    if (!thenFlow && !elseFlow) {
      throw new Error(`Invalid if command %j must contain then or else flow`, cmd);
    }
    var thenPath = appendFlowPathId(path, `${id}_then`);
    var elsePath = appendFlowPathId(path, `${id}_else`);
    var thenHandler = this._compileFlow(thenFlow, thenPath);
    var elseHandler = elseFlow ? this._compileFlow(elseFlow, elsePath) : null;
    return async (vars, session) => {
      var testResult = await this._expandCommandParam(test, vars, session, path);
      if (testResult) {
        await thenHandler(vars, session, thenPath);
      } else if (elseHandler) {
        await elseHandler(vars, session, elsePath);
      }
    };
  }

  _compileFinishCommand(cmd, path) {
    return async (vars, session) => {
      var result = await this._expandCommandParam(cmd.finish, vars, session, path);
      await session.finish(result);
    };
  }

  _compileStartCommand(cmd, path) {
    var {start, then} = cmd;
    var dialogName, args;
    var startParamFn;
    var thenPath = appendFlowPathId(path, cmd.id);

    if (isFunction(start)) {
      dialogName = anyPattern;
      startParamFn = start;
    } else {
      [dialogName, args] = normalizeStartParam(start);
      startParamFn = ()=>[dialogName, args];
    }

    if (then) {
      var thenHandler = this._compileFlow(then, thenPath);
      var tag = this.flowKey(thenPath);

      this.onResult(dialogName, tag, async (session, value) => {
        await thenHandler(makeHandlerVars(session, value), session, path);
      });
    }

    return async (vars, session) => {
      var [dialogName, args] = normalizeStartParam(await startParamFn(vars, session, thenPath));
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
            action.text
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
    } else if (isObject(param)) {
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

  // _makeTemplateResolver() {
  //   var handlers = this._resolvers;
  //   return function(varName) {
  //     let resolverMatch = _fnRegex.exec(varName);
  //     if (resolverMatch) {
  //       let [handlerName, argsList] = handlerMatch.slice(1,2);
  //       let args = argsList.split(',').map(s=>s.trim()).filter(s=>s=='');
  //       let handler = handlers[handlerName];
  //       if (handler) {
  //         return handler(...args);
  //       }
  //     } else {
  //       throw "Use default resolver";
  //     }
  //   };
  // }
}

// const _fnRegex = /(\w+)\([\w,]*\)/;


//
//
// NORMALIZATION
//
//

export function normalizeFlows(flows) {
  log.silly('normalizeFlows(',flows,')');
  if (isObject(flows)) {
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
  } else if (isObject(command)) {
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
  var id = command.id || 'if';
  return {id, ...command};
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
  } else if (isObject(items)) {
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
  } else if (isObject(actions)) {
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
    isObject(obj) && isCommandType(obj.type || inferCommandType(obj))
  );
}

export function isExecCommand(obj) {
  return isObject(obj) && (isString(obj.exec) || isArray(obj.exec));
}

export function isAction(obj) {
  return !!(isObject(obj) && isActionType(obj.type || inferActionType(obj,'reply')));
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
  } else if (command.finish) {
    return 'finish';
  } else if (command.start) {
    return 'start';
  } else if (command.wait) {
    return 'wait';
  } else if (command.set) {
    return 'set';
  } else if (command.hasOwnProperty('if')) {
    return 'conditional';
  } else if (command.exec) {
    return 'exec';
  }
}

export function makeHandlerVars(session, value) {
  return {...session.globals, ...session.locals, value};
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

export function appendFlowPathId(path, id) {
  if (!isValidFlowId(id))  {
    throw new Error(`Invalid flow id (${id}). Ids must start with a `+
      `word character or # and must not contain periods or colons.`);
  }
  return (id.startsWith('#')) ? [id] : [...path, id];
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
 *
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
