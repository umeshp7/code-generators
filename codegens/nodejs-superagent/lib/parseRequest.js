var _ = require('./lodash'),

  sanitize = require('./util').sanitize,
  path = require('path');

/**
 * parses body of request when type of the request body is formdata or urlencoded and
 * returns code snippet for nodejs to add body
 *
 * @param {Array<Object>} dataArray - array containing body elements of request
 * @param {String} indentString - string required for indentation
 * @param {Boolean} trimBody - indicates whether to trim body or not
 * @param {String} requestType - indicates whether the requestBody is to be parsed as urlencoded or formdata
 */
function extractFormData (dataArray, indentString, trimBody, requestType) {
  if (!dataArray) {
    return '';
  }
  var snippetString = _.reduce(dataArray, (accumulator, item) => {
    if (item.disabled) {
      return accumulator;
    }
    /* istanbul ignore next */
    if (item.type === 'file') {
      if (Array.isArray(item.src) && item.src.length) {
        let fileSnippet = '';
        _.forEach(item.src, (filePath) => {
          fileSnippet += indentString + `.attach('${sanitize(item.key, trimBody)}',
            '${sanitize(filePath, trimBody)}')\n`;
        });
        if (fileSnippet !== '') {
          accumulator.push(fileSnippet);
        }
        else {
          return accumulator;
        }
      }
      else if (typeof item.src !== 'string') {
        accumulator.push(indentString + `.attach('${sanitize(item.key, trimBody)}', '/path/to/file')`);
      }
      else {
        var pathArray = item.src.split(path.sep),
          fileName = pathArray[pathArray.length - 1];
        accumulator.push(indentString + `.attach('${sanitize(item.key, trimBody)}', 
              '${sanitize(item.src, trimBody)}', '${sanitize(fileName, trimBody)}')`);
      }
    }
    else if (requestType === 'urlencoded') {
      accumulator.push(indentString +
        `.send({'${sanitize(item.key, trimBody)}':'${sanitize(item.value, trimBody)}'})`);
    }
    else if (requestType === 'formdata') {
      accumulator.push(indentString +
        `.field('${sanitize(item.key, trimBody)}', '${sanitize(item.value, trimBody)}')`);
    }
    return accumulator;
  }, []);
  return snippetString.join('\n');
}

/**
 * Parses body object based on mode of body and returns code snippet
 *
 * @param {Object} requestBody - json object for body of request
 * @param {String} indentString - string for indentation
 * @param {Boolean} trimBody - indicates whether to trim body fields or not
 * @param {String} contentType Content type of the body being sent
 */
function parseBody (requestBody, indentString, trimBody, contentType) {
  if (requestBody) {
    var bodySnippet = indentString;
    switch (requestBody.mode) {
      case 'raw':
        if (contentType === 'application/json') {
          try {
            let jsonBody = JSON.parse(requestBody[requestBody.mode]);
            bodySnippet += `.send(JSON.stringify(${JSON.stringify(jsonBody)}))\n`;
            break;
          }
          catch (error) {
            bodySnippet += `.send(${JSON.stringify(requestBody[requestBody.mode])})\n`;
            break;
          }
        }
        bodySnippet += `.send(${JSON.stringify(requestBody[requestBody.mode])})\n`;
        break;
      // eslint-disable-next-line no-case-declarations
      case 'graphql':
        let query = requestBody[requestBody.mode].query,
          graphqlVariables;
        try {
          graphqlVariables = JSON.parse(requestBody[requestBody.mode].variables);
        }
        catch (e) {
          graphqlVariables = {};
        }
        bodySnippet += '.send(JSON.stringify({\n' +
          `${indentString.repeat(2)}query: '${sanitize(query, trimBody)}',\n` +
          `${indentString.repeat(2)}variables: ${JSON.stringify(graphqlVariables)}\n` +
          `${indentString}}))\n`;
        break;
      case 'formdata':
        bodySnippet = `${extractFormData(requestBody[requestBody.mode], indentString, trimBody, requestBody.mode)}\n`;
        break;
      case 'urlencoded':
        bodySnippet += `.type('form')\n${extractFormData(requestBody[requestBody.mode],
          indentString, trimBody, requestBody.mode)}\n`;
        break;
        /* istanbul ignore next */
      case 'file':
        // return 'formData: {\n' +
        //                 extractFormData(requestBody[requestBody.mode], indentString, trimBody) +
        //                 indentString + '}';
        bodySnippet += '.send("<file contents here>")\n';
        break;
      default:
        bodySnippet = '';
    }
    return bodySnippet;
  }
  return '';
}

/**
 * parses header of request object and returns code snippet of nodejs superagent to add header
 *
 * @param {Object} request - Postman SDK request object
 * @param {String} indentString - indentation required in code snippet
 * @returns {String} - code snippet of nodejs superagent to add header
 */
function parseHeader (request, indentString) {
  var headerObject = request.getHeaders({enabled: true}),
    headerSnippet = `${indentString}.set({\n`;

  if (!_.isEmpty(headerObject)) {
    headerSnippet += _.reduce(Object.keys(headerObject), function (accumulator, key) {
      if (Array.isArray(headerObject[key])) {
        var headerValues = [];
        _.forEach(headerObject[key], (value) => {
          headerValues.push(`'${sanitize(value)}'`);
        });
        accumulator.push(
          indentString.repeat(2) + `'${sanitize(key, true)}': [${headerValues.join(', ')}]`
        );
      }
      else {
        accumulator.push(
          indentString.repeat(2) + `'${sanitize(key, true)}': '${sanitize(headerObject[key])}'`
        );
      }
      return accumulator;
    }, []).join(',\n') + '\n';
  }
  else {
    return '';
  }

  headerSnippet += indentString + '})\n';
  return headerSnippet;
}

module.exports = {
  parseBody: parseBody,
  parseHeader: parseHeader
};
