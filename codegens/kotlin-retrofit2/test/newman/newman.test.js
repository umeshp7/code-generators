var runNewmanTest = require('../../../../test/codegen/newman/newmanTestUtil').runNewmanTest,
  convert = require('../../lib/index').convert;

describe('Convert for different types of request', function () {
  var options = {indentCount: 2, indentType: 'Space', includeBoilerplate: true },
    testConfig = {
      compileScript: 'kotlinc snippet.kt -include-runtime -d snippet.jar',
      runScript: 'kotlin snippet.jar',
      fileName: 'snippet.kt',
      headerSnippet: '',
      skipCollections: ['sameNameHeadersCollection']
    };

  runNewmanTest(convert, options, testConfig);
});
