import {isString} from 'util';

export function pathToArray(path) { return isString(path) ? path.split('.') : path; }
export function setPath(obj, path, value) {
  path = pathToArray(path);
  var [head, ...tail] = path;
  if (tail.length==0) {
    obj[head] = value;
  } else {
    var nextObj = obj[head];
    if (!nextObj) {
      nextObj = obj[head] = {};
    }
    setPath(nextObj, tail, value);
  }
}
