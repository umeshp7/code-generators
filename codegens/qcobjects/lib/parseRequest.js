/* eslint-env node, es6 */
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
 */
function extractFormData (dataArray, indentString, trimBody) {
  if (!dataArray) {
    return '';
  }
  var snippetString = _.reduce(dataArray, (accumalator, item) => {
    if (item.disabled) {
      return accumalator;
    }
    /* istanbul ignore next */
    if (item.type === 'file') {
      /**
             * creating snippet to send file in nodejs request
             * for example:
             *  'fieldname': {
             *      'value': fs.createStream('filename.ext'),
             *      'options': {
             *          'filename': 'filename.ext',
             *          'contentType: null
             *          }
             *      }
             *  }
             */
      if (Array.isArray(item.src) && item.src.length) {
        let fileSnippet = '',
          fileArray = [];
        _.forEach(item.src, (filePath) => {
          fileArray.push(`${indentString.repeat(3)}fs.createReadStream('${sanitize(filePath, trimBody)}')`);
        });
        if (fileArray.length) {
          fileSnippet += `${indentString.repeat(2)}'${sanitize(item.key, trimBody)}': ` +
          `[\n${fileArray.join(',\n')}\n${indentString.repeat(2)}]`;
          accumalator.push(fileSnippet);
        }
        else {
          return accumalator;
        }
      }
      else if (typeof item.src !== 'string') {
        accumalator.push([
          indentString.repeat(2) + `'${sanitize(item.key, trimBody)}': {`,
          indentString.repeat(3) + '\'value\': fs.createReadStream(\'/path/to/file\'),',
          indentString.repeat(3) + '\'options\': {',
          indentString.repeat(4) + '\'filename\': \'filename\'',
          indentString.repeat(4) + '\'contentType\': null',
          indentString.repeat(3) + '}',
          indentString.repeat(2) + '}'
        ].join('\n'));
      }
      else {
        var pathArray = item.src.split(path.sep),
          fileName = pathArray[pathArray.length - 1];
        accumalator.push([
          indentString.repeat(2) + `'${sanitize(item.key, trimBody)}': {`,
          indentString.repeat(3) + `'value': fs.createReadStream('${sanitize(item.src, trimBody)}'),`,
          indentString.repeat(3) + '\'options\': {',
          indentString.repeat(4) + `'filename': '${sanitize(fileName, trimBody)}',`,
          indentString.repeat(4) + '\'contentType\': null',
          indentString.repeat(3) + '}',
          indentString.repeat(2) + '}'
        ].join('\n'));
      }
    }
    else {
      accumalator.push(
        indentString.repeat(2) +
                `'${sanitize(item.key, trimBody)}': '${sanitize(item.value, trimBody)}'`
      );
    }
    return accumalator;
  }, []);
  return snippetString.join(',\n') + '\n';
}

/**
 * Parses body object when requestbody.mode is raw
 *
 * @param {Object} requestbody - json object for body of request
 * @param {String} indentString - string for indentation
 * @param {Boolean} trimBody - indicates whether to trim body fields or not
 * @param {String} contentType Content type of the body being sent
 */
function parseBodyRaw (requestbody, indentString, trimBody, contentType) {
  if (contentType === 'application/json') {
    try {
      let jsonBody = JSON.parse(requestbody[requestbody.mode]);
      return `body: JSON.stringify(${JSON.stringify(jsonBody)})\n`;
    }
    catch (error) {
      return `body: ${JSON.stringify(requestbody[requestbody.mode])}\n`;
    }
  }
  return `body: ${JSON.stringify(requestbody[requestbody.mode])}\n`;
}

/* eslint-disable no-unused-vars */
/**
 * Parses body object when requestbody.mode is graphql
 *
 * @param {Object} requestbody - json object for body of request
 * @param {String} indentString - string for indentation
 * @param {Boolean} trimBody - indicates whether to trim body fields or not
 * @param {String} contentType Content type of the body being sent
 */
