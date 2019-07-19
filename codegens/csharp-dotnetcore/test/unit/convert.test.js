var expect = require('chai').expect,
  fs = require('fs'),
  sdk = require('postman-collection'),
  exec = require('shelljs').exec,
  newman = require('newman'),
  parallel = require('async').parallel,

  convert = require('../../lib/index').convert,
  mainCollection = require('./fixtures/testcollection/collection.json'),
  testCollection = require('./fixtures/testcollection/collectionForEdge.json'),
  getOptions = require('../../lib/index').getOptions,
  testResponse = require('./fixtures/testresponse.json'),
  sanitize = require('../../lib/util').sanitize,
  sanitizeOptions = require('../../lib/util').sanitizeOptions;

/**
 * compiles and runs codesnippet then compare it with newman output
 *
 * @param {String} codeSnippet - code snippet that needed to run using C#
 * @param {Object} collection - collection which will be run using newman
 * @param {Function} done - callback for async calls
 */
function runSnippet (codeSnippet, collection, done) {
  const depedenciesPath = 'test/unit/fixtures/dependencies';

  fs.writeFile(`${depedenciesPath}/main.cs`, codeSnippet, function (err) {
    if (err) {
      expect.fail(null, null, err);
      return done();
    }

    //  bash command string for compiling C#
    // var compile = `"C:\\Program Files (x86)\\Microsoft Visual Studio\\2019\\Community\\MSBuild\\Current\\Bin\\Roslyn\\csc.exe" -reference:${depedenciesPath}/System.Net.Http.dll -reference:${depedenciesPath}/System.Runtime.dll -reference:${depedenciesPath}/mscorlib.dll -reference:${depedenciesPath}/System.Private.CoreLib.dll -reference:${depedenciesPath}/System.Private.Uri.dll -reference:${depedenciesPath}/System.Console.dll -reference:${depedenciesPath}/System.Threading.Tasks.dll -out:${depedenciesPath}/main.exe ${depedenciesPath}/main.cs`;
    var compile = `mcs -reference:${depedenciesPath}/System.Net.Http.dll -reference:${depedenciesPath}/System.Runtime.dll -out:${depedenciesPath}/main.exe -reference:${depedenciesPath}/System.Private.CoreLib.dll ${depedenciesPath}/main.cs`;

    //  bash command stirng for run compiled C# file
    var run = `mono ${depedenciesPath}/main.exe`;
    // Old: run = `mono  ${depedenciesPath}/main.exe`;

    //  step by step process for compile, run code snippet, then comparing its output with newman
    parallel([
      function (callback) {
        exec(compile, function (err, stdout, stderr) {
          if (err) {
            return callback(err);
          }
          if (stderr) {
            return callback(stderr);
          }
          return exec(run, function (err, stdout, stderr) {
            if (err) {
              return callback(err);
            }
            if (stderr) {
              return callback(stderr);
            }
            try {
              stdout = JSON.parse(stdout);
            }
            catch (e) {
              console.error();
            }
            return callback(null, stdout);
          });
        });
      },
      function (callback) {
        newman.run({
          collection: collection
        }).on('request', function (err, summary) {
          if (err) {
            return callback(err);
          }

          var stdout = summary.response.stream.toString();
          try {
            stdout = JSON.parse(stdout);
          }
          catch (e) {
            console.error();
          }
          return callback(null, stdout);
        });
      }
    ], function (err, result) {
      if (err) {
        expect.fail(null, null, err);
      }
      else if (typeof result[1] !== 'object' || typeof result[0] !== 'object') {
        expect(result[0].trim()).to.equal(result[1].trim());
      }
      else {
        const propertiesTodelete = ['cookies', 'headersSize', 'startedDateTime', 'clientIPAddress'],
          headersTodelete = [
            'accept-encoding',
            'user-agent',
            'cf-ray',
            'kong-cloud-request-id', // random ID generated by mockbin
            'x-real-ip',
            'x-request-id',
            'x-request-start',
            'connect-time',
            'x-forwarded-for',
            'cache-control',
            'content-type',
            'content-length',
            'accept',
            'accept-language',
            'total-route-time',
            'cookie',
            'postman-token'
          ];
        if (result[0]) {
          propertiesTodelete.forEach(function (property) {
            delete result[0][property];
          });
          if (result[0].headers) {
            headersTodelete.forEach(function (property) {
              delete result[0].headers[property];
            });
          }
        }
        if (result[1]) {
          propertiesTodelete.forEach(function (property) {
            delete result[1][property];
          });
          if (result[1].headers) {
            headersTodelete.forEach(function (property) {
              delete result[1].headers[property];
            });
          }
        }

        expect(result[0]).deep.equal(result[1]);
      }
      return done();
    });
  });
}

