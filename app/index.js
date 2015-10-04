var libQ = require('kew');
var libFast = require('fast.js');
var fs=require('fs-extra');
var exec = require('child_process').exec;
var winston = require('winston');

var LOG_FILE = '/data/volumio.log';

// Define the CoreCommandRouter class
module.exports = CoreCommandRouter;
function CoreCommandRouter (server) {
	// This fixed variable will let us refer to 'this' object at deeper scopes
	var self = this;

	fs.ensureFileSync(LOG_FILE);
	self.logger = new (winston.Logger)({
		transports: [
			new (winston.transports.Console)(),
			new (winston.transports.File)({ filename: LOG_FILE,
											json: false})
		]
	});


	self.logger.info("-------------------------------------------");
	self.logger.info("-----            Volumio2              ----");
	self.logger.info("-------------------------------------------");
	self.logger.info("-----          System startup          ----");
	self.logger.info("-------------------------------------------");

	// Start plugins
	self.pluginManager = new (require(__dirname+'/pluginmanager.js'))(self, server);
	self.pluginManager.loadPlugins();
	//self.pluginManager.onVolumioStart();
	//self.pluginManager.startPlugins();

	// Start the state machine
	self.stateMachine = new (require('./statemachine.js'))(self);

	// Start the music library
	//self.musicLibrary = new (require('./musiclibrary.js'))(self);

	// Start the volume controller
	self.volumeControl = new (require('./volumecontrol.js'))(self);

	// Start the playlist FS
	//self.playlistFS = new (require('./playlistfs.js'))(self);

	self.playListManager= new (require('./playlistManager.js'))(self);

	self.pushConsoleMessage( 'BOOT COMPLETED');

	//Startup Sound
	exec("/usr/bin/aplay /volumio/app/startup.wav", function (error, stdout, stderr) {
		if (error !== null) {
			self.pushConsoleMessage(error);
		}
	});



}

// Methods usually called by the Client Interfaces ----------------------------------------------------------------------------

// Volumio Play
CoreCommandRouter.prototype.volumioPlay = function() {
	var self = this;
	self.pushConsoleMessage( 'CoreCommandRouter::volumioPlay');

	return self.stateMachine.play();
}

// Volumio Pause
CoreCommandRouter.prototype.volumioPause = function() {
	var self = this;
	self.pushConsoleMessage( 'CoreCommandRouter::volumioPause');

	return self.stateMachine.pause();
}

// Volumio Stop
CoreCommandRouter.prototype.volumioStop = function() {
	var self = this;
	self.pushConsoleMessage( 'CoreCommandRouter::volumioStop');

	return self.stateMachine.stop();
}

// Volumio Previous
CoreCommandRouter.prototype.volumioPrevious = function() {
	var self = this;
	self.pushConsoleMessage( 'CoreCommandRouter::volumioPrevious');

	return self.stateMachine.previous();
}

// Volumio Next
CoreCommandRouter.prototype.volumioNext = function() {
	var self = this;
	self.pushConsoleMessage( 'CoreCommandRouter::volumioNext');

	return self.stateMachine.next();
}

// Volumio Get State
CoreCommandRouter.prototype.volumioGetState = function() {
	var self = this;
	self.pushConsoleMessage( 'CoreCommandRouter::volumioGetState');

	return self.stateMachine.getState();
}

// Volumio Get Queue
CoreCommandRouter.prototype.volumioGetQueue = function() {
	var self = this;
	self.pushConsoleMessage( 'CoreCommandRouter::volumioGetQueue');

	return self.stateMachine.getQueue();
}

// Volumio Remove Queue Item
CoreCommandRouter.prototype.volumioRemoveQueueItem = function(nIndex) {
	var self = this;
	self.pushConsoleMessage( 'CoreCommandRouter::volumioRemoveQueueItem');

	return self.stateMachine.removeQueueItem(nIndex);
}

