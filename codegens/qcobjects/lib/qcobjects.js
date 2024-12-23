var _ = require('./lodash'),
  sanitize = require('./util').sanitize,
  sanitizeOptions = require('./util').sanitizeOptions,
  getUrlStringfromUrlObject = require('./util').getUrlStringfromUrlObject,
  addFormParam = require('./util').addFormParam,
  self;
global.URL = require('url').URL;

/**
 * Parses Raw data from request to fetch syntax
 *
 * @param {Object} body - Raw body data
 * @param {String} mode - Request body type (i.e. raw, urlencoded, formdata, file)
 * @param {boolean} trim - trim body option
 * @returns {String} request body in the desired format
 */
function parseRawBody (body, mode, trim) {
  if (_.isEmpty(body)) {
    return '';
  }
  var bodySnippet;
  bodySnippet = `data:${sanitize(body, mode, trim)}`;
  return bodySnippet;
}

/**
 * Parses graphql data from request to fetch syntax
 *
 * @param {Object} body - grqphql body data
 * @param {String} mode - Request body type (i.e. raw, urlencoded, formdata, file)
 * @param {boolean} trim - trim body option
 * @returns {String} request body in the desired format
 */
function parseGraphQL (body, mode, trim) {
  if (_.isEmpty(body)) {
    return '';
  }
  let query = body.query,
    graphqlVariables, bodySnippet;
  try {
    graphqlVariables = JSON.parse(body.variables);
  }
  catch (e) {
    graphqlVariables = {};
  }
  bodySnippet = `data:${sanitize(JSON.stringify({
    query: query,
    variables: graphqlVariables
  }), mode, trim)}`;
  return bodySnippet;
}

/**
 * Parses URLEncoded body from request to fetch syntax
 *
 * @param {Object} body - URLEncoded Body
 * @param {String} mode - Request body type (i.e. raw, urlencoded, formdata, file)
 * @param {boolean} trim - trim body option
 * @returns {String} request body in the desired format
 */
function parseURLEncodedBody (body, mode, trim) {
  if (_.isEmpty(body)) {
    return '';
  }
  var payload, bodySnippet;
  payload = _.reduce(body, function (accumulator, data) {
    if (!data.disabled) {
      accumulator.push(`${sanitize(data.key, mode, trim)}=${sanitize(data.value, mode, trim)}`);
    }
    return accumulator;
  }, []).join('&');

  bodySnippet = `data:"${payload}"`;
  return bodySnippet;
}

/**
 * Parses formData body from request to fetch syntax
 *
 * @param {Object} body - formData Body
 * @param {String} mode - Request body type (i.e. raw, urlencoded, formdata, file)
 * @param {boolean} trim - trim body option
 * @param {String} indent - indentation string
 * @returns {String} request body in the desired format
 */
function parseFormData (body, mode, trim, indent) {
  var parameters = [],
    parameter,
    bodySnippet;
  _.forEach(body, (data) => {
    if (!(data.disabled)) {
      parameter = '';
      parameter += `${indent}[\n${indent.repeat(2)}"key": "${sanitize(data.key, mode, trim)}",\n`;
      if (data.type === 'file') {
        parameter += `${indent.repeat(2)}"src": "${sanitize(data.src, mode, trim)}",\n`;
        parameter += `${indent.repeat(2)}"type": "file"\n${indent}]`;
      }
      else {
        parameter += `${indent.repeat(2)}"value": "${sanitize(data.value, mode, trim)}",\n`;
        parameter += `${indent.repeat(2)}"type": "text"\n${indent}]`;
      }
      parameters.push(parameter);
    }
  });
  parameters = String('\n' + _.join(parameters, ',\n'));
  parameters = parameters.replace(/^\s*$(?:\r\n?|\n)/gm, '');
  bodySnippet = `data:"${parameters}"`;
  return bodySnippet;
}

/* istanbul ignore next */
/**
 * Parses file body from the Request
 *
 * @returns {String} request body in the desired format
 */
function parseFile () {
  var bodySnippet = '"<file contents here>"';
  return bodySnippet;
}

/**
 * Parses Body from the Request using
 *
 * @param {Object} body - body object from request.
 * @param {boolean} trim - trim body option
 * @param {String} indent - indentation string
 * @returns {String} utility function for getting request body in the desired format
 */
function parseBody (body, trim, indent) {
  if (!_.isEmpty(body)) {
    switch (body.mode) {
      case 'urlencoded':
        return parseURLEncodedBody(body.urlencoded, body.mode, trim);
      case 'raw':
        return parseRawBody(body.raw, body.mode, trim);
      case 'graphql':
        return parseGraphQL(body.graphql, 'raw', trim);
      case 'formdata':
        return parseFormData(body.formdata, body.mode, trim, indent);
        /* istanbul ignore next */
      case 'file':
        return parseFile(indent);
      default:
        return '';
    }
  }
  return '';
}

/**
 * Parses headers from the request.
 *
 * @param {Object} headers - headers from the request.
 * @param {String} mode - Request body type (i.e. raw, urlencoded, formdata, file)
 * @returns {String} request headers in the desired format
 */