// To disable tests, add .skip after the describe or it keywords.
describe('csharp .net core function', function () {
  describe('convert for different request types', function () {
    var headerSnippet = 'using System;\n' +
                        'using System.Net.Http;\n' +
                        'using System.Text;\n' +
                        'using System.Threading.Tasks;\n' +
                        'namespace HttpRequests {\n' +
                        '\tclass Program {\n' +
                        '\t\tstatic void Main(string[] args) {\n' +
                        '\t\t\tRequest().Wait();\n' +
                        '\t\t}\n' +
                        '\t\tstatic async Task Request() {\n',

      footerSnippet = '\t\t}\n\t}\n}\n';

    mainCollection.item.forEach(function (item) {
      it(item.name, function (done) {
        var request = new sdk.Request(mainCollection.item[5].request),
          collection = {
            item: [
              {
                request: request.toJSON()
              }
            ]
          },
          options = {
            indentCount: 1,
            indentType: 'tab',
            followRedirect: true,
            trimRequestBody: true,
            requestTimeout: 5000
          };
        convert(request, options, function (error, snippet) {
          if (error) {
            expect.fail(null, null, error);
            return;
          }
          runSnippet(headerSnippet + snippet + footerSnippet, collection, done);
        });
      });
      return false;
    });
  });

  describe('csharp-dotnetcore convert function', function () {
    it('should return expected snippet', function () {
      var request = new sdk.Request(mainCollection.item[4].request),
        options = {
          indentCount: 1,
          indentType: 'tab',
          followRedirect: true,
          trimRequestBody: true
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
        indentType: 'space',
        indentCount: 2
      };

    it('should return snippet with boilerplate code given option', function () {
      convert(request, { includeBoilerplate: true }, function (error, snippet) {
        if (error) {
          expect.fail(null, null, error);
          return;
        }
        expect(snippet).to.include('using System;\nusing System.Net.Http;\nnamespace HelloWorldApplication {\n');
      });
    });

    it('should generate snippet with space as an indent type with exact indent count', function () {
      convert(request, options, function (error, snippet) {
        if (error) {
          expect.fail(null, null, error);
          return;
        }
        snippetArray = snippet.split('\n');
        for (var i = 0; i < snippetArray.length; i++) {
          if (snippetArray[i].startsWith('namespace HelloWorldApplication {')) {
            expect(snippetArray[i + 1].charAt(0)).to.equal(' ');
            expect(snippetArray[i + 1].charAt(1)).to.equal(' ');
            expect(snippetArray[i + 1].charAt(2)).to.not.equal(' ');
          }
        }
      });
    });

    it('should add client timeout configurations when requestTimeout is set to non zero value', function () {
      convert(request, {requestTimeout: 5}, function (error, snippet) {
        if (error) {
          expect.fail(null, null, error);
        }
        expect(snippet).to.be.a('string');
        expect(snippet).to.include('client.Timeout = TimeSpan.FromMilliseconds(5)');
      });
    });

    it('should add client FollowRedirects configurations when followRedirects is set to false', function () {
      convert(request, {followRedirect: false}, function (error, snippet) {
        if (error) {
          expect.fail(null, null, error);
        }
        expect(snippet).to.be.a('string');
        expect(snippet).to.include('clientHandler.AllowAutoRedirect = false;');
      });
    });

  });

  describe('getOptions function', function () {
    it('should return array of options for csharp-dotnetcore converter', function () {
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
      testOptions.trimRequestBody = 'true';
      testOptions.indentType = 'tabSpace';
      sanitizedOptions = sanitizeOptions(testOptions, getOptions());
      expect(sanitizedOptions.indentCount).to.equal(defaultOptions.indentCount.default);
      expect(sanitizedOptions.indentType).to.equal(defaultOptions.indentType.default);
      expect(sanitizedOptions.trimRequestBody).to.equal(defaultOptions.trimRequestBody.default);
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
      testOptions.indentType = 'tab';
      testOptions.indentCount = 3;
      testOptions.requestTimeout = 3000;
      testOptions.trimRequestBody = true;
      testOptions.followRedirect = false;
      testOptions.includeBoilerplate = true;
      sanitizedOptions = sanitizeOptions(testOptions, getOptions());
      expect(sanitizedOptions).to.deep.equal(testOptions);
    });
  });

});