// Volumio Clear Queue Item
CoreCommandRouter.prototype.volumioClearQueue = function() {
	var self = this;
	self.pushConsoleMessage( 'CoreCommandRouter::volumioClearQueue');

	return self.stateMachine.clearQueue();
}

// Volumio Set Volume
CoreCommandRouter.prototype.volumiosetvolume = function(VolumeInteger) {
	var self = this;
	return self.volumeControl.alsavolume(VolumeInteger);
}

// Volumio Update Volume
CoreCommandRouter.prototype.volumioupdatevolume = function(vol) {
	var self = this;
	return self.stateMachine.updateVolume(vol);
}

// Volumio Retrieve Volume
CoreCommandRouter.prototype.volumioretrievevolume = function(vol) {
	var self = this;
	self.pushConsoleMessage( 'CoreCommandRouter::volumioRetrievevolume');

	return self.volumeControl.retrievevolume();
}

// Volumio Add Queue Uids
CoreCommandRouter.prototype.volumioAddQueueUids = function(arrayUids) {
	var self = this;
	self.pushConsoleMessage( 'CoreCommandRouter::volumioAddQueueUids');

	return self.musicLibrary.addQueueUids(arrayUids);
}
/*

TODO: This should become the default entry point for adding music to any service
// Volumio Add Queue Uri
CoreCommandRouter.prototype.volumioAddQueueUri = function(data) {
	var self = this;
	self.pushConsoleMessage( 'CoreCommandRouter::volumioAddQueueUri');
	var service = data.service;
	var uri = data.uri;
		return self.executeOnPlugin('music_service', 'mpd', 'add', uri);
}
*/
// Volumio Rebuild Library
CoreCommandRouter.prototype.volumioRebuildLibrary = function() {
	var self = this;
	self.pushConsoleMessage( 'CoreCommandRouter::volumioRebuildLibrary');

	return self.musicLibrary.buildLibrary();
}

// Volumio Get Library Index
CoreCommandRouter.prototype.volumioGetLibraryFilters = function(sUid) {
	var self = this;
	self.pushConsoleMessage( 'CoreCommandRouter::volumioGetLibraryFilters');

	return self.musicLibrary.getIndex(sUid);
}

// Volumio Browse Library
CoreCommandRouter.prototype.volumioGetLibraryListing = function(sUid, objOptions) {
	var self = this;
	self.pushConsoleMessage( 'CoreCommandRouter::volumioGetLibraryListing');

	return self.musicLibrary.getListing(sUid, objOptions);
}

// Volumio Get Playlist Index
CoreCommandRouter.prototype.volumioGetPlaylistIndex = function(sUid) {
	var self = this;
	self.pushConsoleMessage( 'CoreCommandRouter::volumioGetPlaylistIndex');

	return self.playlistFS.getIndex(sUid);
}

// Service Update Tracklist
CoreCommandRouter.prototype.serviceUpdateTracklist = function(sService) {
	var self = this;
	self.pushConsoleMessage( 'CoreCommandRouter::serviceUpdateTracklist');

	var thisPlugin = self.pluginManager.getPlugin.call(self.pluginManager, 'music_service', sService);
	return thisPlugin.rebuildTracklist.call(thisPlugin);
}

// Start WirelessScan
CoreCommandRouter.prototype.volumiowirelessscan = function() {
	var self = this;
	self.pushConsoleMessage( 'CoreCommandRouter::StartWirelessScan');

	var thisPlugin = self.pluginManager.getPlugin.call(self.pluginManager, 'music_service', sService);
	return thisPlugin.scanWirelessNetworks.call(thisPlugin);
}

// Push WirelessScan Results (TODO SEND VIA WS)
CoreCommandRouter.prototype.volumiopushwirelessnetworks = function(results) {
	var self = this;
	self.pushConsoleMessage( results);
}

