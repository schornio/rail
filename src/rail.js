// Generated by CoffeeScript 1.6.2
(function() {
  var addMiddleware, addRoute, constants, content, createMiddleware, createRoute, getPostData, handleRequest, json, mustache, parseCookieString, queryStringUtility, redirect, routingTable, setCookie, urlUtility, view;

  urlUtility = require('url');

  queryStringUtility = require('querystring');

  mustache = require('mu2');
  //mustache.root = __dirname + '/view';
  mustache.clearCache();

  constants = {
    statusCode: {
      success: 200,
      redirect: 302,
      notFound: 404,
      internalError: 500
    },
    maxUploadSize: 1e7
  };

  routingTable = {};

  createRoute = function(route, method) {
    var middlewareCallstack;

    middlewareCallstack = [];
    return addRoute.call({
      middlewareCallstack: middlewareCallstack,
      routingTable: routingTable
    }, route, method);
  };

  createMiddleware = function(middleware) {
    var middlewareCallstack;

    middlewareCallstack = [];
    return addMiddleware.call({
      middlewareCallstack: middlewareCallstack,
      routingTable: routingTable
    }, middleware);
  };

  addRoute = function(route, method) {
    this.middlewareCallstack.push(method);
    return this.routingTable[route] = this.middlewareCallstack;
  };

  addMiddleware = function(middleware) {
    var middlewareCallParameters, middlewareCallstack;

    middlewareCallstack = this.middlewareCallstack;
    if (!middlewareCallstack) {
      middlewareCallstack = [];
    }
    this.middlewareCallstack.push(middleware);
    middlewareCallParameters = {
      middlewareCallstack: this.middlewareCallstack,
      routingTable: this.routingTable
    };
    middlewareCallParameters.middleware = addMiddleware.bind(middlewareCallParameters);
    middlewareCallParameters.route = addRoute.bind(middlewareCallParameters);
    return middlewareCallParameters;
  };

  handleRequest = function(request, response) {
    var callParameters, executeMiddleware, route, routeParameters, urlFragments, _results;

    urlFragments = urlUtility.parse(request.url, true);
    _results = [];
    for (route in routingTable) {
      routeParameters = routingTable[route];
      if (urlFragments.pathname.match(route)) {
        callParameters = {
          request: request,
          response: response
        };
        callParameters.header = {
          query: urlFragments.query,
          cookie: parseCookieString(request.headers.cookie),
          getBody: getPostData.bind(callParameters)
        };
        callParameters.setCookie = setCookie.bind(callParameters);
        callParameters.method = {
          view: view.bind(callParameters),
          redirect: redirect.bind(callParameters),
          content: content.bind(callParameters),
          json: json.bind(callParameters)
        };
        executeMiddleware = function() {
          var nextCall;

          nextCall = this.middlewareCallstack[this.middlewareCallstackIndex];
          this.middlewareCallstackIndex++;
          nextCall = nextCall.bind(this.callParameters, executeMiddleware.bind(this));
          return process.nextTick(nextCall);
        };
        executeMiddleware.call({
          middlewareCallstack: routeParameters,
          middlewareCallstackIndex: 0,
          callParameters: callParameters
        });
        break;
      } else {
        _results.push(void 0);
      }
    }
    return _results;
  };

  setCookie = function(name, value, exdays, domain, path) {
    var cookieText, cookies, exdate;

    cookies = this.response.getHeader('Set-Cookie');
    if (typeof cookies !== 'object') {
      cookies = [];
    }
    exdate = new Date();
    exdate.setDate(exdate.getDate() + exdays);
    cookieText = name + '=' + value + ';expires=' + exdate.toUTCString() + ';';
    if (domain) {
      cookieText += 'domain=' + domain + ';';
    }
    if (path) {
      cookieText += 'path=' + path + ';';
    }
    cookies.push(cookieText);
    return this.response.setHeader('Set-Cookie', cookies);
  };

  parseCookieString = function(cookieString) {
    var cookies;

    if (cookieString) {
      cookies = {};
      cookieString.split(';').forEach(function(cookie) {
        var parts;

        parts = cookie.split('=');
        return cookies[parts[0].trim()] = parts[1].trim() || '';
      });
      return cookies;
    }
  };

  getPostData = function(callback) {
    var fullData;

    fullData = '';
    this.request.on('data', function(data) {
      fullData += data;
      if (fullData.length > constants.maxUploadSize) {
        this.request.removeAllListeners('data');
        this.request.removeAllListeners('end');
        return callback({
          code: 413,
          message: '413 Request entity too large',
          maxUploadSize: constants.maxUploadSize
        });
      }
    });
    return this.request.on('end', function() {
      var postData;

      postData = queryStringUtility.parse(fullData);
      return callback(void 0, postData);
    });
  };

  view = function(viewPath, model, statusCode) {
    var fileStream;

    if (statusCode == null) {
      statusCode = constants.statusCode.success;
    }
    this.response.writeHead(statusCode, {
      'Content-Type': 'text/html'
    });
    fileStream = mustache.compileAndRender(viewPath, model);
    return fileStream.pipe(this.response);
  };

  redirect = function(path) {
    this.response.writeHead(constants.statusCode.redirect, {
      'Location': path
    });
    return this.response.end();
  };

  content = function(fileStream, contentType) {
    this.response.writeHead(constants.statusCode.success, {
      'Content-Type': contentType
    });
    return fileStream.pipe(this.response);
  };

  json = function(model) {
    this.response.writeHead(constants.statusCode.success, {
      'Content-Type': 'application/json'
    });
    this.response.write(model ? JSON.stringify(model) : '');
    return this.response.end();
  };

  Function.prototype.error = function(errorHandler) {
    var baseFunction;

    baseFunction = function() {
      var functionArguments;

      if (arguments && arguments[0]) {
        return this.errorHandler(arguments);
      } else {
        functionArguments = Array.prototype.slice.call(arguments, 1);
        return this["function"].apply(null, functionArguments);
      }
    };
    return baseFunction.bind({
      "function": this,
      errorHandler: errorHandler
    });
  };

  module.exports = function(server) {
    var db;

    server.on('request', handleRequest);
    db = require('./rail-db.js');
    return {
      route: createRoute,
      middleware: createMiddleware,
      db: db,
      constants: constants
    };
  };

}).call(this);