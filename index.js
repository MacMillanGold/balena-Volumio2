var expressInstance = require('./http/index.js');
var expressApp = expressInstance.app;
// Using port 3000 for the debug interface
expressApp.set('port', process.env.PORT || 80);

var httpServer = expressApp.listen(expressApp.get('port'), function() {
	console.log('Express server listening on port ' + httpServer.address().port);
});

var commandRouter = new (require('./app/index.js'))(httpServer);