// Volumio Import Playlists
CoreCommandRouter.prototype.volumioImportServicePlaylists = function() {
	var self = this;
	self.pushConsoleMessage( 'CoreCommandRouter::volumioImportServicePlaylists');

	return self.playlistFS.importServicePlaylists();
}

// Methods usually called by the State Machine --------------------------------------------------------------------

CoreCommandRouter.prototype.volumioPushState = function(state) {
	var self = this;
	self.pushConsoleMessage( 'CoreCommandRouter::volumioPushState');

	// Announce new player state to each client interface
	return libQ.all(
		libFast.map(self.pluginManager.getPluginNames.call(self.pluginManager, 'user_interface'), function(sInterface) {
			var thisInterface = self.pluginManager.getPlugin.call(self.pluginManager, 'user_interface', sInterface);
			return thisInterface.pushState.call(thisInterface, state);
		})
	);
}

CoreCommandRouter.prototype.volumioPushQueue = function(queue) {
	var self = this;
	self.pushConsoleMessage( 'CoreCommandRouter::volumioPushQueue');

	// Announce new player queue to each client interface
	return libQ.all(
		libFast.map(self.pluginManager.getPluginNames.call(self.pluginManager, 'user_interface'), function(sInterface) {
			var thisInterface = self.pluginManager.getPlugin.call(self.pluginManager, 'user_interface', sInterface);
			return thisInterface.pushQueue.call(thisInterface, queue);
		})
	);
}

// MPD Clear-Add-Play
CoreCommandRouter.prototype.serviceClearAddPlayTracks = function(arrayTrackIds, sService) {
	var self = this;
	self.pushConsoleMessage( 'CoreCommandRouter::serviceClearAddPlayTracks');

	var thisPlugin = self.pluginManager.getPlugin.call(self.pluginManager, 'music_service', sService);
	return thisPlugin.clearAddPlayTracks.call(thisPlugin, arrayTrackIds);
}

// MPD Stop
CoreCommandRouter.prototype.serviceStop = function(sService) {
	var self = this;
	self.pushConsoleMessage( 'CoreCommandRouter::serviceStop');

	var thisPlugin = self.pluginManager.getPlugin.call(self.pluginManager, 'music_service', sService);
	return thisPlugin.stop.call(thisPlugin);
}

// MPD Pause
CoreCommandRouter.prototype.servicePause = function(sService) {
	var self = this;
	self.pushConsoleMessage( 'CoreCommandRouter::servicePause');

	var thisPlugin = self.pluginManager.getPlugin.call(self.pluginManager, 'music_service', sService);
	return thisPlugin.pause.call(thisPlugin);
}

// MPD Resume
CoreCommandRouter.prototype.serviceResume = function(sService) {
	var self = this;
	self.pushConsoleMessage( 'CoreCommandRouter::serviceResume');

	var thisPlugin = self.pluginManager.getPlugin.call(self.pluginManager, 'music_service', sService);
	return thisPlugin.resume.call(thisPlugin);
}

// Methods usually called by the service controllers --------------------------------------------------------------

CoreCommandRouter.prototype.servicePushState = function(state, sService) {
	var self = this;
	self.pushConsoleMessage( 'CoreCommandRouter::servicePushState');

	return self.stateMachine.syncState(state, sService);
}

// Methods usually called by the music library ---------------------------------------------------------------------

// Get tracklists from all services and return them as an array
CoreCommandRouter.prototype.getAllTracklists = function() {
	var self = this;
	self.pushConsoleMessage( 'CoreCommandRouter::getAllTracklists');

	// This is the synchronous way to get libraries, which waits for each controller to return its tracklist before continuing
	return libQ.all(
		libFast.map(self.pluginManager.getPluginNames.call(self.pluginManager, 'music_service'), function(sService) {
			var thisService = self.pluginManager.getPlugin.call(self.pluginManager, 'music_service', sService);
			return thisService.getTracklist.call(thisService);
		})
	);
}

