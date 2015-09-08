var libQ = require('kew');
var libFast = require('fast.js');
var fs=require('fs-extra');
/** Define the InterfaceWebUI class (Used by DEV UI)
 *
 * @type {InterfaceWebUI}
 */
module.exports = InterfaceWebUI;
function InterfaceWebUI (context) {
	var self = this;

	self.context=context;
	self.commandRouter = self.context.coreCommand;

	/** Init SocketIO listener */
	self.libSocketIO = require('socket.io')(self.context.websocketServer);

	/** On Client Connection, listen for various types of clients requests */
	self.libSocketIO.on('connection', function (connWebSocket) {
		/** Request Volumio State
		 * It returns an array definining the Playback state, Volume and other amenities
		 * @example {"status":"stop","position":0,"dynamictitle":null,"seek":0,"duration":0,"samplerate":null,"bitdepth":null,"channels":null,"volume":82,"mute":false,"service":null}
		 *
		 * where
		 * @status is the status of the player
		 * @position is the position in the play queue of current playing track (if any)
		 * @dynamictitle is the title
		 * @seek is track's current elapsed play time
		 * @duration track's duration
		 * @samplerate current samplerate
		 * @bitdepth bitdepth
		 * @channels mono or stereo
		 * @volume current Volume
		 * @mute if true, Volumio is muted
		 * @service current playback service (mpd, spop...)
		 */
		connWebSocket.on('getState', function () {
			selfConnWebSocket = this;

			var timeStart = Date.now();
			self.logStart('Client requests Volumio state')
				.then(libFast.bind(self.commandRouter.volumioGetState, self.commandRouter))
				.then(function (state) {
					return self.pushState.call(self, state, selfConnWebSocket);
				})
				.fail(libFast.bind(self.pushError, self))
				.done(function () {
					return self.logDone(timeStart);
				});
		});

		connWebSocket.on('getQueue', function () {
			selfConnWebSocket = this;

			var timeStart = Date.now();
			self.logStart('Client requests Volumio queue')
				.then(libFast.bind(self.commandRouter.volumioGetQueue, self.commandRouter))
				.then(function (queue) {
					return self.pushQueue.call(self, queue, selfConnWebSocket);
				})
				.fail(libFast.bind(self.pushError, self))
				.done(function () {
					return self.logDone(timeStart);
				});
		});

		connWebSocket.on('removeItemFromQueue', function (nIndex) {
			selfConnWebSocket = this;

			var timeStart = Date.now();
			self.logStart('Client requests remove Volumio queue item')
				.then(function () {
					return self.commandRouter.volumioRemoveItemFromQueue.call(self.commandRouter, nIndex);
				})
				.fail(libFast.bind(self.pushError, self))
				.done(function () {
					return self.logDone(timeStart);
				});
		});

		connWebSocket.on('addLibraryUidsToQueue', function (arrayUids) {
			selfConnWebSocket = this;

			var timeStart = Date.now();
			self.logStart('Client requests add Volumio library items to queue')
				.then(function () {
					return self.commandRouter.volumioAddLibraryUidsToQueue.call(self.commandRouter, arrayUids);
				})
				.fail(libFast.bind(self.pushError, self))
				.done(function () {
					return self.logDone(timeStart);
				});
		});

		connWebSocket.on('getLibraryListing', function (objParams) {
			selfConnWebSocket = this;

			var timeStart = Date.now();
			self.logStart('Client requests get library listing')
				.then(function () {
					return self.commandRouter.volumioGetLibraryListing.call(self.commandRouter, objParams.uid, objParams.options);
				})
				.then(function (objBrowseData) {
					if (objBrowseData) {
						return self.pushLibraryListing.call(self, objBrowseData, selfConnWebSocket);
					}
				})
				.fail(libFast.bind(self.pushError, self))
				.done(function () {
					return self.logDone(timeStart);
				});
		});

		connWebSocket.on('getLibraryFilters', function (sUid) {
			selfConnWebSocket = this;

			var timeStart = Date.now();
			self.logStart('Client requests get library index')
				.then(function () {
					return self.commandRouter.volumioGetLibraryFilters.call(self.commandRouter, sUid);
				})
				.then(function (objBrowseData) {
					if (objBrowseData) {
						return self.pushLibraryFilters.call(self, objBrowseData, selfConnWebSocket);
					}
				})
				.fail(libFast.bind(self.pushError, self))
				.done(function () {
					return self.logDone(timeStart);
				});
		});

		connWebSocket.on('getPlaylistIndex', function (sUid) {
			selfConnWebSocket = this;

			var timeStart = Date.now();
			self.logStart('Client requests get playlist index')
				.then(function () {
					return self.commandRouter.volumioGetPlaylistListing.call(self.commandRouter, sUid);
				})
				.then(function (objBrowseData) {
					if (objBrowseData) {
						return self.pushPlaylistListing.call(self, objBrowseData, selfConnWebSocket);
					}
				})
				.fail(libFast.bind(self.pushError, self))
				.done(function () {
					return self.logDone(timeStart);
				});
		});

		connWebSocket.on('play', function () {
			var timeStart = Date.now();
			self.logStart('Client requests Volumio play')
				.then(libFast.bind(self.commandRouter.volumioPlay, self.commandRouter))
				.fail(libFast.bind(self.pushError, self))
				.done(function () {
					return self.logDone(timeStart);
				});
		});

		connWebSocket.on('pause', function () {
			var timeStart = Date.now();
			self.logStart('Client requests Volumio pause')
				.then(libFast.bind(self.commandRouter.volumioPause, self.commandRouter))
				.fail(libFast.bind(self.pushError, self))
				.done(function () {
					return self.logDone(timeStart);
				});
		});

		connWebSocket.on('stop', function () {
			var timeStart = Date.now();
			self.logStart('Client requests Volumio stop')
				.then(libFast.bind(self.commandRouter.volumioStop, self.commandRouter))
				.fail(libFast.bind(self.pushError, self))
				.done(function () {
					return self.logDone(timeStart);
				});
		});

		connWebSocket.on('previous', function () {
			var timeStart = Date.now();
			self.logStart('Client requests Volumio previous')
				.then(libFast.bind(self.commandRouter.volumioPrevious, self.commandRouter))
				.fail(libFast.bind(self.pushError, self))
				.done(function () {
					return self.logDone(timeStart);
				});
		});

		connWebSocket.on('next', function () {
			var timeStart = Date.now();
			self.logStart('Client requests Volumio next')
				.then(libFast.bind(self.commandRouter.volumioNext, self.commandRouter))
				.fail(libFast.bind(self.pushError, self))
				.done(function () {
					return self.logDone(timeStart);
				});
		});

		connWebSocket.on('serviceUpdateTracklist', function (sService) {
			var timeStart = Date.now();
			self.logStart('Client requests Update Tracklist')
				.then(function() {
					self.commandRouter.serviceUpdateTracklist.call(self.commandRouter, sService);
				})
				.fail(libFast.bind(self.pushError, self))
				.done(function () {
					return self.logDone(timeStart);
				});
		});

		connWebSocket.on('rebuildLibrary', function () {
			var timeStart = Date.now();
			self.logStart('Client requests Volumio Rebuild Library')
				.then(libFast.bind(self.commandRouter.volumioRebuildLibrary, self.commandRouter))
				.fail(libFast.bind(self.pushError, self))
				.done(function () {
					return self.logDone(timeStart);
				});
		});

		connWebSocket.on('updateAllMetadata', function () {
			var timeStart = Date.now();
			self.logStart('Client requests update metadata cache')
				.then(libFast.bind(self.commandRouter.updateAllMetadata, self.commandRouter))
				.fail(libFast.bind(self.pushError, self))
				.done(function () {
					return self.logDone(timeStart);
				});
		});

		connWebSocket.on('volume', function (VolumeInteger) {
			selfConnWebSocket = this;

			var timeStart = Date.now();
			self.logStart('Client requests Volume ' + VolumeInteger)
				.then(function () {
					return self.commandRouter.volumiosetvolume.call(self.commandRouter, VolumeInteger);
				})
				.fail(libFast.bind(self.pushError, self))
				.done(function () {
					return self.logDone(timeStart);
				});
		});

		connWebSocket.on('importServicePlaylists', function () {
			var timeStart = Date.now();
			self.logStart('Client requests import of playlists')
				.then(libFast.bind(self.commandRouter.volumioImportServicePlaylists, self.commandRouter))
				.fail(libFast.bind(self.pushError, self))
				.done(function () {
					return self.logDone(timeStart);
				});
		});

		connWebSocket.on('addLibraryUidsToPlaylist', function (arrayUids, sPlaylistUid) {
			var timeStart = Date.now();
			self.logStart('Client adds items to playlist')
				.then(function() {
					self.commandRouter.volumioAddLibraryUidsToPlaylist.call(self.commandRouter, arrayUids, sPlaylistUid)
				})
				.fail(libFast.bind(self.pushError, self))
				.done(function () {
					return self.logDone(timeStart);
				});
		});

		connWebSocket.on('removeItemsFromPlaylist', function (arrayItems, sPlaylistUid) {
			var timeStart = Date.now();
			self.logStart('Client removes item from playlist')
				.then(libFast.bind(self.commandRouter.volumioRemovePlaylistItems, self.commandRouter))
				.fail(libFast.bind(self.pushError, self))
				.done(function () {
					return self.logDone(timeStart);
				});
		});

		connWebSocket.on('getMenuItems', function () {
			selfConnWebSocket = this;

			var timeStart = Date.now();
			self.logStart('Client requests Menu Items')
				.then(function () {
					var menuitems =fs.readJsonSync(__dirname+'/../../../config.json');

					console.log(JSON.stringify(menuitems['menuItems']));

					self.libSocketIO.emit('printConsoleMessage', menuitems['menuItems']);
					return self.libSocketIO.emit('pushMenuItems', menuitems['menuItems']);
				})
				.fail(libFast.bind(self.pushError, self))
				.done(function () {
					return self.logDone(timeStart);
				});
		});

		connWebSocket.on('callMethod', function(dataJson) {
			selfConnWebSocket = this;

			var promise;

			var category=dataJson.endpoint.substring(0,dataJson.endpoint.indexOf('/'));
			var name=dataJson.endpoint.substring(dataJson.endpoint.indexOf('/')+1);
			promise=self.commandRouter.executeOnPlugin(category,name,dataJson.method,dataJson.data);

			promise.then(function(result)
			{
				connWebSocket.emit("pushMethod",result);
			})
			.fail(function()
			{
				connWebSocket.emit("pushMethod",{"ERRORE":"MESSAGGIO DI ERRRORE"});
			});
		});

		connWebSocket.on('getUiConfig', function(data) {
			selfConnWebSocket = this;

			var splitted=data.page.split('/');

			var response;

			if(splitted.length>1)
				response=self.commandRouter.getUIConfigOnPlugin(splitted[0],splitted[1],{});
			else response=self.commandRouter.getUIConfigOnPlugin('system_controller',splitted[0],{});

			selfConnWebSocket.emit('pushUiConfig',response);
		});

		connWebSocket.on('getMultiRoomDevices', function(data) {
			selfConnWebSocket = this;

			var volumiodiscovery=self.commandRouter.pluginManager.getPlugin('system_controller','volumiodiscovery');
			var response=volumiodiscovery.getDevices();

			selfConnWebSocket.emit('pushMultiRoomDevices',response);
		});
	});
}

