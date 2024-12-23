var _ = require('./lodash'),
  sanitizeOptions = require('./util').sanitizeOptions,
  sanitize = require('./util').sanitize,
  addFormParam = require('./util').addFormParam,
  sdk = require('postman-collection'),
  self;

/**
 * Parses Url encoded data
 *
 * @param {Object} body body data
 * @param {String} indent indentation required for code snippet
 * @param {Boolean} trim indicates whether to trim string or not
 */
function parseUrlEncoded (body, indent, trim) {
  var bodySnippet = 'val body = mapOf(',
    enabledBodyList = _.reject(body, 'disabled'),
    bodyDataMap;
  if (!_.isEmpty(enabledBodyList)) {
    bodyDataMap = _.map(enabledBodyList, function (value) {
      return `${indent}"${sanitize(value.key, trim)}" to "${sanitize(value.value, trim)}"`;
    });
    bodySnippet += '\n' + bodyDataMap.join(',\n') + '\n';
  }
  bodySnippet += ')';
  return bodySnippet;
}

/**
 * Parses Raw data
 *
 * @param {Object} body Raw body data
 * @param {Boolean} trim indicates whether to trim string or not
 */
function parseRawBody (body, trim) {
  return `val body = """${sanitize(body, trim)}"""`;
}

/**
 * Parses GraphQL body
 *
 * @param {Object} body GraphQL body
 * @param {String} indent indentation required for code snippet
 */
function parseGraphQLBody (body, indent) {
  var snippet = '',
    query = body.query,
    graphqlVariables;
  try {
    graphqlVariables = JSON.parse(body.variables);
  }
  catch (e) {
    graphqlVariables = {};
  }

  snippet += 'class GraphqlQuery() {\n';
  snippet += `${indent}val query = "${sanitize(query)}"\n`;
  snippet += `${indent}val variables = "${sanitize(JSON.stringify(graphqlVariables))}"\n`;

  snippet += '}\n\n';

  return snippet;
}

/**
 * Parses form data body from request
 *
 * @param {Object} body form data Body
 * @param {String} indent indentation required for code snippet
 * @param {Boolean} trim indicates whether to trim string or not
 */
function parseFormData (body, indent, trim) {
  let bodySnippet = '',
    formDataArray = [],
    bodyDataArray = [],
    formDataFileArray = [],
    key,
    value;

  if (_.isEmpty(body)) {
    return bodySnippet;
  }

  formDataArray.push('val body = HashMap<String, RequestBody>()');

  _.forEach(body, function (data, index) {
    key = trim ? data.key.trim() : data.key;
    value = trim ? data.value.trim() : data.value;
    if (!data.disabled) {
      let trimKey = `${key.replace(/\s+/g, '')}${index}`;
      if (data.type === 'file') {
        formDataFileArray.push(`val ${sanitize(trimKey)} = ` +
          `RequestBody.create(MediaType.parse("multipart/form-data"), "${data.src}");`);
      }
      else {
        formDataArray.push(`val ${sanitize(trimKey)} =` +
          ` RequestBody.create(MediaType.parse("text/plain"), "${sanitize(value, trim)}")`);
      }

      bodyDataArray.push(`body.put("${sanitize(key.trim())}", ${sanitize(trimKey)})`);
    }
  });

  if (formDataArray.length > 0) {
    bodySnippet += formDataArray.join('\n');
    bodySnippet += '\n\n';
  }

  if (formDataFileArray.length > 0) {
    bodySnippet += formDataFileArray.join('\n');
    bodySnippet += '\n\n';
  }

  if (bodyDataArray.length > 0) {
    bodySnippet += bodyDataArray.join('\n');
    bodySnippet += '\n';
  }

  return bodySnippet;
}

/**
 * Parses Body from the Request
 *
 * @param {Object} body body object from request.
 * @param {String} indent indentation required for code snippet
 * @param {trim} trim indicates whether to trim string or not
 */
function parseBody (body, indent, trim) {
  if (!_.isEmpty(body)) {
    switch (body.mode) {
      case 'urlencoded':
        return parseUrlEncoded(body.urlencoded, indent, trim);
      case 'raw':
        return parseRawBody(body.raw, trim);
      case 'formdata':
        return parseFormData(body.formdata, indent, trim);
      case 'file':
        return 'request.body = r\'<file contents here>\';\n';
      default:
        return '';
    }
  }
  return '';
}

/**
 * Parses headers from the request.
 *
 * @param {Object} headersArray array containing headers
 * @param {String} indent indentation required for code snippet
 * @param {Boolean} trim indicates whether to trim string or not
 */
function parseHeaders (headersArray, indent, trim) {
  var headerString = '',
    headerDictionary = [];
  if (_.isEmpty(headersArray)) {
    return headerString;
  }

  headerString += 'val headers = mapOf(\n';

  _.forEach(headersArray, function (header) {
    if (!header.disabled) {
      headerDictionary.push(indent + '"' + sanitize(header.key) + '" to "' + sanitize(header.value, trim) + '"');
    }
  });

  headerString += headerDictionary.join(',\n');
  headerString += '\n)\n';

  return headerString;
}

