var expect = require('chai').expect,
  sdk = require('postman-collection'),
  mainCollection = require('./fixtures/sample_collection.json'),
  convert = require('../../lib').convert;

describe('Python- Requests converter', function () {
  it('should throw an error when callback is not function', function () {
    expect(function () { convert({}, {}); })
      .to.throw('Python-Requests~convert: Callback is not a function');
  });

  it('should not have allow_redirects=False twice in generated snippet when' +
  ' followRedirect option is set as false', function () {
    var request = new sdk.Request(mainCollection.item[0].request),
      options = { followRedirect: false, requestTimeout: 0 };
    convert(request, options, function (err, snippet) {
      if (err) {
        expect.fail(null, null, err);
      }
      expect(snippet).to.be.a('string');
      expect(snippet).to.not.include('allow_redirects=False, allow_redirects=false');
    });
  });

  it('should have correct boolean value for allow_redirects(False, uppercased F) in generated snippet when' +
  ' followRedirect option is set as false', function () {
    var request = new sdk.Request(mainCollection.item[0].request),
      options = { followRedirect: false };
    convert(request, options, function (err, snippet) {
      if (err) {
        expect.fail(null, null, err);
      }
      expect(snippet).to.be.a('string');
      expect(snippet).to.include('allow_redirects=False');
      expect(snippet).to.not.include('allow_redirects=false');
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
      expect(snippet).to.include('\'key_containing_whitespaces\': \'  value_containing_whitespaces  \'');
    });
  });

  it('should convert JSON tokens into appropriate python tokens', function () {
    var request = new sdk.Request({
      'method': 'POST',
      'header': [
        {
          'key': 'Content-Type',
          'value': 'application/json',
          'type': 'text'
        }
      ],
      'body': {
        'mode': 'raw',
        'raw': `{
          "true": true,
          "false": false,
          "null": null
        }`
      },
      'url': {
        'raw': 'https://example.com',
        'protocol': 'https',
        'host': [
          'example',
          'com'
        ]
      }
    });
    convert(request, {}, function (error, snippet) {
      if (error) {
        expect.fail(null, null, error);
      }
      expect(snippet).to.be.a('string');
      expect(snippet).to.include('"true": True');
      expect(snippet).to.include('"false": False');
      expect(snippet).to.include('"null": None');
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
      // eslint-disable-next-line max-len
      expect(snippet).to.include('(\'no file\',(\'file\',open(\'/path/to/file\',\'rb\'),\'application/octet-stream\'))');
      // eslint-disable-next-line max-len
      expect(snippet).to.include('(\'no src\',(\'file\',open(\'/path/to/file\',\'rb\'),\'application/octet-stream\'))');
      // eslint-disable-next-line max-len
      expect(snippet).to.include('(\'invalid src\',(\'file\',open(\'/path/to/file\',\'rb\'),\'application/octet-stream\'))');
    });
  });

});
