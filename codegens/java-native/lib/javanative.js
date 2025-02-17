var _ = require('./lodash'),

  parseRequest = require('./parseRequest'),
  sanitize = require('./util').sanitize,
  addFormParam = require('./util').addFormParam,
  sanitizeOptions = require('./util').sanitizeOptions;

//  Since Java requires to add extralines of code to handle methods with body
const METHODS_WITHOUT_BODY = ['GET', 'HEAD', 'COPY', 'UNLOCK', 'UNLINK', 'PURGE', 'LINK', 'VIEW'];

/**
 * returns content-type and boundary snippet of java for multipart request
 *
 * @returns {String} - java code snippet for multi-part content
 */
function multiPartSnippet () {
  return 'final String boundary = "===" + System.currentTimeMillis() + "===";\n' +
  'con.setRequestProperty("Content-Type", "multipart/form-data; boundary=" + boundary);\n';
}

/**
 * returns snippet of java by parsing data from Postman-SDK request object
 *
 * @param {Object} request - Postman SDK request object
 * @param {String} indentString - indentation required for code snippet
 * @param {Object} options - Options to tweak code snippet
 * @returns {String} - java code snippet for given request object
 */
function makeSnippet (request, indentString, options) {

  var isBodyRequired = !(_.includes(METHODS_WITHOUT_BODY, request.method)),
    snippet = '';
  if (request.method === 'PATCH') {
    snippet += 'System.err.close();\n' +
    'System.setErr(System.out);\n' +
    'try {\n' +
    indentString + 'Field methodsField = HttpURLConnection.class.getDeclaredField("methods");\n' +
    indentString + 'methodsField.setAccessible(true);\n' +
    indentString + 'Field modifiersField = Field.class.getDeclaredField("modifiers");\n' +
    indentString + 'modifiersField.setAccessible(true);\n' +
    indentString + 'modifiersField.setInt(methodsField, methodsField.getModifiers() & ~Modifier.FINAL);\n' +
    indentString + 'String[] methods = {\n' +
    indentString.repeat(2) + '"GET", "POST", "HEAD", "OPTIONS", "PUT", "DELETE", "TRACE", "PATCH"\n' +
    indentString + '};\n' +
    indentString + 'methodsField.set(null, methods);\n' +
    indentString + '} catch (Exception e) {\n' +
    indentString.repeat(2) + 'e.printStackTrace();\n' +
    indentString + '};\n';
  }
  snippet += `URL obj = new URL("${sanitize(request.url.toString())}");\n` +
  'URLConnection connection = obj.openConnection();\n' +
  'HttpURLConnection con = (HttpURLConnection) connection;\n' +
  `con.setRequestMethod("${request.method}");\n`;

  if (options.requestTimeout > 0) {
    snippet += `con.setConnectTimeout(${options.requestTimeout});\n`;
  }

  if (!options.followRedirect) {
    snippet += 'con.setInstanceFollowRedirects(false);\n';
  }

  snippet += parseRequest.parseHeader(request, indentString);
  snippet += 'con.setRequestProperty("Accept","application/json");\n';
  snippet += `con.setDoOutput(${isBodyRequired ? 'true' : 'false'});\n`;

  if (isBodyRequired) {
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
        if (type === 'file') {
          if (typeof param.src !== 'string') {
            if (Array.isArray(param.src) && param.src.length) {
              param.src.forEach((filePath) => {
                addFormParam(formdataArray, key, param.type, filePath, disabled, contentType);
              });
            }
            else {
              addFormParam(formdataArray, key, param.type, '/path/to/file', disabled, contentType);
            }
          }
          else {
            addFormParam(formdataArray, key, param.type, param.src, disabled, contentType);
          }
        }
        else {
          addFormParam(formdataArray, key, param.type, param.value, disabled, contentType);
        }
      });
      request.body.update({
        mode: 'formdata',
        formdata: formdataArray
      });
      snippet += formdataArray.length > 0 ? multiPartSnippet() :
        'con.setRequestProperty("Content-Type", "application/json");\n';
    }
    if (request.body && request.body.mode === 'file') {
      snippet += multiPartSnippet();
    }
    if (request.body && request.body.mode === 'graphql') {
      snippet += 'con.setRequestProperty("Content-Type", "application/json");\n';
    }
    let requestBody = (request.body ? request.body.toJSON() : {});
    snippet += parseRequest.parseBody(requestBody, indentString, options.trimRequestBody);
  }


  snippet += 'BufferedReader in = new BufferedReader(new InputStreamReader(con.getInputStream()));\n' +
  'String temp = null;\n' +
  'StringBuilder response = new StringBuilder();\n' +
  'while ((temp = in.readLine()) != null) {\n' +
  indentString + 'response.append(temp).append(" ");\n' +
  '}\n' +
  'System.out.println(response.toString());\n' +
  'in.close();';

  return snippet;
}


/**
 * Used in order to get options for generation of Java code snippet (i.e. Include Boilerplate code)
 *
 * @module getOptions
 *
 * @returns {Array} Options specific to generation of Java code snippet
 */
function getOptions () {
  return [
    {
      name: 'Include boilerplate',
      id: 'includeBoilerplate',
      type: 'boolean',
      default: false,
      description: 'Include class definition and import statements in snippet'
    },
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
      description: 'Set number of milliseconds the request should wait for a response ' +
        'before timing out (use 0 for infinity)'
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
    }
  ];
}

/**
 * Converts Postman sdk request object to java  code snippet
 *
 * @module convert
 *
 * @param {Object} request - postman-SDK request object
 * @param {Object} options - Options to tweak code snippet generated in Java-
 * @param {String} options.indentType - type for indentation eg: Space, Tab
 * @param {String} options.indentCount - number of spaces or tabs for indentation.
 * @param {Boolean} [options.includeBoilerplate] - indicates whether to include class definition in java
 * @param {Boolean} options.followRedirect - whether to enable followredirect
 * @param {Boolean} options.trimRequestBody - whether to trim fields in request body or not
 * @param {Number} options.requestTimeout : time in milli-seconds after which request will bail out
 * @param {Function} callback - callback function with parameters (error, snippet)
 */
function convert (request, options, callback) {

  if (_.isFunction(options)) {
    callback = options;
    options = {};
  }
  else if (!_.isFunction(callback)) {
    throw new Error('Java-Converter: callback is not valid function');
  }
  options = sanitizeOptions(options, getOptions());
  //  String representing value of indentation required
  var indentString,

    //  snippets to include java class definition according to options
    headerSnippet = '',
    footerSnippet = '',

    //  snippet to create request in java
    snippet = '';

  indentString = options.indentType === 'Tab' ? '\t' : ' ';
  indentString = indentString.repeat(options.indentCount);

  if (options.includeBoilerplate) {
    headerSnippet = 'import java.io.*;\n' +
                        'import javax.net.ssl.HttpsURLConnection;\n' +
                        'import java.net.*;\n' +
                        'import java.lang.reflect.*;\n' +
                        'import java.util.*;\n' +
                        'import java.util.function.BiConsumer;\n' +
                        'public class main {\n' +
                        indentString + 'public static void main(String []args) throws IOException{\n';
    footerSnippet += indentString + '\n}\n}\n';
  }

  snippet = makeSnippet(request, indentString, options);

  //  if boilerplate is included then two more indentString needs to be added in snippet
  (options.includeBoilerplate) &&
    (snippet = indentString.repeat(2) + snippet.split('\n').join('\n' + indentString.repeat(2)) + '\n');
  return callback(null, headerSnippet + snippet + footerSnippet);
}
module.exports = {
  convert: convert,
  getOptions: getOptions
};
