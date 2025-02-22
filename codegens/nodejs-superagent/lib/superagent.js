var _ = require('./lodash'),

  parseRequest = require('./parseRequest'),
  sanitize = require('./util').sanitize,
  sanitizeOptions = require('./util').sanitizeOptions;

/**
 * returns snippet of nodejs(superagent) by parsing data from Postman-SDK request object
 *
 * @param {Object} request - Postman SDK request object
 * @param {String} indentString - indentation required for code snippet
 * @param {Object} options
 * @returns {String} - nodejs(superagent) code snippet for given request object
 */
function makeSnippet (request, indentString, options) {
  var snippet,
    isFormDataFile = false;
  if (options.ES6_enabled) {
    snippet = 'const ';
  }
  else {
    snippet = 'var ';
  }
  snippet += 'superagent = require(\'superagent\');\n';
  if (request.body && request.body.mode === 'formdata') {
    _.forEach(request.body.toJSON().formdata, function (data) {
      if (!data.disabled && data.type === 'file') {
        isFormDataFile = true;
      }
    });
  }
  if (isFormDataFile) {
    if (options.ES6_enabled) {
      snippet += 'const ';
    }
    else {
      snippet += 'var ';
    }
    snippet += 'fs = require(\'fs\');\n';
  }
  snippet += '\n';

  if (request.body && !request.headers.has('Content-Type')) {
    if (request.body.mode === 'file') {
      request.addHeader({
        key: 'Content-Type',
        value: 'text/plain'
      });
    }
    else if (request.body.mode === 'graphql') {
      request.addHeader({
        key: 'Content-Type',
        value: 'application/json'
      });
    }
  }

  snippet += 'superagent\n';
  snippet += indentString + `.${request.method.toLowerCase()}('${sanitize(request.url.toString())}')\n`;
  snippet += parseRequest.parseHeader(request, indentString);

  if (request.body && request.body[request.body.mode]) {
    snippet += parseRequest.parseBody(request.body.toJSON(),
      indentString, options.trimRequestBody, request.headers.get('Content-Type'));
  }

  if (options.requestTimeout) {
    snippet += indentString + `.timeout(${options.requestTimeout})\n`;
  }

  if (options.followRedirect === false) {
    snippet += indentString + '.redirects(0)\n';
  }

  snippet += indentString + '.end(';
  if (options.ES6_enabled) {
    snippet += '(error, response) => {\n';
  }
  else {
    snippet += 'function (error, response) {\n';
  }
  snippet += indentString.repeat(2) + 'if (error) throw new Error(error);\n';
  snippet += indentString.repeat(2) + 'console.log(JSON.stringify(response.body));\n';
  snippet += indentString + '});';

  return snippet;
}

/**
 * Used to get the options specific to this codegen
 *
 * @returns {Array} - Returns an array of option objects
 */
function getOptions () {
  return [
    {
      name: 'Set indentation count',
      id: 'indentCount',
      type: 'positiveInteger',
      default: 2,
      description: 'Set the number of indentation characters to add per code level'
    },
    {
      name: 'Set indentation type',
      id: 'indentType',
      type: 'enum',
      availableOptions: ['Tab', 'Space'],
      default: 'Space',
      description: 'Select the character used to indent lines of code'
    },
    {
      name: 'Set request timeout',
      id: 'requestTimeout',
      type: 'positiveInteger',
      default: 0,
      description: 'Set number of milliseconds the request should wait for a response' +
    ' before timing out (use 0 for infinity)'
    },
    {
      name: 'Follow redirects',
      id: 'followRedirect',
      type: 'boolean',
      default: true,
      description: 'Automatically follow HTTP redirects'
    },
    {
      name: 'Trim request body fields',
      id: 'trimRequestBody',
      type: 'boolean',
      default: false,
      description: 'Remove white space and additional lines that may affect the server\'s response'
    },
    {
      name: 'Enable ES6 features',
      id: 'ES6_enabled',
      type: 'boolean',
      default: false,
      description: 'Modifies code snippet to incorporate ES6 (EcmaScript) features'
    }
  ];
}

/**
 * Converts Postman sdk request object to nodejs superagent code snippet
 *
 * @param {Object} request - postman-SDK request object
 * @param {Object} options
 * @param {String} options.indentType - type for indentation eg: Space, Tab
 * @param {String} options.indentCount - number of spaces or tabs for indentation.
 * @param {Boolean} options.followRedirect - whether to enable follow redirect
 * @param {Boolean} options.trimRequestBody - whether to trim fields in request body or not
 * @param {Boolean} options.ES6_enabled - whether to generate snippet with ES6 features
 * @param {Number} options.requestTimeout : time in milliseconds after which request will bail out
 * @param {Function} callback - callback function with parameters (error, snippet)
 */
function convert (request, options, callback) {
  if (!_.isFunction(callback)) {
    throw new Error('NodeJS-SuperAgent-Converter: callback is not valid function');
  }
  options = sanitizeOptions(options, getOptions());

  //  String representing value of indentation required
  var indentString;

  indentString = options.indentType === 'Tab' ? '\t' : ' ';
  indentString = indentString.repeat(options.indentCount);

  return callback(null, makeSnippet(request, indentString, options));
}

module.exports = {
  convert: convert,
  getOptions: getOptions
};
