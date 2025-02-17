
var _ = require('./lodash'),
  sanitize = require('./util').sanitize;

/**
* parses body of request and returns urlencoded string
*
* @param {Object} requestBody - json object respresenting body of request
* @param {Boolean} trimFields - indicates whether to trim fields of body
* @returns {String} - urlencoded string for request body
*/
function parseUrlencode (requestBody, trimFields) {
//  reducing array of urlencoded form data to array of strings
  return _.reduce(requestBody[requestBody.mode], function (accumalator, data) {
    if (!data.disabled) {
      accumalator.push(`${sanitize(data.key, trimFields)}=${sanitize(data.value, trimFields)}`.replace(/&/g, '%26'));
    }
    return accumalator;
  }, []).join('&');
}

/**
* returns java  code snippet for adding file to  the request body
*
* @param {String} indentString - string for indentation
* @returns {String} - code snippet of java  for uploading file
*/
function generateFormFile (indentString) {

  return 'BiConsumer<String, String> uploadFileFunction = (String src, String key) -> {\n' +
    indentString + 'try {\n' +
    indentString.repeat(2) + 'File uploadFile = new File(src);\n' +
    indentString.repeat(2) + 'String fileName = uploadFile.getName();\n' +
    indentString.repeat(2) + 'String name = key!=null?key:fileName;\n' +
    indentString.repeat(2) + 'writer.append("--" + boundary).append(LINE_FEED)\n' +
    indentString.repeat(3) + '.append("Content-Disposition: form-data; name="+name+";filename="+fileName)\n' +
    indentString.repeat(3) + '.append(LINE_FEED)\n' +
    indentString.repeat(3) + '.append("Content-Type: "+ URLConnection.' +
    'guessContentTypeFromName(fileName)).append(LINE_FEED)\n' +
    indentString.repeat(3) + '.append("Content-Transfer-Encoding: binary")\n' +
    indentString.repeat(3) + '.append(LINE_FEED)\n' +
    indentString.repeat(3) + '.append(LINE_FEED);\n' +
    indentString.repeat(2) + 'writer.flush();\n' +
    indentString.repeat(2) + 'FileInputStream inputStream = new FileInputStream(uploadFile);\n' +
    indentString.repeat(2) + 'byte[] buffer = new byte[4096];\n' +
    indentString.repeat(2) + 'int bytesRead = -1;\n' +
    indentString.repeat(2) + 'while ((bytesRead = inputStream.read(buffer)) != -1) {\n' +
      indentString.repeat(3) + 'out.write(buffer, 0, bytesRead);\n' +
    indentString.repeat(2) + '}\n' +
    indentString.repeat(2) + 'out.flush();\n' +
    indentString.repeat(2) + 'inputStream.close();\n' +
    indentString.repeat(2) + 'writer.append(LINE_FEED).flush();\n' +
    indentString.repeat(2) + '} catch (IOException e) {\n' +
      indentString.repeat(3) + 'e.printStackTrace();\n' +
      indentString.repeat(2) + '}\n' +
    indentString + '};\n';

}

/**
* returns java  code snippet for adding form data to  the request body
*
* @param {String} indentString - string for indentation
* @returns {String} - code snippet of java  for uploading form data
*/
function generateFormField (indentString) {

  return 'BiConsumer<String,String> addFormField = (name, key) -> {\n' +
          indentString + 'writer.append("--" + boundary).append(LINE_FEED)\n' +
          indentString.repeat(2) + '.append("Content-Disposition: form-data; name="+name)\n' +
          indentString.repeat(2) + '.append(LINE_FEED)\n' +
          indentString.repeat(2) + '.append("Content-Type: text/plain; charset=UTF-8").append(LINE_FEED)\n' +
          indentString.repeat(2) + '.append(LINE_FEED)\n' +
          indentString.repeat(2) + '.append(key)\n' +
          indentString.repeat(2) + '.append(LINE_FEED);\n' +
          indentString + 'writer.flush();\n' +
          indentString + '};\n';

}

/**
* parses body of request and creates java code snippet for adding form data
*
* @param {Object} requestBody - JSON object representing body of request
* @param {String} indentString - string for indentation
* @param {Boolean} trimFields - indicates whether to trim fields of body
* @returns {String} - code snippet of java for multipart formdata
*/
function parseFormData (requestBody, indentString, trimFields) {
  var fileFunctionGenerated = false,
    formFunctionGenerated = false;
  return _.reduce(requestBody[requestBody.mode], function (body, data) {
    if (data.disabled) {
      return body;
    }
    if (data.type === 'file') {
      if (!fileFunctionGenerated) {
        body += generateFormFile(indentString);
        fileFunctionGenerated = true;
      }
      body += `uploadFileFunction.accept("${data.src}","${sanitize(data.key, trimFields)}");\n`;

    }
    else {
      if (!formFunctionGenerated) {
        body += generateFormField(indentString);
        formFunctionGenerated = true;
      }
      !data.value && (data.value = '');
      body += `addFormField.accept("${sanitize(data.key, trimFields)}","${sanitize(data.value, trimFields)}");\n`;

    }
    return body;
  }, '');
}


