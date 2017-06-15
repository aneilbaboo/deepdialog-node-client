import {isObject, isString, isArray, isFunction} from 'util';
import Dialog from './dialog';
import {sleep} from './util';
import log from './log';

//
// Definitions
//
// flows = { key: flow, *}
// flow = flowCommand | [flowCommand*]
// flowCommand = string | handler | flowObject
// flowObject = waitCommand | messageCommand | ifCommand | startCommand
// waitCommand = { type: 'wait', seconds: float }
// ifCommand = { type: 'if', test: handler, then: flow, else: flow | null }
// startCommand = { type: 'start', start: startParam, then: flow, thenId: flowId }
// startParam = string | {dialog:string, args:Object} | ([session[, path[, result]]]) => {dialog, params}
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
//  then: flow, // if flow is a handler, handler may return a flowId
//  thenId: Array | string // representing a relative or absolute flow path
// }
// item = {
//   title: string,
//   description: string,
//   mediaUrl: string,
//   mediaType: string,
//   actions: [action*] | {id:action*}
// }
// flowCommandType = text|image|list|carousel
// handler = ([session [, path [, arg]]]) => { }
//
export default class FlowDialog extends Dialog {
  constructor({flows, ...dialogArgs}) {
    super(dialogArgs);
    this._flowHandlers = {};
    var compiledFlows = this._compileFlows(flows);
    if (compiledFlows.start) {
      this.onStart(compiledFlows.start);
    }
  }

  async startFlow(session, path) {
    await this._getFlowHandler(path)(session, path);
  }

  /**
   * flowId - Description
   *
   * @param {Array} path where elements are strings or unary arrays containing a string
   *                    E.g., ['shop','shoes','buy'] might represent the user
   *                    choosing an action button with id=shop, then pressing a
   *                    button with id=buy associated with the carousel item with
   *                    id=shoes.
   *
   * @return {string} returns a string of the form 'DialogName:x.y.z'
   */
  flowId(path) {
    if (isString(path)) {
      return path;
    } else {
      return `${this.name}:${path.join(".")}`;
    }
  }

  _getFlowHandler(path) {
    var pathName = this.flowId(path);
    var result = this._flowHandlers[pathName];
    if (!result) {
      throw new Error(`Attempt to access undefined flowHandler at path ${path.join('.')}`);
    }
    return result;
  }

