'use strict';
import winston from 'winston';
import {isArray, isNumber} from 'util';

winston.level = 'info';
winston.remove(winston.transports.Console);
winston.add(winston.transports.Console, {
  colorize: true,
  prettyPrint: true,
  label: "deepdialog"
});

winston.levelValue = function levelValue(level) {
  return isNumber(level) ? level : this.levels[level.toLowerCase()];
};

winston.shouldLog = function shouldLog(level) {
  return this.levelValue(this.level) >= this.levelValue(level);
};

winston.logif = function logif(level, fn) {
  if (this.shouldLog(level)) {
    var args = fn();
    args = (isArray(args)) ? args : [args];
    this.log(level, ...args);
  }
};

for (let level in winston.levels) {
  winston['if'+level] = function (fn) {
    this.logif(level, fn);
  };
}

import {isFunction, isObject} from 'util';

/**
 * stringify - logger-friendly stringification
 *    handles circular objects and functions
 *
 * @param  {type} obj description
 * @return {type}     description
 */
export function stringify(obj) {
  var cache = [];
  var result = JSON.stringify(obj, function(key, value) {
    if (isFunction(obj)) {
      return obj.toString();
    } else if (isObject(obj)) {
      if (cache.indexOf(value) !== -1) {
        // Circular reference found, discard key
        return;
      }
      // Store value in our collection
      cache.push(value);
    }
    return value;
  });
  cache = null; // Enable garbage collection
  return result;
}

winston.stringify = stringify;

module.exports = winston;