// Receive console messages from commandRouter and broadcast to all connected clients
InterfaceWebUI.prototype.printConsoleMessage = function(message) {
	var self = this;

	// Push the message all clients
	self.libSocketIO.emit('printConsoleMessage', message);

	// Return a resolved empty promise to represent completion
	return libQ.resolve();
}

// Receive player queue updates from commandRouter and broadcast to all connected clients
InterfaceWebUI.prototype.pushQueue = function(queue, connWebSocket) {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'InterfaceWebUI::pushQueue');

	// If a specific client is given, push to just that client
	if (connWebSocket) {
		return libQ.fcall(libFast.bind(connWebSocket.emit, connWebSocket), 'pushQueue', queue);
	// Else push to all connected clients
	} else {
		return libQ.fcall(libFast.bind(self.libSocketIO.emit, self.libSocketIO), 'pushQueue', queue);
	}
}

// Push the library root
InterfaceWebUI.prototype.pushLibraryFilters = function(browsedata, connWebSocket) {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'InterfaceWebUI::pushLibraryFilters');

	// If a specific client is given, push to just that client
	if (connWebSocket) {
		return libQ.fcall(libFast.bind(connWebSocket.emit, connWebSocket), 'pushLibraryFilters', browsedata);
	}
}

// Receive music library data from commandRouter and send to requester
InterfaceWebUI.prototype.pushLibraryListing = function(browsedata, connWebSocket) {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'InterfaceWebUI::pushLibraryListing');

	// If a specific client is given, push to just that client
	if (connWebSocket) {
		return libQ.fcall(libFast.bind(connWebSocket.emit, connWebSocket), 'pushLibraryListing', browsedata);
	}
}

