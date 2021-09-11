var expect = require('chai').expect,
  sdk = require('postman-collection'),
  convert = require('../../lib/index').convert,
  mainCollection = require('./fixtures/testcollection/collection.json'),
  testCollection = require('./fixtures/testcollection/collectionForEdge.json'),
  getOptions = require('../../lib/index').getOptions,
  testResponse = require('./fixtures/testresponse.json'),
  sanitize = require('../../lib/util').sanitize,
  sanitizeOptions = require('../../lib/util').sanitizeOptions;
// csharpify = require('../../lib/util').csharpify;

describe('csharp httpclient function', function () {

  describe('csharp-httpclient convert function', function () {
    it('should return expected snippet', function () {
      var request = new sdk.Request(mainCollection.item[10].request),
        options = {
          indentCount: 1,
          indentType: 'Tab'
        };

      convert(request, options, function (error, snippet) {
        if (error) {
          expect.fail(null, null, error);
          return;
        }
        expect(snippet).deep.equal(testResponse.result);
      });
    });
  });

  describe('convert function', function () {
    var request = new sdk.Request(testCollection.item[0].request),
      snippetArray,
      options = {
        includeBoilerplate: true,
        indentType: 'Space',
        indentCount: 2
      };

    it('should return snippet with boilerplate code given option', function () {
      convert(request, { includeBoilerplate: true }, function (error, snippet) {
        if (error) {
          expect.fail(null, null, error);
          return;
        }
        expect(snippet).to.include('using System;\nusing System.Net.Http;\nusing System.Threading.Tasks;\n' +
          'namespace HelloWorldApplication\n{\n  public class Program\n  {\n    ' +
          'static async Task Main(string[] args)\n    {');
      });
    });

    it('should generate snippet with Space as indent type with exact indent count', function () {
      convert(request, options, function (error, snippet) {
        if (error) {
          expect.fail(null, null, error);
          return;
        }
        snippetArray = snippet.split('\n');
        for (var i = 0; i < snippetArray.length; i++) {
          if (snippetArray[i].startsWith('namespace HelloWorldApplication')) {
            expect(snippetArray[i + 1].charAt(0)).to.equal('{');
            // TODO: Do more expects
            expect(snippetArray[i + 2].charAt(0)).to.equal(' ');
          }
        }
      });
    });

    it('should add client timeout configurations when requestTimeout is set to non zero value', function () {
      convert(request, { requestTimeout: 5 }, function (error, snippet) {
        if (error) {
          expect.fail(null, null, error);
        }
        expect(snippet).to.be.a('string');
        expect(snippet).to.include('client.Timeout = TimeSpan.FromSeconds(5);');
      });
    });

    it('should add client FollowRedirects configurations when followRedirects is set to false', function () {
      convert(request, { followRedirect: false }, function (error, snippet) {
        if (error) {
          expect.fail(null, null, error);
        }

        expect(snippet).to.be.a('string');
        expect(snippet).to.include('AllowAutoRedirect = false');
      });
    });

    it('should create custom HttpMethod when method is non-standard', function () {
      var request = new sdk.Request({
        'method': 'NOTNORMAL',
        'header': [],
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
        expect(snippet).to.include('new HttpMethod("NOTNORMAL")');
      });
    });

    it('should throw when callback is not a function', function () {
      expect(function () { convert(request, {}, 'not a function'); })
        .to.throw('C#-HttpClient-Converter: Callback is not valid function');
    });

    it('should add fake body when content type header added to empty body', function () {
      var request = new sdk.Request({
        'method': 'DELETE',
        'body': {},
        'header': [
          {
            'key': 'Content-Type',
            'value': 'application/json'
          }
        ]
      });
      convert(request, {}, function (error, snippet) {
        if (error) {
          expect.fail(null, null, error);
        }
        expect(snippet).to.include('var content = new StringContent(string.Empty);');
        expect(snippet).to.include('content.Headers.ContentType = new MediaTypeHeaderValue(' +
          '"application/json");');
      });
    });

    it('should only include one System.IO using with multiple files', function () {
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
              'src': '/test1.txt'
            },
            {
              'key': 'no file',
              'value': '',
              'type': 'file',
              'src': '/test2.txt'
            }
          ]
        }
      });
      convert(request, { includeBoilerplate: true, indentCount: 2, indentType: 'Space' }, function (error, snippet) {
        if (error) {
          expect.fail(null, null, error);
        }
        expect(snippet).to.include('using System;\nusing System.IO;\nusing System.Net.Http;\n');
        expect(snippet).to
          .include('content.Add(new StreamContent(File.OpenRead("/test1.txt")), "no file", "/test1.txt");');
        expect(snippet).to
          .include('content.Add(new StreamContent(File.OpenRead("/test2.txt")), "no file", "/test2.txt");');
      });
    });
  });

  describe('getOptions function', function () {
    it('should return array of options for csharp-httpclient converter', function () {
      expect(getOptions()).to.be.an('array');
    });

    it('should return all the valid options', function () {
      expect(getOptions()[0]).to.have.property('id', 'includeBoilerplate');
      expect(getOptions()[1]).to.have.property('id', 'indentCount');
      expect(getOptions()[2]).to.have.property('id', 'indentType');
      expect(getOptions()[3]).to.have.property('id', 'requestTimeout');
      expect(getOptions()[4]).to.have.property('id', 'followRedirect');
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
      expect(sanitize('inputString        ', true)).to.equal('inputString');
    });
  });

  describe('sanitizeOptions function', function () {
    var defaultOptions = {},
      testOptions = {},
      sanitizedOptions;

    getOptions().forEach((option) => {
      defaultOptions[option.id] = {
        default: option.default,
        type: option.type
      };
      if (option.type === 'enum') {
        defaultOptions[option.id].availableOptions = option.availableOptions;
      }
    });

    it('should remove option not supported by module', function () {
      testOptions.randomName = 'random value';
      sanitizedOptions = sanitizeOptions(testOptions, getOptions());
      expect(sanitizedOptions).to.not.have.property('randomName');
    });

    it('should use defaults when option value type does not match with expected type', function () {
      testOptions = {};
      testOptions.indentCount = '5';
      testOptions.indentType = 'tabSpace';
      sanitizedOptions = sanitizeOptions(testOptions, getOptions());
      expect(sanitizedOptions.indentCount).to.equal(defaultOptions.indentCount.default);
      expect(sanitizedOptions.indentType).to.equal(defaultOptions.indentType.default);
    });

    it('should use defaults when option type is valid but value is invalid', function () {
      testOptions = {};
      testOptions.indentCount = -1;
      testOptions.indentType = 'spaceTab';
      testOptions.requestTimeout = -3000;
      sanitizedOptions = sanitizeOptions(testOptions, getOptions());
      expect(sanitizedOptions.indentCount).to.equal(defaultOptions.indentCount.default);
      expect(sanitizedOptions.indentType).to.equal(defaultOptions.indentType.default);
      expect(sanitizedOptions.requestTimeout).to.equal(defaultOptions.requestTimeout.default);
    });

    it('should return the same object when default options are provided', function () {
      for (var id in defaultOptions) {
        if (defaultOptions.hasOwnProperty(id)) {
          testOptions[id] = defaultOptions[id].default;
        }
      }
      sanitizedOptions = sanitizeOptions(testOptions, getOptions());
      expect(sanitizedOptions).to.deep.equal(testOptions);
    });

    it('should return the same object when valid (but not necessarily defaults) options are provided', function () {
      testOptions = {};
      testOptions.indentType = 'Tab';
      testOptions.indentCount = 3;
      testOptions.requestTimeout = 3000;
      testOptions.followRedirect = false;
      testOptions.includeBoilerplate = true;
      sanitizedOptions = sanitizeOptions(testOptions, getOptions());
      expect(sanitizedOptions).to.deep.equal(testOptions);
    });
  });
});