function parseHeaders (headers, mode) {
  var headerSnippet = '';
  if (!_.isEmpty(headers)) {
    headerSnippet = 'headers:{';
    headers = _.reject(headers, 'disabled');
    _.forEach(headers, function (header) {
      headerSnippet += `"${sanitize(header.key, 'header', true).trim()}":`;
      headerSnippet += `"${sanitize(header.value, 'header')}",\n`;
    });

    headerSnippet = headerSnippet.slice(0, -2) + '},';
  }
  if (mode === 'formdata') {
    // add Content-Type multipart/form-data
  }
  return headerSnippet;
}

self = module.exports = {
  /**
   * Used in order to get additional options for generation of qcobjects code snippet
   *
   * @module getOptions
   *
   * @returns {Array} Additional options specific to generation of qcobjects-serviceLoader code snippet
   */
  getOptions: function () {
    return [{
      name: 'Set indentation count',
      id: 'indentCount',
      type: 'positiveInteger',
      default: 4,
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
      name: 'Trim request body fields',
      id: 'trimRequestBody',
      type: 'boolean',
      default: false,
      description: 'Remove white space and additional lines that may affect the server\'s response'
    },
    {
      name: 'Follow redirects',
      id: 'followRedirect',
      type: 'boolean',
      default: true,
      description: 'Automatically follow HTTP redirects'
    }
    ];
  },

  /**
     * Converts Postman sdk request object to qcobjects-serviceLoader code snippet
     *
     * @module convert
     *
     * @param  {Object} request - Postman SDK-request object
     * @param  {Object} options - Options to tweak code snippet generated in qcobjects
     * @param  {String} options.indentType - type of indentation eg: Space / Tab (default: Space)
     * @param  {Number} options.indentCount - frequency of indent (default: 4 for indentType: Space,
                                                     default: 1 for indentType: Tab)
     * @param {Number} options.requestTimeout - time in milli-seconds after which request will bail out
                                     (default: 0 -> never bail out)
     * @param {Boolean} options.trimRequestBody - whether to trim request body fields (default: false)
     * @param {Boolean} options.followRedirect - whether to allow redirects of a request
     * @param  {Function} callback - Callback function with parameters (error, snippet)
     * @returns {String} Generated swift snippet via callback
     */
  convert: function (request, options, callback) {

    if (_.isFunction(options)) {
      callback = options;
      options = {};
    }
    else if (!_.isFunction(callback)) {
      throw new Error('qcobjects-Converter: callback is not valid function');
    }
    options = sanitizeOptions(options, self.getOptions());
    var codeSnippet, indent, trim, finalUrl, // followRedirect,timeout
      bodySnippet = '',
      headerSnippet = '',
      dataSnippet = '',
      requestBody;

    indent = options.indentType === 'Tab' ? '\t' : ' ';
    indent = indent.repeat(options.indentCount);
    // timeout = options.requestTimeout;
    // followRedirect = options.followRedirect;
    trim = options.trimRequestBody;
    finalUrl = getUrlStringfromUrlObject(request.url);

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
    requestBody = (request.body ? request.body.toJSON() : {});
    bodySnippet = parseBody(requestBody, trim, indent);

    headerSnippet = parseHeaders(request.toJSON().header, (request.body ? request.body.mode : 'raw'));
    if (bodySnippet !== '') {
      dataSnippet = `${indent}${bodySnippet}`;
    }

    dataSnippet = dataSnippet.replace(/^\s*$(?:\r\n?|\n)/gm, '');

    codeSnippet = '';
    codeSnippet += `require('qcobjects');logger.infoEnabled=false;
    ${indent}Class('MyTestService',Service,{
    ${indent.repeat(2)}name:'myservice',
    ${indent.repeat(2)}external:true,
    ${indent.repeat(2)}cached:false,
    ${indent.repeat(2)}method:"${request.method}",
    ${indent.repeat(2)}${headerSnippet}
    ${indent.repeat(2)}url:"${finalUrl}",
    ${indent.repeat(2)}withCredentials:false,
    ${indent.repeat(2)}_new_:()=>{
    ${indent.repeat(3)}// service instantiated
    ${indent.repeat(2)}},
    ${indent.repeat(2)}done:()=>{
    ${indent.repeat(3)}// service loaded
    ${indent.repeat(2)}}
    ${indent}});
    var service = serviceLoader(New(MyTestService,{
      ${dataSnippet}
    })).then(
      (successfulResponse)=>{
    ${indent.repeat(2)}// This will show the service response as a plain text
    ${indent.repeat(2)}console.log(successfulResponse.service.template);
    },
    (failedResponse)=>{
      ${indent.repeat(2)}// The service call failed
      ${indent.repeat(2)}console.log('The service call failed');
      ${indent.repeat(2)}console.log(failedResponse);
    }).catch((e)=>{
      ${indent.repeat(2)}// Something went wrong when calling the service
      ${indent.repeat(2)}console.log('Something went wrong when calling the service');
      ${indent.repeat(2)}console.log(failedResponse);
    });`;
    return callback(null, codeSnippet);
  }
};
