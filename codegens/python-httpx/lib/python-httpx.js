let _ = require('./lodash'),
  parseBody = require('./util/parseBody'),
  sanitize = require('./util/sanitize').sanitize,
  sanitizeOptions = require('./util/sanitize').sanitizeOptions,
  addFormParam = require('./util/sanitize').addFormParam,
  self;


function structure (component, string) {
  let snippet = '';
  if (string !== null) {
    snippet += `${component} = ${string}`;
  }
  return snippet;
}

// eslint-disable-next-line require-jsdoc
function compile (request, snippets, options) {
  let configuration = [
    snippets.url,
    snippets.parameters ? 'params=parameters' : false,
    snippets.headers ? 'headers=headers' : false,
    snippets.data ? 'data=payload' : false,
    snippets.json ? 'json=payload' : false,
    request.body && request.body.mode && request.body.mode === 'formdata' ? 'files=files' : false,
    options.followRedirect ? 'allow_redirects=False' : false,
    options.requestTimeout !== 0 ? `timeout=${options.requestTimeout}` : false
  ].filter(Boolean);
  return `httpx.${request.method.toLowerCase()}(${configuration.join(', ')})`;
}

/**
 * Used to parse the request headers
 *
 * @param  {Object} request - postman SDK-request object
 * @param  {String} indentation - used for indenting snippet's structure
 * @returns {String} - request headers in the desired format
 */
function getHeaders (request, indentation) {
  let headers = request.getHeaders();
  if (headers.length > 0) {
    return JSON.stringify(headers, null, indentation);
  }
  return null;
}

/**
 * Used to parse the url parameters
 *
 * @param  {Object} url - parsed postman SDK-request object 'href' value
 * @param  {String} indentation - used for indenting snippet's structure
 * @returns {String} - request parameters in the desired format
 */
function getParameters (url, indentation) {
  let parameters = [...url.searchParams];
  if (parameters.length > 0) {
    return JSON.stringify(Object.fromEntries(parameters), null, indentation);
  }
  return null;
}

self = module.exports = {
  /**
   * Used to return options which are specific to a particular plugin
   *
   * @returns {Array}
   */
  getOptions: function () {
    return [{
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
    }];
  },

  /**
   * Used to convert the postman sdk-request object to python request snippet
   *
   * @param  {Object} request - postman SDK-request object
   * @param  {null} options
   * @param  {String} options.indentType - type of indentation eg: Space / Tab (default: Space)
   default: 1 for indentType: Tab)
   (default: 0 -> never bail out)
   */
  convert: function (request, options) {
    let snippets = {},
      indentation = '',
      identity = '',
      contentType,
      url = new URL(request.url),
      callback;

    snippets.import = 'import httpx';
    snippets.url = structure('url', sanitize(url.origin + url.pathname, 'url'));
    snippets.parameters = structure('parameters', getParameters(url, indentation));
    snippets.headers = structure('headers', getHeaders(request, indentation));

    if (_.isFunction(options)) {
      callback = options;
      options = null;
    }

    else if (!_.isFunction(callback)) {
      throw new Error('Python-httpx~convert: Callback is not a function');
    }

    options = sanitizeOptions(options, self.getOptions());
    identity = options.indentType === 'Tab' ? '\t' : ' ';
    indentation = identity.repeat(options.indentCount);
    contentType = request.headers.get('Content-Type');

    // Identifying our request payload - in the event it's type is as a JSON, ensuring we construct it accordingly.

    if (contentType && (contentType === 'application/json' || contentType.match(/\+json$/))) {
      // noinspection JSUnresolvedVariable
      snippets.json = `${parseBody(request.toJSON(), indentation, options.trimRequestBody, contentType)}`;
    }
    else {
      // noinspection JSUnresolvedVariable
      snippets.data = parseBody(request.toJSON(), indentation, options.trimRequestBody, contentType);
    }

    // The following code handles multiple files in the same formdata param.
    // It removes the form data params where the src property is an array of filepath strings
    // Splits that array into different form data params with src set as a single filepath string

    if (request.body && request.body.mode === 'formdata') {
      let formdata = request.body.formdata,
        formdataArray = [];
      formdata.members.forEach((param) => {
        let key = param.key,
          type = param.type,
          disabled = param.disabled,
          contentType = param.contentType;
        // check if type is file or text
        if (type === 'file') {
          // if src is not of type string we check for array(multiple files)
          if (typeof param.src !== 'string') {
            // if src is an array(not empty), iterate over it and add files as separate form fields
            if (Array.isArray(param.src) && param.src.length) {
              param.src.forEach((filePath) => {
                addFormParam(formdataArray, key, param.type, filePath, disabled, contentType);
              });
            }
            // if src is not an array or string, or is an empty array, add a placeholder for file path(no files case)
            else {
              addFormParam(formdataArray, key, param.type, '/path/to/file', disabled, contentType);
            }
          }
          // if src is string, directly add the param with src as filepath
          else {
            addFormParam(formdataArray, key, param.type, param.src, disabled, contentType);
          }
        }
        // if type is text, directly add it to formdata array
        else {
          addFormParam(formdataArray, key, param.type, param.value, disabled, contentType);
        }
      });
      request.body.update({
        mode: 'formdata',
        formdata: formdataArray
      });
    }

    if (request.body && !contentType) {
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

    snippets.request = compile(request, snippets, options);
    snippets.flush = 'print(response.text)';

    callback(null, Object.values(snippets).filter(Boolean).join('\n\n'));
  }
};