// Push the playlist view
InterfaceWebUI.prototype.pushPlaylistListing = function(browsedata, connWebSocket) {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'InterfaceWebUI::pushPlaylistListing');

	// If a specific client is given, push to just that client
	if (connWebSocket) {
		return libQ.fcall(libFast.bind(connWebSocket.emit, connWebSocket), 'pushPlaylistIndex', browsedata);
	}
}

// Receive player state updates from commandRouter and broadcast to all connected clients
InterfaceWebUI.prototype.pushState = function(state, connWebSocket) {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'InterfaceWebUI::pushState');
	if (connWebSocket) {
		return libQ.fcall(libFast.bind(connWebSocket.emit, connWebSocket), 'pushState', state);
	} else {
		// Push the updated state to all clients
		return libQ.fcall(libFast.bind(self.libSocketIO.emit, self.libSocketIO), 'pushState', state);
	}
}

InterfaceWebUI.prototype.printToastMessage = function(type,title,message) {
	var self = this;

	// Push the message all clients
	self.libSocketIO.emit('pushToastMessage', {
		type:type,
		title:title,
		message:message
	});
}

InterfaceWebUI.prototype.pushMultiroomDevices = function(msg) {
	var self = this;

	self.libSocketIO.emit('pushMultiRoomDevices', msg);
}

InterfaceWebUI.prototype.logDone = function(timeStart) {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + '------------------------------ ' + (Date.now() - timeStart) + 'ms');
	return libQ.resolve();
}

InterfaceWebUI.prototype.logStart = function(sCommand) {
	var self = this;
	self.commandRouter.pushConsoleMessage('\n' + '[' + Date.now() + '] ' + '---------------------------- ' + sCommand);
	return libQ.resolve();
}

// Pass the error if we don't want to handle it
InterfaceWebUI.prototype.pushError = function(error) {
	var self = this;

	if ((typeof error) === 'string') {
		return self.commandRouter.pushConsoleMessage.call(self.commandRouter, 'Error: ' + error);
	} else if ((typeof error) === 'object') {
		return self.commandRouter.pushConsoleMessage.call(self.commandRouter, 'Error:\n' + error.stack);
	}

	// Return a resolved empty promise to represent completion
	return libQ.resolve();
};

