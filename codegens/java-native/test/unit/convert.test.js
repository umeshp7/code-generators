var expect = require('chai').expect,
  sdk = require('postman-collection'),
  sanitize = require('../../lib/util').sanitize,
  convert = require('../../lib/index').convert,
  getOptions = require('../../lib/index').getOptions,
  mainCollection = require('../../../../test/codegen/newman/fixtures/basicCollection.json');

describe('java convert function', function () {
  describe('convert function', function () {
    var request = new sdk.Request(mainCollection.item[0].request),
      snippetArray,
      options = {
        includeBoilerplate: true,
        indentType: 'Tab',
        indentCount: 2
      };
    const SINGLE_SPACE = ' ';

    it('should generate snippet with default options given no options', function () {
      convert(request, function (error, snippet) {
        if (error) {
          expect.fail(null, null, error);
          return;
        }
        snippetArray = snippet.split('\n');
        for (var i = 0; i < snippetArray.length; i++) {
          if (snippetArray[i].startsWith('public class main {')) {
            expect(snippetArray[i + 1].substr(0, 4)).to.equal(SINGLE_SPACE.repeat(4));
            expect(snippetArray[i + 1].charAt(4)).to.not.equal(SINGLE_SPACE);
          }
        }
      });
    });

    it('should return snippet with boilerplate code given option', function () {
      convert(request, { includeBoilerplate: true }, function (error, snippet) {
        if (error) {
          expect.fail(null, null, error);
          return;
        }
        expect(snippet).to.include('import java.io.*;\nimport javax.net.ssl.HttpsURLConnection;\n' +
        'import java.net.*;\nimport java.lang.reflect.*;\nimport java.util.*;\n' +
        'import java.util.function.BiConsumer;\npublic class main {\n');
      });
    });

    it('should return snippet with requestTimeout given option', function () {
      convert(request, { requestTimeout: 1000 }, function (error, snippet) {
        if (error) {
          expect.fail(null, null, error);
          return;
        }
        expect(snippet).to.include('.setConnectTimeout(1000)');
      });
    });

    it('should return snippet without followRedirect given option', function () {
      convert(request, { followRedirect: true }, function (error, snippet) {
        if (error) {
          expect.fail(null, null, error);
          return;
        }
        expect(snippet).to.not.include('.setInstanceFollowRedirects(false)');
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
          if (snippetArray[i].startsWith('public class main {')) {
            expect(snippetArray[i + 1].charAt(0)).to.equal('\t');
            expect(snippetArray[i + 1].charAt(1)).to.equal('\t');
            expect(snippetArray[i + 1].charAt(2)).to.not.equal('\t');
          }
        }
      });
    });

    it('should trim header keys and not trim header values', function () {
      var request = new sdk.Request({
        'method': 'GET',
        'header': [
          {
            'key': '  key_containing_whitespaces  ',
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
        expect(snippet).to.include('headerMap.accept("key_containing_whitespaces", ' +
        '"  value_containing_whitespaces  ")');
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
        expect(snippet).to.include('"/path/to/file","no file"');
        expect(snippet).to.include('"/path/to/file","no src"');
        expect(snippet).to.include('"/path/to/file","invalid src"');
        expect(snippet).to.include('BiConsumer<String, String> uploadFileFunction');
      });
    });

    it('should generate snippets for mixed form data of text and files', function () {
      var request = new sdk.Request({
        'method': 'POST',
        'header': [
          {
            'key': 'Content-Type',
            'value': 'application/x-www-form-urlencoded',
            'disabled': true
          },
          {
            'key': 'content-type',
            'value': 'application/json',
            'disabled': true
          }
        ],
        'body': {
          'mode': 'formdata',
          'formdata': [
            {
              'key': 'fdjks',
              'value': '',
              'type': 'text'
            },
            {
              'key': 'sdf',
              'src': 'package.json',
              'type': 'file'
            },
            {
              'key': '12',
              'value': '"23"',
              'description': '',
              'type': 'text'
            },
            {
              'key': '\'123\'',
              'value': '\'1"23"4\'',
              'description': '',
              'type': 'text'
            },
            {
              'key': '\'"23\\"4\\""\'',
              'value': '',
              'description': '',
              'type': 'text',
              'disabled': true
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
        expect(snippet).to.include('uploadFileFunction.accept("package.json","sdf")');
        expect(snippet).to.include('addFormField.accept("12","\\"23\\"")');
        expect(snippet).to.include('addFormField.accept("\'123\'","\'1\\"23\\"4\'")');
        expect(snippet).to.include('addFormField.accept("fdjks","")');
        expect(snippet).to.include('BiConsumer<String, String> uploadFileFunction');
        expect(snippet).to.include('BiConsumer<String,String> addFormField');
      });
    });
  });


  it('should generate snippets for Patch request', function () {
    var request = new sdk.Request({
      'method': 'PATCH',
      'header': [
        {
          'key': 'Content-Type',
          'value': 'text/plain'
        }
      ],
      'body': {
        'mode': 'raw',
        'raw': 'Curabitur auctor, elit nec pulvinar porttitor,'
      },
      'url': {
        'raw': 'https://postman-echo.com/patch',
        'protocol': 'https',
        'host': [
          'postman-echo',
          'com'
        ],
        'path': [
          'patch'
        ]
      }
    });
    convert(request, {}, function (error, snippet) {
      if (error) {
        expect.fail(null, null, error);
      }
      expect(snippet).to.be.a('string');
      expect(snippet).to.include('Field methodsField');
      expect(snippet).to.include('methodsField.set(null, methods)');
      expect(snippet).to.include('"Curabitur auctor, elit nec pulvinar porttitor,');
    });
  });


  it('should generate snippets for uploading file', function () {
    var request = new sdk.Request({
      'method': 'POST',
      'header': [],
      'body': {
        'mode': 'file',
        'file': {
          'src': 'dummy.png'
        }
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
      expect(snippet).to.include('uploadFileFunction.accept("dummy.png",null)');
      expect(snippet).to.include('BiConsumer<String, String> uploadFileFunction');
    });
  });

  it('should generate snippets for combining multiple same headers', function () {
    var request = new sdk.Request({
      'method': 'GET',
      'header': [
        {
          'key': 'key',
          'value': 'value1',
          'type': 'text'
        },
        {
          'key': 'key',
          'value': 'value2',
          'type': 'text'
        }
      ],
      'url': {
        'raw': 'https://postman-echo.com/get',
        'protocol': 'https',
        'host': [
          'postman-echo',
          'com'
        ],
        'path': [
          'get'
        ]
      }
    });
    convert(request, {}, function (error, snippet) {
      if (error) {
        expect.fail(null, null, error);
      }
      expect(snippet).to.be.a('string');
      expect(snippet).to.include('headerMap.accept("key", "value1")');
      expect(snippet).to.include('headerMap.accept("key", "value2")');
      expect(snippet).to.include('con.setRequestProperty(entry.getKey(), entry.getValue())');
      expect(snippet).to.include('BiConsumer<String,String> headerMap');
      expect(snippet).to.include('Map<String, String> headers = new HashMap<>()');
    });
  });

  it('should generate snippets for graph QL body', function () {
    var request = new sdk.Request({
      'method': 'POST',
      'header': [],
      'body': {
        'mode': 'graphql',
        'graphql': {
          'query': '{\n    body{\n        graphql\n    }\n}',
          'variables': '{\n\t"variable_key": "variable_value"\n}'
        }
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
      expect(snippet).to.include('con.setRequestProperty("Content-Type", "application/json")');
    });
  });

  describe('getOptions function', function () {
    it('should return array of options for csharp-restsharp converter', function () {
      expect(getOptions()).to.be.an('array');
    });

    it('should return all the valid options', function () {
      expect(getOptions()[0]).to.have.property('id', 'includeBoilerplate');
      expect(getOptions()[1]).to.have.property('id', 'indentCount');
      expect(getOptions()[2]).to.have.property('id', 'indentType');
      expect(getOptions()[3]).to.have.property('id', 'requestTimeout');
      expect(getOptions()[4]).to.have.property('id', 'followRedirect');
      expect(getOptions()[5]).to.have.property('id', 'trimRequestBody');
    });
  });

  describe('sanitize function', function () {
    it('should handle invalid parameters', function () {
      expect(sanitize(123, false)).to.equal('');
      expect(sanitize(' inputString', true)).to.equal('inputString');
    });
  });

});