// Volumio Add Queue Items
CoreCommandRouter.prototype.addQueueItems = function(arrayItems) {
	var self = this;
	self.pushConsoleMessage('CoreCommandRouter::volumioAddQueueItems');

	return self.stateMachine.addQueueItems(arrayItems);
}

CoreCommandRouter.prototype.executeOnPlugin = function(type, name, method, data) {
	var self = this;
	self.pushConsoleMessage( 'CoreCommandRouter::executeOnPlugin');

	var thisPlugin = self.pluginManager.getPlugin.call(self.pluginManager, type, name);

	if(thisPlugin!=undefined)
		return thisPlugin[method].call(thisPlugin, data);
	else return undefined;
}

CoreCommandRouter.prototype.getUIConfigOnPlugin = function(type, name, data) {
	var self = this;
	self.pushConsoleMessage( 'CoreCommandRouter::getUIConfigOnPlugin');

	var thisPlugin = self.pluginManager.getPlugin.call(self.pluginManager, type, name);
	return thisPlugin.getUIConfig.call(thisPlugin, data);
}

/* what is this?
CoreCommandRouter.prototype.getConfiguration=function(componentCode)
{
	console.log("_________ "+componentCode);
}
*/

// Utility functions ---------------------------------------------------------------------------------------------

CoreCommandRouter.prototype.pushConsoleMessage = function(sMessage) {
	var self = this;

	self.logger.info(sMessage);

	return libQ.all(
		libFast.map(self.pluginManager.getPluginNames.call(self.pluginManager, 'user_interface'), function(sInterface) {
			var thisInterface = self.pluginManager.getPlugin.call(self.pluginManager, 'user_interface', sInterface);
			if( typeof thisInterface.printConsoleMessage === "function")
			return thisInterface.printConsoleMessage.call(thisInterface, sMessage);
		})
	);
}

CoreCommandRouter.prototype.pushToastMessage = function(type, title, message) {
	var self = this;

	return libQ.all(
		libFast.map(self.pluginManager.getPluginNames.call(self.pluginManager, 'user_interface'), function(sInterface) {
			var thisInterface = self.pluginManager.getPlugin.call(self.pluginManager, 'user_interface', sInterface);
			if (typeof thisInterface.printToastMessage === "function")
				return thisInterface.printToastMessage.call(thisInterface, type, title, message);
		})
	);
}

CoreCommandRouter.prototype.broadcastToastMessage = function(type, title, message) {
	var self = this;

	return libQ.all(
		libFast.map(self.pluginManager.getPluginNames.call(self.pluginManager, 'user_interface'), function(sInterface) {
			var thisInterface = self.pluginManager.getPlugin.call(self.pluginManager, 'user_interface', sInterface);
			if (typeof thisInterface.broadcastToastMessage === "function")
				return thisInterface.broadcastToastMessage.call(thisInterface, type, title, message);
		})
	);
}
CoreCommandRouter.prototype.pushMultiroomDevices = function(data)
{
	var self=this;

	return libQ.all(
		libFast.map(self.pluginManager.getPluginNames.call(self.pluginManager, 'user_interface'), function(sInterface) {
			var thisInterface = self.pluginManager.getPlugin.call(self.pluginManager, 'user_interface', sInterface);
			if (typeof thisInterface.pushMultiroomDevices === "function" )
				return thisInterface.pushMultiroomDevices.call(thisInterface, data);
		})
	);
}

CoreCommandRouter.prototype.shutdown = function() {
	var self = this;
	exec("sudo /sbin/halt", function (error, stdout, stderr) {
		if (error !== null) {
			self.pushConsoleMessage( error);
		} else self.pushConsoleMessage('Shutting Down');
	});
}

CoreCommandRouter.prototype.reboot = function() {
	var self = this;
	exec("sudo /sbin/reboot", function (error, stdout, stderr) {
		if (error !== null) {
			self.pushConsoleMessage(error);
		} else self.pushConsoleMessage('Rebooting');
	});
}
