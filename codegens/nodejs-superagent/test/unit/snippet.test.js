var expect = require('chai').expect,
  sdk = require('postman-collection'),
  sanitize = require('../../lib/util').sanitize,
  parseBody = require('../../lib/parseRequest').parseBody,
  getOptions = require('../../lib/index').getOptions,
  convert = require('../../lib/index').convert,
  mainCollection = require('./fixtures/testcollection/collection.json');

describe('nodejs-superagent convert function', function () {
  describe('Convert function', function () {
    var request,
      reqObject,
      options = {},
      snippetArray,
      line_no;

    it('should return a Tab indented snippet ', function () {
      request = new sdk.Request(mainCollection.item[0].request);
      options = {
        indentType: 'Tab',
        indentCount: 1
      };
      convert(request, options, function (error, snippet) {
        if (error) {
          expect.fail(null, null, error);
          return;
        }

        expect(snippet).to.be.a('string');
        snippetArray = snippet.split('\n');
        for (var i = 0; i < snippetArray.length; i++) {
          if (snippetArray[i] === 'superagent') { line_no = i + 1; }
        }
        expect(snippetArray[line_no].charAt(0)).to.equal('\t');
      });
    });

    it('should return snippet with timeout property when timeout is set to non zero', function () {
      request = new sdk.Request(mainCollection.item[0].request);
      options = {
        requestTimeout: 1000
      };
      convert(request, options, function (error, snippet) {
        if (error) {
          expect.fail(null, null, error);
          return;
        }

        expect(snippet).to.be.a('string');
        expect(snippet).to.include('.timeout(1000)');
      });
    });

    it('should return snippet with ES6 features when ES6_enabled is set to true', function () {
      request = new sdk.Request(mainCollection.item[0].request);
      options = {
        ES6_enabled: true
      };
      convert(request, options, function (error, snippet) {
        if (error) {
          expect.fail(null, null, error);
          return;
        }

        expect(snippet).to.be.a('string');
        snippetArray = snippet.split('\n');
        expect(snippetArray[0]).to.equal('const superagent = require(\'superagent\');');
        expect(snippet).to.include('.end((error, response) => {');
      });
    });

    it('should return snippet with followRedirect property set to ' +
        'false for no follow redirect', function () {
      request = new sdk.Request(mainCollection.item[0].request);
      options = {
        followRedirect: false
      };
      convert(request, options, function (error, snippet) {
        if (error) {
          expect.fail(null, null, error);
          return;
        }

        expect(snippet).to.be.a('string');
        expect(snippet).to.include('.redirects(0)');
      });
    });

    it('should return valid code snippet for no headers and no body', function () {
      reqObject = {
        'description': 'This is a sample POST request without headers and body',
        'url': 'https://echo.getpostman.com/post',
        'method': 'POST'
      };
      request = new sdk.Request(reqObject);
      convert(request, options, function (error, snippet) {
        if (error) {
          expect.fail(null, null, error);
          return;
        }
        expect(snippet).to.be.a('string');
        expect(snippet).to.not.include('.set(');
      });
    });

    it('should not fail for a random body mode', function () {
      request = new sdk.Request(mainCollection.item[2].request);
      request.body.mode = 'random';
      request.body[request.body.mode] = {};

      convert(request, options, function (error, snippet) {

        if (error) {
          expect.fail(null, null, error);
          return;
        }
        expect(snippet).to.be.a('string');
      });
    });

    it('should generate snippet for file body mode', function () {
      request = new sdk.Request({
        'url': 'https://echo.getpostman.com/post',
        'method': 'POST',
        'body': {
          'mode': 'file',
          'file': [
            {
              'key': 'fileName',
              'src': 'file',
              'type': 'file'
            }
          ]
        }
      });
      options = { indentType: 'Space', indentCount: 2 };
      convert(request, options, function (error, snippet) {
        if (error) {
          expect.fail(null, null, error);
        }
        expect(snippet).to.be.a('string');
        expect(snippet).to.not.equal('');
      });
    });

    it('should not require unused fs', function () {
      request = new sdk.Request({
        'url': 'https://postman-echo.com/get',
        'method': 'GET',
        'body': {
          'mode': 'raw',
          'raw': ''
        }
      });
      convert(request, {}, (error, snippet) => {
        if (error) {
          expect.fail(null, null, error);
        }
        expect(snippet).to.be.a('string');
        expect(snippet).to.not.include('var fs = require(\'fs\');');
      });
    });

    it('should add fs for form-data file upload', function () {
      request = new sdk.Request({
        'url': 'https://postman-echo.com/post',
        'method': 'POST',
        'body': {
          'mode': 'formdata',
          'formdata': [
            {
              'key': 'fileName',
              'src': '/some/path/file.txt',
              'type': 'file'
            }
          ]
        }
      });
      convert(request, {}, (error, snippet) => {
        if (error) {
          expect.fail(null, null, error);
        }
        expect(snippet).to.be.a('string');
        expect(snippet).to.include('var fs = require(\'fs\');');
      });
    });

    it('should trim header keys and not trim header values', function () {
      var request = new sdk.Request({
        'method': 'GET',
        'header': [
          {
            'key': '   key_containing_whitespace  ',
            'value': '  value_containing_whitespace  '
          }
        ],
        'url': {
          'raw': 'https://google.com',
          'protocol': 'https',
          'host': [
            'google',
            'com'
          ]
        }
      });
      convert(request, {}, function (error, snippet) {
        if (error) {
          expect.fail(null, null, error);
        }
        expect(snippet).to.be.a('string');
        expect(snippet).to.include('\'key_containing_whitespace\': \'  value_containing_whitespace  \'');
      });
    });

    it('should include JSON.stringify in the snippet for raw json bodies', function () {
      var request = new sdk.Request({
        'method': 'POST',
        'header': [
          {
            'key': 'Content-Type',
            'value': 'application/json'
          }
        ],
        'body': {
          'mode': 'raw',
          'raw': '{\n  "json": "Test-Test"\n}'
        },
        'url': {
          'raw': 'https://postman-echo.com/post',
          'protocol': 'https',
          'host': [
            'postman-echo',
            'com'
          ],
          'path': [
            'post'
          ]
        }
      });
      convert(request, {}, function (error, snippet) {
        if (error) {
          expect.fail(null, null, error);
        }
        expect(snippet).to.be.a('string');
        expect(snippet).to.include('JSON.stringify({"json":"Test-Test"})');
      });
    });

    it('should generate snippets for no files in form data', function () {
      var request = new sdk.Request({
        'method': 'POST',
        'header': [],
        'body': {
          'mode': 'formdata',
          'formdata': [
            {
              'key': 'no file',
              'value': '',
              'type': 'file',
              'src': []
            },
            {
              'key': 'no src',
              'value': '',
              'type': 'file'
            },
            {
              'key': 'invalid src',
              'value': '',
              'type': 'file',
              'src': {}
            }
          ]
        },
        'url': {
          'raw': 'https://postman-echo.com/post',
          'protocol': 'https',
          'host': [
            'postman-echo',
            'com'
          ],
          'path': [
            'post'
          ]
        }
      });
      convert(request, {}, function (error, snippet) {
        if (error) {
          expect.fail(null, null, error);
        }
        expect(snippet).to.be.a('string');
        expect(snippet).to.include('\'no file\',');
        expect(snippet).to.include('\'no src\',');
        expect(snippet).to.include('\'invalid src\',');
        expect(snippet).to.include(', \'/path/to/file\')');
      });
    });

    describe('getOptions function', function () {

      it('should return an array of specific options', function () {
        expect(getOptions()).to.be.an('array');
      });

      it('should return all the valid options', function () {
        expect(getOptions()[0]).to.have.property('id', 'indentCount');
        expect(getOptions()[1]).to.have.property('id', 'indentType');
        expect(getOptions()[2]).to.have.property('id', 'requestTimeout');
        expect(getOptions()[3]).to.have.property('id', 'followRedirect');
        expect(getOptions()[4]).to.have.property('id', 'trimRequestBody');
      });
    });

    describe('Sanitize function', function () {

      it('should return empty string when input is not a string type', function () {
        expect(sanitize(123, false)).to.equal('');
        expect(sanitize(null, false)).to.equal('');
        expect(sanitize({}, false)).to.equal('');
        expect(sanitize([], false)).to.equal('');
      });

      it('should trim input string when needed', function () {
        expect(sanitize('inputString     ', true)).to.equal('inputString');
      });
    });

    describe('parseRequest function', function () {

      it('should return empty string for empty body', function () {
        expect(parseBody(null, ' ', false)).to.equal('');
      });
    });
  });
});
