import {isFunction, isArray, isNull, isNumber, isString, isUndefined} from 'util';
import {isPlainObject} from 'lodash';

// Variable access sugar: $.myVar instead of ({myVar})=>myVar
// E.g.,
// { if: $.myVar, then: [ ... ] }
// instead of
// { if: ({myVar})=>myVar, then: [ ... ] }
//
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
  if (opName.length==0) {
    return function(fn, ...args) {
      if (!isFunction(fn)) {
        throw new Error(`Expecting a function argument to dollar-accessor, but received .$(${fn})`);
      }
      return handlerPropertyProxy(function (vars) {
        var value = target(vars);
        return fn(value, ...args);
      });
    };
  } else {
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
      if (property=='call') {
        return target[property];
      } else if (property=='toJSON') {
        return target.toString;
      } else if (property.startsWith('$')) {
        let opName = property.slice(1);
        // it's a function call
        // e.g., $.a.b.$toLowerCase()
        //     or $.a.b.$({x}=>x+1) // adds 1 to the value of a.b
        return dollarOperatorHandler(target, opName);

      } else {
        var nextTarget = vars=>{
          var resolvedValue = target(vars) || {};
          return resolvedValue[property];
        };
        return handlerPropertyProxy(nextTarget);
      }
    }
  });
}