/**
 * Generate arguments for interface method
 *
 * @param {Array} variables in route path
 */
function getInterfaceMethodParams (variables) {
  var variablesArray = [];
  if (!variables || variables.members.length === 0) {
    return '';
  }

  variables.members.forEach((variable) => {
    variablesArray.push(`@Path("${variable.key}") ${variable.key}: ${_.capitalize(variable.type)}`);
  });

  return variablesArray.join(', ');
}

/**
 * Parse interface method based on http method and web service path
 *
 * @param {String} httpMethod of web service request
 * @param {String} path of web service request
 */
function getInterfaceFunctionName (httpMethod, path) {
  if (!Array.isArray(path)) {
    return `${httpMethod.toLowerCase()}`;
  }
  const route = path.slice(-1).toString().replace(':', '');

  return `${httpMethod.toLowerCase()}${_.capitalize(route)}`;
}

/**
 * Get service name for interface name based one domain name.
 *
 * @param {String} domainName of web service request
 */
function getServiceInterfaceName (domainName) {
  const serviceArray = [];

  domainName.split('-').forEach((service) => {
    serviceArray.push(_.capitalize(service));
  });

  return `${serviceArray.join('')}Service`;
}

/**
 * Generate retrofit client factory for configure timeout and follow redirect
 *
 * @param {String} timeout web service request
 * @param {String} followRedirect of web service request
 * @param {String} indent indentation required for code snippet
 */
function generateRetrofitClientFactory (timeout, followRedirect, indent) {
  var timeoutFactoryString = 'val okHttpClient = OkHttpClient().newBuilder()\n';

  if (timeout === 0 && followRedirect) {
    return '';
  }

  if (timeout > 0) {
    timeoutFactoryString += `${indent}.connectTimeout(${timeout}, TimeUnit.MILLISECONDS)\n`;
    timeoutFactoryString += `${indent}.readTimeout(${timeout}, TimeUnit.MILLISECONDS)\n`;
    timeoutFactoryString += `${indent}.writeTimeout(${timeout}, TimeUnit.MILLISECONDS)\n`;
  }

  if (!followRedirect) {
    timeoutFactoryString += `${indent}.followRedirects(false)\n`;
    timeoutFactoryString += `${indent}.followSslRedirects(false)\n`;
  }

  timeoutFactoryString += `${indent}.build()\n\n`;

  return timeoutFactoryString;
}

/**
 * Change url parameter from :something to {something} based on retrofit2 documentation
 *
 * @param {Array} paths in web service url
 */
function changeUrlParamToTemplate (paths) {
  const pathArray = [];
  if (!paths) {
    return pathArray;
  }

  paths.forEach((p) => {
    if (p.startsWith(':')) {
      pathArray.push(`{${p.replace(':', '')}}`);
    }
    else {
      pathArray.push(p);
    }
  });

  return pathArray;
}

/**
 * Parses headers from the request.
 *
 * @param {String} name of web service request
 * @param {String} method of web service request
 * @param {String} path of web service request
 * @param {String} variables in path
 * @param {boolean} hasHeader in web service request
 * @param {boolean} hasBody in web service request
 * @param {String} bodyType of web service request
 * @param {String} indent indentation required for code snippet
 */
function generateInterface (name, method, path, variables,
  hasHeader, hasBody, bodyType, indent) {
  var interfaceString = '@JvmSuppressWildcards\n';
  const pathTemplate = changeUrlParamToTemplate(path),
    functionArguments = [];


  interfaceString += `interface ${getServiceInterfaceName(name)} {\n`;
  if (bodyType === 'formdata') {
    interfaceString += `${indent}@Multipart\n`;
  }
  interfaceString += `${indent}@${method.toUpperCase()}("${pathTemplate}")\n`;
  interfaceString += `${indent}fun `;
  interfaceString += `${getInterfaceFunctionName(method, path)}(`;

  let paramString = getInterfaceMethodParams(variables);
  if (hasHeader) {
    functionArguments.push('@HeaderMap headers: Map<String, String>');
  }

  if (bodyType === 'formdata') {
    functionArguments.push('@PartMap body: Map<String, RequestBody>');
  }
  else if (bodyType === 'raw') {
    functionArguments.push('@Body body: String');
  }
  else if (bodyType === 'graphql') {
    functionArguments.push('@Body body: GraphqlQuery');
  }
  else if (hasBody) {
    functionArguments.push('@Body body: Map<String, Any>');
  }

  if (paramString !== '') {
    functionArguments.push(paramString);
  }

  interfaceString += `${functionArguments.join(', ')}): Call<Any>`;
  interfaceString += '\n}\n';

  return interfaceString;
}