function parseBodyGraphQL (requestbody, indentString, trimBody, contentType) {
  let query = requestbody[requestbody.mode].query,
    graphqlVariables;
  try {
    graphqlVariables = JSON.parse(requestbody[requestbody.mode].variables);
  }
  catch (e) {
    graphqlVariables = {};
  }
  return 'body: JSON.stringify({\n' +
    `${indentString.repeat(2)}query: '${sanitize(query, trimBody)}',\n` +
    `${indentString.repeat(2)}variables: ${JSON.stringify(graphqlVariables)}\n` +
    `${indentString}})`;

}

/* eslint-disable no-unused-vars */
/**
 * Parses body object when requestbody.mode is formdata
 *
 * @param {Object} requestbody - json object for body of request
 * @param {String} indentString - string for indentation
 * @param {Boolean} trimBody - indicates whether to trim body fields or not
 * @param {String} contentType Content type of the body being sent
 */
function parseBodyFormdata (requestbody, indentString, trimBody, contentType) {
  return `formData: {\n${extractFormData(requestbody[requestbody.mode], indentString, trimBody)}` +
                  indentString + '}';
}


/* eslint-disable no-unused-vars */
/**
 * Parses body object when requestbody.mode is urlencoded
 *
 * @param {Object} requestbody - json object for body of request
 * @param {String} indentString - string for indentation
 * @param {Boolean} trimBody - indicates whether to trim body fields or not
 * @param {String} contentType Content type of the body being sent
 */
function parseBodyUrlEncoded (requestbody, indentString, trimBody, contentType) {
  return `form: {\n${extractFormData(requestbody[requestbody.mode], indentString, trimBody)}` +
                  indentString + '}';

}

/* eslint-disable no-unused-vars */
/**
 * Parses body object when requestbody.mode is file
 *
 * @param {Object} requestbody - json object for body of request
 * @param {String} indentString - string for indentation
 * @param {Boolean} trimBody - indicates whether to trim body fields or not
 * @param {String} contentType Content type of the body being sent
 */
function parseBodyFile (requestbody, indentString, trimBody, contentType) {
  return 'body: "<file contents here>"\n';
}

/**
 * Parses body object based on mode of body and returns code snippet
 *
 * @param {Object} requestbody - json object for body of request
 * @param {String} indentString - string for indentation
 * @param {Boolean} trimBody - indicates whether to trim body fields or not
 * @param {String} contentType Content type of the body being sent
 */
function parseBody (requestbody, indentString, trimBody, contentType) {
  if (requestbody) {
    let parseBodyFunc = {
      'raw': parseBodyRaw,
      'graphql': parseBodyGraphQL,
      'formdata': parseBodyFormdata,
      'Formdata': parseBodyFormdata,
      'urlencoded': parseBodyUrlEncoded
    };
    if (parseBodyFunc.hasOwnProperty(requestbody.mode)) {
      return parseBodyFunc[requestbody.mode].call(null, requestbody, indentString, trimBody, contentType);
    }
    if (requestbody.mode === 'file') {
      /* istanbul ignore next */
      parseFile(requestbody, indentString, trimBody, contentType);
    }

    return '';
  }
  return '';
}

/**
 * parses header of request object and returns code snippet of nodejs request to add header
 *
 * @param {Object} request - Postman SDK request object
 * @param {String} indentString - indentation required in code snippet
 * @returns {String} - code snippet of nodejs request to add header
 */
function parseHeader (request, indentString) {
  var headerObject = request.getHeaders({enabled: true}),
    headerSnippet = indentString + '\'headers\': {\n';

  if (!_.isEmpty(headerObject)) {
    headerSnippet += _.reduce(Object.keys(headerObject), function (accumalator, key) {
      if (Array.isArray(headerObject[key])) {
        var headerValues = [];
        _.forEach(headerObject[key], (value) => {
          headerValues.push(`'${sanitize(value)}'`);
        });
        accumalator.push(
          indentString.repeat(2) + `'${sanitize(key, true)}': [${headerValues.join(', ')}]`
        );
      }
      else {
        accumalator.push(
          indentString.repeat(2) + `'${sanitize(key, true)}': '${sanitize(headerObject[key])}'`
        );
      }
      return accumalator;
    }, []).join(',\n') + '\n';
  }

  headerSnippet += indentString + '}';
  return headerSnippet;
}

module.exports = {
  parseBody: parseBody,
  parseHeader: parseHeader
};
