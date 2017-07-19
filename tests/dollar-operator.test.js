import sinon from 'sinon';
import chai, {expect} from 'chai';
import chaiMatchPattern from 'chai-match-pattern';
chai.use(chaiMatchPattern);

import {$} from '../src/dollar-operator';


context('$ operator', function () {
  it('should return a handler which extracts the value of the property from the vars', function () {
    expect($.myVar).to.be.a.function;
    expect($.myVar({myVar:1})).to.equal(1);
    expect($.myVar({})).to.be.undefined;
  });

  it('should return a handler which extracts properties recursively', function () {
    expect($.a.b.c.d).to.be.a.function;
    var vars = {a:{b:{c:{d:123}}}};
    expect($.a.b.c.d(vars)).to.equal(123);
    expect($.a.b(vars)).to.deep.equal({c:{d:123}});
  });

  it('should return a handler which attempts to call a method if the property starts with $', function () {
    expect($.a.$toLowerCase()).to.be.a.function;
    expect($.a.$toLowerCase()({a:"HELLO"})).to.equal("hello");
    expect($.a.b.$toLowerCase()({a:{b:"HELLO"}})).to.equal("hello");
  });

  it("should return a handler which returns undefined if the deep proeprty doesn't exist", function () {
    expect($.a.b.c.d({a:1})).to.be.undefined;
  });

  it("should return a handler which returns undefined if a function doesn't exist", function () {
    expect($.a.$toLowerCase()({a:1})).to.be.undefined;
  });

  it('when given a function argument, should apply the function to accessors', function () {
    var testfn = (x)=>`hello ${x}`;
    expect($.a.b.$(testfn)({a:{b:"there"}})).to.equal("hello there");
  });

  it('when given a number argument, should treat the number as an index', function () {
    expect($.a.b.$(1)({a:{b:['hello','there','sailor']}})).to.equal("there");
  });

  context('when using prebuilt operators', function () {
    it('should correctly perform gt test', function () {
      expect($.a.b.$gt(3)({a:{b:1}})).to.be.false;
      expect($.a.b.$gt(3)({a:{b:3}})).to.be.false;
      expect($.a.b.$gt(3)({a:{b:4}})).to.be.ok;
    });

    it('should correctly perform lt test', function () {
      expect($.a.b.$lt(3)({a:{b:4}})).to.be.false;
      expect($.a.b.$lt(3)({a:{b:3}})).to.be.false;
      expect($.a.b.$lt(3)({a:{b:2}})).to.be.ok;
    });

    it('should correctly perform gte test', function () {
      expect($.a.b.$gte(3)({a:{b:1}})).to.be.false;
      expect($.a.b.$gte(3)({a:{b:3}})).to.be.ok;
      expect($.a.b.$gt(3)({a:{b:4}})).to.be.ok;
    });

    it('should correctly perform lte test', function () {
      expect($.a.b.$lte(3)({a:{b:4}})).to.be.false;
      expect($.a.b.$lte(3)({a:{b:3}})).to.be.ok;
      expect($.a.b.$lte(3)({a:{b:2}})).to.be.ok;
    });

    it('should correctly perform equals test', function () {
      expect($.a.b.$equals(3)({a:{b:4}})).to.be.false;
      expect($.a.b.$equals(3)({a:{b:3}})).to.be.ok;
    });

    it('should correctly perform equals test with a reference', function () {
      expect($.a.b.$equals($.c)({a:{b:4}, c:3})).to.be.false;
      expect($.a.b.$equals($.c)({a:{b:3}, c:3})).to.be.ok;
    });

    it('should correctly perform isTruthy test', function () {
      expect($.a.b.$isTruthy()({a:{b:false}})).to.be.false;
      expect($.a.b.$isTruthy()({a:{b:null}})).to.be.false;
      expect($.a.b.$isTruthy()({a:null})).to.not.be.ok;
      expect($.a.b.$isTruthy()({a:undefined})).to.not.be.ok;
      expect($.a.b.$isTruthy()({a:{b:1}})).to.be.ok;
      expect($.a.b.$isTruthy()({a:{b:true}})).to.be.ok;
    });

    it('should correctly perform isFalsey test', function () {
      expect($.a.b.$isFalsey()({a:{b:false}})).to.be.ok;
      expect($.a.b.$isFalsey()({a:{b:null}})).to.be.ok;
      expect($.a.b.$isFalsey()({a:null})).to.be.ok;
      expect($.a.b.$isFalsey()({a:undefined})).to.be.ok;
      expect($.a.b.$isFalsey()({a:{b:1}})).to.be.false;
      expect($.a.b.$isFalsey()({a:{b:true}})).to.be.false;
    });

    it('should correctly perform isArray test', function () {
      expect($.a.b.$isArray()({a:{b:[1,2,3]}})).to.be.ok;
      expect($.a.b.$isArray()({a:{b:1}})).to.not.be.ok;
    });

    it('should correctly perform isPlainObject test', function () {
      expect($.a.b.$isPlainObject()({a:{b:[1,2,3]}})).to.not.be.ok;
      expect($.a.b.$isPlainObject()({a:{b:{c:1}}})).to.be.ok;
    });

    it('should correctly perform isString test', function () {
      expect($.a.b.$isString()({a:{b:[1,2,3]}})).to.not.be.ok;
      expect($.a.b.$isString()({a:{b:"abc"}})).to.be.ok;
    });

    it('should correctly perform isNull test', function () {
      expect($.a.b.$isNull()({a:{b:false}})).to.not.be.ok;
      expect($.a.b.$isNull()({a:{b:null}})).to.be.ok;
    });

    it('should correctly perform isUndefined test', function () {
      expect($.a.b.$isUndefined()({a:{b:null}})).to.not.be.ok;
      expect($.a.b.$isUndefined()({a:{b:undefined}})).to.be.ok;
    });

    it('should correctly perform isNumber test', function () {
      expect($.a.b.$isNumber()({a:{b:1}})).to.be.ok;
      expect($.a.b.$isNumber()({a:{b:"hello"}})).to.not.be.ok;
    });

    it('should correctly perform add', function () {
      expect($.a.b.$add(5)({a:{b:2}})).to.equal(7);
    });

    it('should correctly perform sub', function () {
      expect($.a.b.$sub(2)({a:{b:5}})).to.equal(3);
    });

    it('should correctly perform mul', function () {
      expect($.a.b.$mul(3)({a:{b:4}})).to.equal(12);
    });

    it('should correctly perform div', function () {
      expect($.a.b.$div(3)({a:{b:12}})).to.equal(4);
    });

    it('should correctly perform pow', function () {
      expect($.a.b.$pow(3)({a:{b:2}})).to.equal(8);
    });

    it('should not raise an error when logged or stringified', function () {
      expect(()=>console.log("Raw console.log($.a):", $.a)).to.not.throw(); // eslint-disable-line
      expect(()=>JSON.stringify($.a)).to.not.throw();
    });

    it('should not evaluate the expression when stringified', function () {
      var stub = sinon.stub();
      JSON.stringify($.a.$(stub));
      expect(stub.notCalled).to.be.ok;
    });

    it('should not evaluate the expression when logged', function () {
      var stub = sinon.stub();
      console.log("console.log(%%j, $.a): %j", $.a.$(stub)); // eslint-disable-line
      expect(stub.notCalled).to.be.ok;
    });
  });
});