self = module.exports = {
  convert: function (request, options, callback) {
    var indent,
      codeSnippet = '',
      headerSnippet = '',
      footerSnippet = '',
      trim,
      timeout,
      followRedirect,
      bodyType,
      serviceCallParamsArray = [];
    options = sanitizeOptions(options, self.getOptions());
    if (options.includeBoilerplate) {
      headerSnippet = 'import retrofit2.Call\n';
      headerSnippet += 'import retrofit2.http.*\n';
      headerSnippet += 'import retrofit2.Callback\n';
      headerSnippet += 'import retrofit2.Response\n';
      headerSnippet += 'import retrofit2.Retrofit\n';
      headerSnippet += 'import retrofit2.converter.gson.GsonConverterFactory\n\n';
      headerSnippet += 'fun main() {\n';

      footerSnippet = '}\n\n';
    }
    trim = options.trimRequestBody;
    indent = options.indentType === 'Tab' ? '\t' : ' ';
    indent = indent.repeat(options.indentCount);
    timeout = options.requestTimeout;
    followRedirect = options.followRedirect;

    if (!_.isFunction(callback)) {
      throw new Error('Callback is not valid function');
    }

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

    const headers = parseHeaders(request.headers.toJSON(), indent, trim),
      requestBody = request.body ? request.body.toJSON() : {},
      body = parseBody(requestBody, indent, trim);

    codeSnippet += headers;
    codeSnippet += body;

    if (requestBody) {
      bodyType = requestBody.mode;
    }

    codeSnippet += `\n${generateRetrofitClientFactory(timeout, followRedirect, indent)}`;

    codeSnippet += 'val retrofit = Retrofit.Builder()\n';

    let url = sdk.Url.parse(request.url.toString()),
      baseUrl = url.host ? url.host.join('.') : '',
      serviceName = request.url.host.slice(-2)[0];
    baseUrl += url.port ? ':' + url.port : '';


    codeSnippet += `${indent}.baseUrl("${url.protocol}://${baseUrl}")\n`;
    codeSnippet += `${indent}.addConverterFactory(GsonConverterFactory.create())\n`;

    if (requestBody.mode === 'graphql') {
      footerSnippet += parseGraphQLBody(requestBody.graphql, indent);
    }

    if (timeout > 0 || !followRedirect) {
      codeSnippet += `${indent}.client(okHttpClient)\n`;
    }

    codeSnippet += `${indent}.build()\n\n`;

    footerSnippet += generateInterface(
      serviceName,
      request.method,
      request.url.path,
      request.url.variables,
      headers !== '',
      body !== '',
      bodyType,
      indent
    );

    codeSnippet += `val service = retrofit.create(${getServiceInterfaceName(serviceName)}::class.java)\n`;
    codeSnippet += `val serviceCall = service.${getInterfaceFunctionName(request.method, request.url.path)}(`;

    if (headers !== '') {
      serviceCallParamsArray.push('headers');
    }
    if (body !== '') {
      serviceCallParamsArray.push('body');
    }

    if (requestBody && requestBody.mode === 'graphql') {
      serviceCallParamsArray.push('GraphqlQuery()');
    }

    if (request.url.variables && request.url.variables.members.length > 0) {
      request.url.variables.members.forEach((variable) => {
        if (['any', 'text', 'string'].includes(variable.type.toLowerCase())) {
          serviceCallParamsArray.push(`"${sanitize(variable.value)}"`);
        }
        else {
          serviceCallParamsArray.push(`${variable.value}`);
        }
      });
    }

    codeSnippet += serviceCallParamsArray.join(', ');
    codeSnippet += ')\n\n';

    codeSnippet += 'serviceCall.enqueue(object : Callback<Any> {\n';
    codeSnippet += `${indent}override fun onResponse(call: Call<Any>, response: Response<Any>) {\n`;
    codeSnippet += `${indent}${indent}println("Request success with response: \${response.body()}")\n`;
    codeSnippet += `${indent}}\n\n`;

    codeSnippet += `${indent}override fun onFailure(call: Call<Any>, t: Throwable) {\n`;
    codeSnippet += `${indent}${indent}println("Request has been failed for \${t.message} reason. $t")\n`;
    codeSnippet += `${indent}}\n`;

    codeSnippet += '})\n';

    //  if boilerplate is included then two more indent needs to be added in snippet
    (options.includeBoilerplate) &&
    (codeSnippet = indent + codeSnippet.split('\n').join('\n' + indent) + '\n');

    callback(null, headerSnippet + codeSnippet + footerSnippet);
  },
  getOptions: function () {
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
        name: 'Trim request body fields',
        id: 'trimRequestBody',
        type: 'boolean',
        default: false,
        description: 'Remove white space and additional lines that may affect the server\'s response'
      },
      {
        name: 'Include boilerplate',
        id: 'includeBoilerplate',
        type: 'boolean',
        default: false,
        description: 'Include class definition and import statements in snippet'
      },
      {
        name: 'Follow redirects',
        id: 'followRedirect',
        type: 'boolean',
        default: true,
        description: 'Automatically follow HTTP redirects'
      }
    ];
  }
};
