import {setPath} from '../src/objpath';
import {expect} from 'chai';

describe('objpath', function () {
  context('setPath', function () {
    it('should set a value in a deep path', function () {
      var obj= {};
      setPath(obj, 'a.b.c', 1);
      expect(obj).to.deep.equal({a:{b:{c:1}}});
    });
    it('should set a value in a deep path without changing other keys', function () {
      var obj= {a:{b:{c:1}}};
      setPath(obj, 'a.b.d', 2);
      expect(obj).to.deep.equal({a:{b:{c:1, d:2}}});
    });
  });
});