  _addFlowHandler(path, handler) {
    var fid = this.flowId(path);
    if (this._flowHandlers[fid]) {
      throw new Error(`Attempt to create handler with duplicate id: ${path.join('.')}`);
    } else {
      this._flowHandlers[fid] = handler;
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
    log.silly('_compileFlows(',flows,')');
    flows = normalizeFlows(flows);
    path = path || [];
    var result = {};
    for (let id in flows) {
      var flow = flows[id];
      var flowPath = [...path, id];
      var handler = this._compileFlow(flow, flowPath);
      result[id] = handler;
    }
    log.silly('_compileFlows(',flows,')=>',  result);
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
    log.silly('_compileFlow(',flow,')');
    flow = normalizeFlow(flow);
    var compiledCommands = [];

    for (let cmd of flow) {
      if (isFunction(cmd)) {
        compiledCommands.push(cmd);
      } else if (isMessageType(cmd.type)) {
        compiledCommands.push(this._compileMessageCommand(cmd, path));
      } else if (cmd.type=='wait') {
        compiledCommands.push(async function () { await sleep(cmd.seconds*1000); });
      }
    }
    var handler = async (session, path, args) => {
      for (let compiledCommand of compiledCommands) {
        console.log('executing command:', compiledCommand);
        await compiledCommand(session, path, args);
      }
    };
    return this._addFlowHandler(path, handler);
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
    log.silly('_compileMessageCommand(',command,',',path,')');

    if (command.actions) {
      var compiledActions = this._compileMessageActions(command.actions, path);
    }
    if (command.flows) {
      this.addFlows(command.flows, path);
    }
    if (command.items) {
      var compiledItems = this._compileMessageItems(command.items, path);
    }

    var compiledParams = deleteUndefinedKeys({
      ...command,
      compiledActions,
      compiledItems,
      flows:undefined});

    log.silly('_compileMessageCommand(',command,',',path,')=>', compiledParams);

    return async function(session) {
      var expandedParams = {
        ...compiledParams,
        actions: await this._expandActions(compiledActions, session, path),
        items: await this._expandItems(compiledItems, session, path)
      };
      return expandedParams;
    };
  }

  async _expandActions(compiledActions, session, path) {
    var expandedActions = await compiledActions(session, path);

  }

  async _expandItems(compiledItems, session, path) {

  }

  /**
   * _compileMessageItems - converts a flow message item into Session.send version,
   *                  adding handlers to the dialog as needed
   *
   * @param {type} items Description
   * @param {type} path  Description
   *
   * @return {Function} (session, path) => ...
   */
  _compileMessageItems(items, path) {
    log.silly('_compileMessageItems(%j, %j)', items, path);
    var sendParamItems = [];
    for (let item of items) {
      let itemActions;
      if (item.actions) {
        itemActions = this._compileMessageActions(item.actions, [...path, item.id]);
        sendParamItems.push({...item, actions: itemActions});
      } else {
        sendParamItems.push(item);
      }
    }
    log.silly('_compileMessageItems(%j, %j)=>', items, path, sendParamItems);
    return async function (session, path) {
      var expandedItemsParam = [];
      for (let i in sendParamItems) {
        expandedItemsParam.push(isFunction(i) ? await i(session,path) : i);
      }
      return expandedItemsParam;
    };
  }

  /**
   * _compileMessageActions - Description
   *
   * @param {type} actions Description
   * @param {type} path    Description
   *
   * @return {type} Description
   */
  _compileMessageActions(actions, path) {
    log.silly('_compileMessageActions(%j, %j)', actions, path);
    actions = normalizeActions(actions, path);
    var sendParamActions = [];
    for (var action of actions) {
      action = {...action};
      let actionPath = [...path, action.id];
      let thenHandler;
      let actionFlowId = this.flowId(actionPath);

      // create or retrieve the thenHandler:
      if (action.then) {
        thenHandler = this._compileFlow(action.then, actionPath);
      } else if (action.thenId) {
        thenHandler = this._getFlowHandler(action.thenHandler);
      }

      // depending on the action type,
      // add an onPostback or onPayload handler:
      switch (action.type) {
        case 'postback':
          this.onPostback(actionFlowId, thenHandler);
          break;
        case 'reply':
          this.onPayload(actionFlowId, thenHandler);
          break;
        default:
          throw new Error(`Invalid action: exec and then may only be used with `+
            `postback and reply type actions, but received: ${JSON.stringify(action)}`);
      }

      // convert flow dialog params to DD api sendMessage params:
      var params = {...action};
      delete params.then;
      delete params.thenId;
      sendParamActions.push(params);
    }
    log.silly('_compileMessageActions(',actions,',',path,')=>', sendParamActions);
    return sendParamActions;
  }

  async _compileStartCommand(startParams, path) {
    var {dialog, args, then} = startParams;
    var dialogFn;
    if (isFunction(dialog)) {
      dialogFn = dialog;
    } else if (isString(dialog)) {
      dialogFn = ()=>[dialog, args];
    } else if (isArray(dialog)) {
      dialogFn = ()=>dialog;
    } else {
      throw new Error(`Invalid params to thenStart: ${startParams}.` +
        `Expecting function, string or array`);
    }

    this._addFlowHandler(path, dialogFn);

    if (then) {
      this._compileFlow([...path, 'then'], then);
    }
    return dialogFn;
  }

  async _expandObjectParam(session, path, param) {
    var expandedParam = {};
    for (var key in param) {
      var val = param[key];
      expandedParam[key] = await this._expandParam(session, [...path, key], val);
    }
    return expandedParam;
  }

  async _expandParam(session, path, param) {
    if (isFunction(param)) {
      return await param(session);
    } else if (isArray(param)) {
      return await this._expandArrayParam(session, path, param);
    } else if (isObject(param)) {
      return await this._expandObjectParam(session, path, param);
    } else {
      return param;
    }
  }
}



//
//
// NORMALIZATION
//
//

export function normalizeFlow(flow) {
  if (isFunction(flow)) {
    return [flow];
  } else if (isString(flow)) {
    log.silly('normalizeFlow(string: %j)', flow);
    return [{type:'text', text:flow}];
  } else if (isArray(flow)) {
    log.silly('normalizeFlow(array: ',flow,')');
    return flow.map(normalizeFlowCommand);
  } else if (isObject(flow)) {
    log.silly('normalizeFlow(object: %j)', flow);
    return [normalizeFlowCommand(flow)];
  } else {
    throw new Error(`Invalid flow. Expecting string, Object or Array, but received: ${JSON.stringify(flow)}`);
  }
}

export function normalizeFlowCommand(command) {
  log.silly('normalizeFlowCommand(',command,')');
  if (isFunction(command)) {
    return command;
  } else if (isString(command)) {
    return {type:'text', text:command};
  } else {
    var type = command.type || inferCommandType(command);
    if (!isCommandType(type)) {
      throw new Error(`Command type must be text, image, list or carousel.  Cannot infer from ${JSON.stringify(command)}`);
    }
    var actions = command.actions ? normalizeActions(command.actions, 'reply') : undefined;
    var items = command.items ? normalizeItems(items) : undefined;
    var flows = command.flows ? normalizeFlows(flows) : undefined;
    return deleteUndefinedKeys({type, ...command, actions, items, flows});
  }
}

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

/**
 * normalizeActions - adds
 *
 * @param {Array} actions Description
 *
 * @return {Array} An object conforming to the action specification of the Session.send api
 */
export function normalizeActions(actions, defaultType) {
  log.silly('normalizeActions(',actions,',',defaultType,')');
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
  } else {
    throw new Error(`Expecting an Array or Object describing actions, but received: ${JSON.stringify(actions)}`);
  }
}

