var expect = require('chai').expect,
  sdk = require('postman-collection'),
  convert = require('../../index').convert,
  sanitize = require('../../lib/util').sanitize,
  getUrlStringfromUrlObject = require('../../lib/util').getUrlStringfromUrlObject,
  getOptions = require('../../index').getOptions,
  mainCollection = require('./fixtures/testcollection/collection.json');


describe('QCObjects Converter', function () {

  describe('convert function', function () {
    var request = new sdk.Request(mainCollection.item[0].request),
      snippetArray;

    const SINGLE_SPACE = ' '; // default indent type with indent count of 2
    it('should generate snippet with default options given no options', function () {
      convert(request, function (error, snippet) {
        if (error) {
          expect.fail(null, null, error);
          return;
        }
        snippetArray = snippet.split('\n');
        for (var i = 0; i < snippetArray.length; i++) {
          if (snippetArray[i].startsWith('let task = URLSession.shared.dataTask')) {
            expect(snippetArray[i + 1].charAt(0)).to.equal(SINGLE_SPACE);
            expect(snippetArray[i + 1].charAt(1)).to.equal(SINGLE_SPACE);
          }
        }
      });
    });

    it('should generate snippet with Space as an indent type with default indent count', function () {
      convert(request, { indentType: 'Space' }, function (error, snippet) {
        if (error) {
          expect.fail(null, null, error);
          return;
        }
        snippetArray = snippet.split('\n');
        for (var i = 0; i < snippetArray.length; i++) {
          if (snippetArray[i].startsWith('let task = URLSession.shared.dataTask')) {
            expect(snippetArray[i + 1].charAt(0)).to.equal(SINGLE_SPACE);
            expect(snippetArray[i + 1].charAt(1)).to.equal(SINGLE_SPACE);
          }
        }
      });
    });


    it('should not encode queryParam unresolved variables and ' +
    'leave it inside double parenthesis {{xyz}}', function () {
      request = new sdk.Request({
        'method': 'POST',
        'header': [],
        'url': {
          'raw': 'http://postman-echo.com/post?a={{xyz}}',
          'protocol': 'http',
          'host': [
            'postman-echo',
            'com'
          ],
          'path': [
            'post'
          ],
          'query': [
            {
              'key': 'a',
              'value': '{{xyz}}'
            }
          ]
        }
      });
      convert(request, {}, function (error, snippet) {
        if (error) {
          expect.fail(null, null, error);
        }
        expect(snippet).to.be.a('string');
        expect(snippet).to.include('http://postman-echo.com/post?a={{xyz}}');
        expect(snippet).to.not.include('http://postman-echo.com/post?a=%7B%7Bxyz%7D%7D');
      });
    });

    it('should encode queryParams other than unresolved variables', function () {
      request = new sdk.Request({
        'method': 'POST',
        'header': [],
        'url': {
          'raw': 'http://postman-echo.com/post?a=b c',
          'protocol': 'http',
          'host': [
            'postman-echo',
            'com'
          ],
          'path': [
            'post'
          ],
          'query': [
            {
              'key': 'a',
              'value': 'b c'
            }
          ]
        }
      });
      convert(request, {}, function (error, snippet) {
        if (error) {
          expect.fail(null, null, error);
        }
        expect(snippet).to.be.a('string');
        expect(snippet).to.include('http://postman-echo.com/post?a=b%20c');
        expect(snippet).to.not.include('http://postman-echo.com/post?a=b c');
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
        expect(snippet).to.include('"key": "no file"');
        expect(snippet).to.include('"src": "/path/to/file"');
        expect(snippet).to.include('"key": "no src"');
        expect(snippet).to.include('"key": "invalid src"');
      });
    });
  });

  describe('getUrlStringfromUrlObject function', function () {
    var rawUrl, urlObject, outputUrlString;

    it('should return empty string for an url object for an empty url or if no url object is passed', function () {
      rawUrl = '';
      urlObject = new sdk.Url(rawUrl);
      outputUrlString = getUrlStringfromUrlObject(urlObject);
      expect(outputUrlString).to.be.empty;
      outputUrlString = getUrlStringfromUrlObject();
      expect(outputUrlString).to.be.empty;
    });

    it('should add protocol if present in the url object', function () {
      rawUrl = 'https://postman-echo.com';
      urlObject = new sdk.Url(rawUrl);
      outputUrlString = getUrlStringfromUrlObject(urlObject);
      expect(outputUrlString).to.equal(rawUrl);
    });

    it('should add the auth information if present in the url object', function () {
      rawUrl = 'https://user:password@postman-echo.com';
      urlObject = new sdk.Url(rawUrl);
      outputUrlString = getUrlStringfromUrlObject(urlObject);
      expect(outputUrlString).to.equal(rawUrl);
    });

    it('should not add the auth information if user isn\'t present but' +
    ' password is present in the url object', function () {
      rawUrl = 'https://:password@postman-echo.com';
      urlObject = new sdk.Url(rawUrl);
      outputUrlString = getUrlStringfromUrlObject(urlObject);
      expect(outputUrlString).to.not.include(':password');
    });

    it('should add host if present in the url object', function () {
      rawUrl = 'https://postman-echo.com';
      urlObject = new sdk.Url(rawUrl);
      outputUrlString = getUrlStringfromUrlObject(urlObject);
      expect(outputUrlString).to.equal(rawUrl);
    });

    it('should add port if present in the url object', function () {
      rawUrl = 'https://postman-echo.com:8080';
      urlObject = new sdk.Url(rawUrl);
      outputUrlString = getUrlStringfromUrlObject(urlObject);
      expect(outputUrlString).to.equal(rawUrl);
    });

    it('should add path if present in the url object', function () {
      rawUrl = 'https://postman-echo.com/get';
      urlObject = new sdk.Url(rawUrl);
      outputUrlString = getUrlStringfromUrlObject(urlObject);
      expect(outputUrlString).to.equal(rawUrl);
    });

    describe('queryParams', function () {

      it('should not encode unresolved query params', function () {
        rawUrl = 'https://postman-echo.com/get?key={{value}}';
        urlObject = new sdk.Url(rawUrl);
        outputUrlString = getUrlStringfromUrlObject(urlObject);
        expect(outputUrlString).to.not.include('key=%7B%7Bvalue%7B%7B');
        expect(outputUrlString).to.equal(rawUrl);
      });

      it('should encode query params other than unresolved variables', function () {
        rawUrl = 'https://postman-echo.com/get?key=\'a b c\'';
        urlObject = new sdk.Url(rawUrl);
        outputUrlString = getUrlStringfromUrlObject(urlObject);
        expect(outputUrlString).to.not.include('key=\'a b c\'');
        expect(outputUrlString).to.equal('https://postman-echo.com/get?key=%27a%20b%20c%27');
      });

      it('should not encode unresolved query params and ' +
      'encode every other query param, both present together', function () {
        rawUrl = 'https://postman-echo.com/get?key1={{value}}&key2=\'a b c\'';
        urlObject = new sdk.Url(rawUrl);
        outputUrlString = getUrlStringfromUrlObject(urlObject);
        expect(outputUrlString).to.not.include('key1=%7B%7Bvalue%7B%7B');
        expect(outputUrlString).to.not.include('key2=\'a b c\'');
        expect(outputUrlString).to.equal('https://postman-echo.com/get?key1={{value}}&key2=%27a%20b%20c%27');
      });

      it('should discard disabled query params', function () {
        urlObject = new sdk.Url({
          protocol: 'https',
          host: 'postman-echo.com',
          query: [
            { key: 'foo', value: 'bar' },
            { key: 'alpha', value: 'beta', disabled: true }
          ]
        });
        outputUrlString = getUrlStringfromUrlObject(urlObject);
        expect(outputUrlString).to.equal('https://postman-echo.com?foo=bar');
      });
    });

    it('should add hash if present in the url object', function () {
      rawUrl = 'https://postmanm-echo.com/get#hash';
      urlObject = new sdk.Url(rawUrl);
      outputUrlString = getUrlStringfromUrlObject(urlObject);
      expect(outputUrlString).to.equal(rawUrl);
    });
  });

  describe('getOptions function', function () {
    it('should return array of options for swift-urlsession converter', function () {
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
      expect(sanitize('inputString', 123, true)).to.equal('inputString');
    });
  });
});
