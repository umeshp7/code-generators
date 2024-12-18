var expect = require('chai').expect,
  sdk = require('postman-collection'),
  sanitize = require('../../lib/util/sanitize').sanitize,
  convert = require('../../lib/index').convert,
  getOptions = require('../../lib/index').getOptions,
  mainCollection = require('../unit/fixtures/sample_collection.json');

describe('Shell-Apache-Bench converter', function () {


  describe('convert function', function () {
    var request = new sdk.Request(mainCollection.item[0].request),
      snippetArray,
      options = {
        indentType: 'Tab',
        indentCount: 2
      };

    const SINGLE_SPACE = ' ',
      SINGLE_TAB = '\t';

    it('should return snippet with requestTimeout given option', function () {
      convert(request, { requestTimeout: 10000 }, function (error, snippet) {
        if (error) {
          expect.fail(null, null, error);
          return;
        }
        expect(snippet).to.include('-s 10');
      });
    });

    it('should generate snippet with default options given no options', function () {
      convert(request, function (error, snippet) {
        if (error) {
          expect.fail(null, null, error);
          return;
        }
        snippetArray = snippet.split('\n');
        for (var i = 0; i < snippetArray.length; i++) {
          if (snippetArray[i].startsWith('ab')) {
            expect(snippetArray[i + 1].substr(0, 2)).to.equal(SINGLE_SPACE.repeat(2));
            expect(snippetArray[i + 1].charAt(3)).to.not.equal(SINGLE_SPACE);
          }
        }
      });
    });

    it('should generate snippet with Tab as an indent type with exact indent count', function () {
      convert(request, options, function (error, snippet) {
        if (error) {
          expect.fail(null, null, error);
          return;
        }
        snippetArray = snippet.split('\n');
        for (var i = 0; i < snippetArray.length; i++) {
          if (snippetArray[i].startsWith('ab')) {
            expect(snippetArray[i + 1].substr(0, 2)).to.equal(SINGLE_TAB.repeat(2));
            expect(snippetArray[i + 1].charAt(2)).to.not.equal(SINGLE_TAB);
          }
        }
      });
    });

    it('should trim header keys and not trim header values', function () {
      var request = new sdk.Request({
        'method': 'GET',
        'header': [
          {
            'key': '   key_containing_whitespaces  ',
            'value': '  value_containing_whitespaces  '
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
        // one extra space in matching the output because we add key:<space>value in the snippet
        expect(snippet).to.include('-H \'key_containing_whitespaces:   value_containing_whitespaces  \'');
      });
    });

    it('should generate snippet for formdata body mode', function () {
      var request = new sdk.Request({
        'method': 'POST',
        'header': [],
        'body': {
          'mode': 'formdata',
          'formdata': [
            {
              'key': 'text key',
              'type': 'text',
              'value': 'text value'

            },
            {
              'key': 'file key',
              'type': 'file',
              'src': '/path'
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
        expect(snippet).to.include('# apache bench converter doesn\'t support file upload via form data');
        expect(snippet).to.not.include('file key');
        expect(snippet).to.include('text key=text value');
      });
    });

    it('should generate valid snippet for single/double quotes in url', function () {
      var request = new sdk.Request({
        'method': 'GET',
        'header': [],
        'url': {
          'raw': 'https://postman-echo.com/get?query1=b\'b&query2=c"c',
          'protocol': 'https',
          'host': [
            'postman-echo',
            'com'
          ],
          'path': [
            'get'
          ],
          'query': [
            {
              'key': 'query1',
              'value': "b'b" // eslint-disable-line quotes
            },
            {
              'key': 'query2',
              'value': 'c"c'
            }
          ]
        }
      });
      convert(request, {}, function (error, snippet) {
        if (error) {
          expect.fail(null, null, error);
        }
        expect(snippet).to.be.a('string');
        // To escape a single quotes inside a single quoted string, '\'(all 3 characters)
        // needs to be added before '(single quote)
        // eslint-disable-next-line quotes
        expect(snippet).to.include("'https://postman-echo.com/get?query1=b'\\''b&query2=c\"c'");
      });
    });
  });

  describe('getOptions function', function () {
    it('should return array of options for shell-apache-bench converter', function () {
      expect(getOptions()).to.be.an('array');
    });

    it('should return all the valid options', function () {
      expect(getOptions()[0]).to.have.property('id', 'indentCount');
      expect(getOptions()[1]).to.have.property('id', 'indentType');
      expect(getOptions()[2]).to.have.property('id', 'requestTimeout');
      expect(getOptions()[3]).to.have.property('id', 'trimRequestBody');
    });
  });

  describe('sanitize function', function () {
    it('should handle invalid parameters', function () {
      expect(sanitize(123, 'raw', false)).to.equal('');
      expect(sanitize('inputString', 123, false)).to.equal('inputString');
      expect(sanitize(' inputString', 'test', true)).to.equal('inputString');
    });
  });
});