/**
* returns java  code snippet for adding file to  the request body
*
* @returns {String} - header java code snippet for form data
*/
function generateBoilerPlateHeader () {
  return 'PrintWriter writer = new PrintWriter(new OutputStreamWriter(out, "UTF-8"),true);\n' +
          'final String LINE_FEED = "\\r\\n";\n';
}

/**
* returns java  code snippet for adding file to  the request body
*
* @returns {String} - footer java code snippet for form data
*/
function generateBoilerPlateFooter () {
  return 'writer.append("--" + boundary + "--").append(LINE_FEED);\n' +
          'writer.close();\n' +
          'out.close();\n';
}


/**
* parses request object and returns java  code snippet for adding request body
*
* @param {Object} requestBody - JSON object representing body of request
* @param {String} indentString - string for indentation
* @param {Boolean} trimFields - indicates whether to trim fields of body
* @returns {String} - code snippet of java  parsed from request object
*/
function parseBody (requestBody, indentString, trimFields) {
  var snippet = 'con.setDoInput(true);\n' +
            'DataOutputStream out = new DataOutputStream(con.getOutputStream());\n';
  if (!_.isEmpty(requestBody)) {

    switch (requestBody.mode) {
      case 'urlencoded':
        snippet += `out.writeBytes("${parseUrlencode(requestBody, trimFields)}");\n` +
                  'out.flush();\n' +
                  'out.close();\n';
        return snippet;
      case 'raw':
        snippet += `out.writeBytes(${JSON.stringify(requestBody[requestBody.mode])});\n` +
                  'out.flush();\n' +
                  'out.close();\n';
        return snippet;
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
        snippet += `out.writeBytes("${sanitize(JSON.stringify({
          query: query,
          variables: graphqlVariables
        }), trimFields)}");\n`;
        snippet += 'out.flush();\n' +
                  'out.close();\n';
        return snippet;
      case 'formdata':
        snippet += requestBody.formdata.length ?
          generateBoilerPlateHeader() + parseFormData(requestBody, indentString, trimFields) +
          generateBoilerPlateFooter() :
          'out.writeBytes("{}");\n' +
                  'out.close();\n';
        return snippet;

      case 'file':
        snippet += generateBoilerPlateHeader();
        snippet += generateFormFile(indentString);
        snippet += `uploadFileFunction.accept("${requestBody.file.src}",null);\n`;
        snippet += generateBoilerPlateFooter();
        return snippet;
      default:
        snippet += 'out.writeBytes("");\n' +
                  'out.close();\n';
        return snippet;
    }
  }
  snippet += 'out.writeBytes("");\n' +
      'out.close();\n';

  return snippet;
}

/**
* Generate java reusable code snippet for adding headers to the request
*
* @param {String} indentString - string for indentation
* @returns {String} - reusable code snippet for adding headers in java
*/
function generateBoilderPlateForHeaders (indentString) {
  return 'Map<String, String> headers = new HashMap<>();\n' +
    'BiConsumer<String,String> headerMap = (key,value) -> {\n' +
    indentString + 'if(headers.get(key)!=null){\n' +
    indentString.repeat(2) + 'String val = headers.get(key);\n' +
    indentString.repeat(2) + 'val = val + ", "+ value;\n' +
    indentString.repeat(2) + 'headers.put(key, val);\n' +
    indentString + '}else{\n' +
    indentString.repeat(2) + 'headers.put(key,value) ;\n' +
    indentString + '}\n' +
    '};\n';
}

/**
* Parses header in Postman-SDK request and returns code snippet of java  for adding headers
*
* @param {Object} request - Postman SDK request object
* @param {String} indentString - string for indentation
* @returns {String} - code snippet for adding headers in java
*/
function parseHeader (request, indentString) {
  var headerArray = request.toJSON().header,
    headerSnippet = '';

  if (!_.isEmpty(headerArray)) {
    headerArray = _.reject(headerArray, 'disabled');
    if (!_.isEmpty(headerArray)) {
      headerSnippet += generateBoilderPlateForHeaders(indentString);
      headerSnippet += _.reduce(headerArray, function (accumalator, header) {
        accumalator += `headerMap.accept("${sanitize(header.key, true)}", ` +
      `"${sanitize(header.value)}");\n`;
        return accumalator;
      }, '');
      headerSnippet += 'for (Map.Entry<String, String> entry : headers.entrySet()) {\n' +
        indentString + 'con.setRequestProperty(entry.getKey(), entry.getValue());\n' +
        '}';
    }
  }
  return headerSnippet;
}


module.exports = {
  parseBody: parseBody,
  parseHeader: parseHeader
};
