'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.isLocalName = isLocalName;
function isLocalName(name) {
  switch (name.split(':')) {
    case 1:
      return true;
    case 2:
      return false;
    default:
      throw new Error('Invalid name: ' + name);
  }
}