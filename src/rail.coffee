# Rail v0.1.0
# by schornio

urlUtility = require('url')
queryStringUtility = require('querystring')
mustache = require('mu2')

constants =
	statusCode:
		success: 200
		redirect: 302
		notFound: 404
		internalError: 500
	maxUploadSize: 1e7 #10 MB

#--- Routing and request handling ---

routingTable = {}

createRoute = (route, method) ->
	middlewareCallstack = []
	addRoute.call({ middlewareCallstack: middlewareCallstack, routingTable: routingTable }, route, method)

createMiddleware = (middleware) ->
	middlewareCallstack = []
	return addMiddleware.call({ middlewareCallstack: middlewareCallstack, routingTable: routingTable }, middleware)

addRoute = (route, method) ->
	this.middlewareCallstack.push(method)
	this.routingTable[route] = this.middlewareCallstack

addMiddleware = (middleware) ->
	middlewareCallstack = this.middlewareCallstack

	if not middlewareCallstack
		middlewareCallstack = []

	this.middlewareCallstack.push(middleware)

	middlewareCallParameters = { middlewareCallstack: this.middlewareCallstack, routingTable: this.routingTable }
	middlewareCallParameters.middleware = addMiddleware.bind(middlewareCallParameters)
	middlewareCallParameters.route = addRoute.bind(middlewareCallParameters)

	return middlewareCallParameters


handleRequest = (request, response) ->
	urlFragments = urlUtility.parse(request.url, true)

	for route, routeParameters of routingTable
		if urlFragments.pathname.match(route)

			callParameters =
				request: request
				response: response

			callParameters.header =
					query: urlFragments.query #HTTP GET
					cookie: parseCookieString(request.headers.cookie)
					getBody: getPostData.bind(callParameters) #HTTP POST
				
			callParameters.setCookie = setCookie.bind(callParameters)

			callParameters.method =
				view: view.bind(callParameters)
				redirect: redirect.bind(callParameters)
				content: content.bind(callParameters)
				json: json.bind(callParameters)

			executeMiddleware = () ->
				nextCall = this.middlewareCallstack[this.middlewareCallstackIndex]
				this.middlewareCallstackIndex++;
				nextCall = nextCall.bind(this.callParameters, executeMiddleware.bind(this))
				process.nextTick(nextCall)

			executeMiddleware.call({ middlewareCallstack: routeParameters, middlewareCallstackIndex: 0, callParameters: callParameters })
			break

#--- Utility ---

setCookie = (name, value, exdays, domain, path) ->
	cookies = this.response.getHeader('Set-Cookie')
	if typeof cookies isnt 'object'
		cookies = []

	exdate = new Date()
	exdate.setDate(exdate.getDate() + exdays);
	cookieText = name+'='+value+';expires='+exdate.toUTCString()+';'
	if domain
		cookieText += 'domain='+domain+';'
	if path
		cookieText += 'path='+path+';'

	cookies.push(cookieText)
	this.response.setHeader('Set-Cookie', cookies)

parseCookieString = (cookieString) ->
	if cookieString
		cookies = {}
		cookieString.split(';').forEach((cookie) ->
			parts = cookie.split('=')
			cookies[parts[0].trim()] = parts[1].trim() || ''
		)

		return cookies

getPostData = (callback) ->
	fullData = ''

	this.request.on('data', (data) ->
		fullData += data

		if fullData.length > constants.maxUploadSize
			this.request.removeAllListeners('data')
			this.request.removeAllListeners('end')
			callback({ code: 413, message: '413 Request entity too large', maxUploadSize: constants.maxUploadSize })
	)

	this.request.on('end', () ->
		postData = queryStringUtility.parse(fullData)
		callback(undefined, postData)
	)

#--- Methods ---

view = (viewPath, model, statusCode = constants.statusCode.success) ->
	this.response.writeHead(statusCode, { 'Content-Type': 'text/html' })
	fileStream = mustache.compileAndRender(viewPath, model)
	fileStream.pipe(this.response)

redirect = (path) ->
	this.response.writeHead(constants.statusCode.redirect, { 'Location': path })
	this.response.end()

content = (fileStream, contentType) ->
	this.response.writeHead(constants.statusCode.success, { 'Content-Type': contentType })
	fileStream.pipe(this.response)

json = (model) ->
	this.response.writeHead(constants.statusCode.success, {'Content-Type': 'application/json' })
	this.response.write(if model then JSON.stringify(model) else '')
	this.response.end()

#--- Error handler ---

Function::error = (errorHandler) ->
	baseFunction = () ->
		if arguments and arguments[0]
			this.errorHandler(arguments)
		else
			functionArguments = Array::slice.call(arguments, 1)
			this.function.apply(null, functionArguments)
	return baseFunction.bind({ function: this, errorHandler: errorHandler })


#--- Initialisation ---

module.exports = (server) ->
	server.on('request', handleRequest)
	return { route: createRoute, middleware: createMiddleware, constants: constants }