export function normalizeAction(id, action, defaultType) {
  log.silly('normalizeAction(',id,',',action,',',defaultType,')');
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

export function normalizeItems(items) {
  log.silly('normalizeItems(%j)', items);
  if (isArray(items)) {
    return items;
  } else if (isObject(items)) {
    var normalizedItems = [];
    for (let k in items) {
      var item = items[k];
      normalizedItems.push({
        id: k,
        text: item.title || k,
        actions: item.actions ? normalizeActions(item.actions, 'postback') : undefined
      });
    }
  } else {
    throw new Error(`Expecting an Array or Object describing items, but received: ${JSON.stringify(items)}`);
  }
}

export function isFlow(obj) {
  return isArray(obj) || isFunction(obj) || isFlowCommand(obj);
}

export function isFlowCommand(obj) {
  return isString(obj) || isFunction(obj) || (
    isObject(obj) && isCommandType(obj.type || inferCommandType(obj))
  );
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
  return type=='wait' || isMessageType(type);
}

export function inferActionType(action, defaultType) {
  if (action.uri) {
    return 'link';
  } else if (action.amount) {
    return 'buy';
  } else if (action.then || action.thenId) {
    return defaultType;
  }
}

export function inferCommandType(command) {
  if (command.mediaUrl) {
    return 'image';
  } else if (command.text) {
    return 'text';
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
// actions: {
//   choice1: {
//       type:'reply',  // payload = FLOW::choice1
//       then: [
//         "Hey watcha doin {:givenName}?",
//         {
//           type: 'carousel',
//           items: {
//             actions: {
//               choice1: {
//                 exec: ...
//                 then: ...
//                 start: {
//                   dialog: "SomethingElse"
//
//                 }
//               }
//             },

//           }
//         }
//
//       }
//
//     }
//   }
// }
//
