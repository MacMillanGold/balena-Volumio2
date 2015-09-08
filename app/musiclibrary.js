var libQ = require('kew');
var libFast = require('fast.js');
var libSortOn = require('sort-on');
var libCrypto = require('crypto');
var libBase64Url = require('base64-url');
var libLevel = require('level');
var libUtil = require('util');

// Define the CoreMusicLibrary class
module.exports = CoreMusicLibrary;
function CoreMusicLibrary (commandRouter) {
	// This fixed variable will let us refer to 'this' object at deeper scopes
	var self = this;

	// Save a reference to the parent commandRouter
	self.commandRouter = commandRouter;

	// Start metadata cache
	self.metadataCache = new (require('./metadatacache.js'))(commandRouter, self);

	// Specify the preference for service when adding tracks to the queue
	self.servicePriority = ['mpd', 'spop'];

	// The library contains hash tables for genres, artists, albums, and tracks
	self.library = {};
	self.libraryIndex = {};
	self.libraryIndex.root = {
		name: 'root',
		uid: 'root',
		type: 'index',
		children: []
	}
	self.arrayIndexDefinitions = [
		{
			'name': 'Genres by Name',
			'table': 'genre',
			'sortby': 'name',
			'datapath': [{
				'name': 'name',
				'type': 'type',
				'uid': 'uid'
			}]
		},
		{
			'name': 'Artists by Name',
			'table': 'artist',
			'sortby': 'name',
			'datapath': [{
				'name': 'name',
				'uid': 'uid',
				'type': 'type',
				'genres': ['genreuids', '#', {'name': 'name', 'uid': 'uid'}]
			}]
		},
		{
			'name': 'Albums by Name',
			'table': 'album',
			'sortby': 'name',
			'datapath': [{
				'name': 'name',
				'uid': 'uid',
				'type': 'type',
				'artists': ['artistuids', '#', {'name': 'name', 'uid': 'uid'}]
			}]
		},
		{
			'name': 'Albums by Artist',
			'table': 'album',
			'sortby': 'artistuids:#:name',
			'datapath': [{
				'name': 'name',
				'uid': 'uid',
				'type': 'type',
				'artists': ['artistuids', '#', {'name': 'name', 'uid': 'uid'}]
			}]
		},
		{
			'name': 'Tracks by Name',
			'table': 'track',
			'sortby': 'name',
			'datapath': [{
				'name': 'name',
				'uid': 'uid',
				'type': 'type',
				'album': ['albumuids', '#0', {'name': 'name', 'uid': 'uid'}],
				'artists': ['artistuids', '#', {'name': 'name', 'uid': 'uid'}]
			}]
		}
	];
	self.queueItemDataPath = [
		{
			'name': 'name',
			'uid': 'uid',
			'type': 'type',
			'albums': ['albumuids', '#', {'name': 'name', 'uid': 'uid'}],
			'artists': ['artistuids', '#', {'name': 'name', 'uid': 'uid'}],
			'tracknumber': 'tracknumber',
			'date': 'date',
			'duation': 'duration'
		}
	];

	// Attempt to load library from database on disk
	self.sLibraryPath = __dirname + '/db/musiclibrary';
	self.loadLibraryFromDB()
		.fail(function(error) {
			self.commandRouter.pushConsoleMessage.call(self.commandRouter, error.stack);
		});
}

// Public methods -----------------------------------------------------------------------------------

// Return a music library view for a given object UID
CoreMusicLibrary.prototype.getListing = function(sUid, objOptions) {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'CoreMusicLibrary::getListing');

	//TODO implement use of nEntries and nOffset for paging of results
	var arrayPath = objOptions.datapath;
	var sSortBy = objOptions.sortby;
	var objReturn = {
		navigation: {
			prev: {
				uri: ''
			}
		},
		list: []
	};

	var objRequested = self.getLibraryObject(sUid);

	if (!sSortBy) {
		objReturn.list = self.getObjectInfo(objRequested, arrayPath);
		objReturn.navigation.prev.uri = sUid;
		return libQ.resolve(objReturn);
	} else if (arrayPath.length === 0) {
		// TODO - return raw object?
	} else {
		// TODO - sort data before returning
		objReturn.list = self.getObjectInfo(objRequested, arrayPath);
		objReturn.navigation.prev.uri = sUid;
		return libQ.resolve(objReturn);
	}

	return libQ.reject('Sort options or path not recognized in request \"' + objOptions + '\"');
}

CoreMusicLibrary.prototype.getIndex = function(sUid) {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'CoreMusicLibrary::getIndex');

	var objReturn = {
		navigation: {
			prev: {
				uri: ''
			}
		},
		currentobject: {
			uid: ''
		},
		list: []
	};

	objReturn.list = self.libraryIndex[sUid].children;
	objReturn.currentobject.uid = sUid;

	return libQ.resolve(objReturn);
}

CoreMusicLibrary.prototype.addLibraryUidsToQueue = function(arrayUids) {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'CoreMusicLibrary::addLibraryUidsToQueue');

	self.commandRouter.addItemsToQueue(self.makeQueueItemArray(arrayUids));
}

CoreMusicLibrary.prototype.makeQueueItemArray = function(arrayUids) {
	var self = this;
	var arrayQueueItems = [];

	libFast.map(arrayUids, function(sCurrentUid) {
		var objCurrent = self.getLibraryObject(sCurrentUid);

		if (objCurrent.type === 'track') {
			arrayQueueItems.push(self.makeQueueItem(objCurrent));
		} else {
			libFast.map(Object.keys(objCurrent.trackuids), function(sCurrentKey) {
				// TODO - allow adding tracks per a given sort order
				var objCurrentTrack = self.getLibraryObject(sCurrentKey);
				arrayQueueItems.push(self.makeQueueItem(objCurrentTrack));
			});
		}
	});

	return arrayQueueItems;

}

CoreMusicLibrary.prototype.makeQueueItem = function(objTrack) {
	var self = this;

	for (i = 0; i < self.servicePriority.length; i++) {
		if (self.servicePriority[i] in objTrack.uris) {
			var objQueueItem = objTrack.uris[self.servicePriority[i]];
			objQueueItem.service = self.servicePriority[i];
			objTrackInfo = self.getObjectInfo(objTrack, self.queueItemDataPath);

			libFast.map(Object.keys(objTrackInfo), function(sCurField) {
				objQueueItem[sCurField] = objTrackInfo[sCurField];
			});

			return objQueueItem;
		}
	}
	return {};
}

// Load a LevelDB from disk containing the music library and indexes
CoreMusicLibrary.prototype.loadLibraryFromDB = function() {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'CoreMusicLibrary::loadLibraryFromDB');
	self.commandRouter.pushConsoleMessage('Loading library from DB...');

	self.library = {};
	self.libraryIndex = {};
	self.libraryIndex.root = {
		name: 'root',
		uid: 'root',
		type: 'index',
		children: []
	}

	var dbLibrary = libLevel(self.sLibraryPath, {'valueEncoding': 'json', 'createIfMissing': true});
	return libQ.resolve()
		.then(function() {
			return libQ.nfcall(libFast.bind(dbLibrary.get, dbLibrary), 'library');
		})
		.then(function(result) {
			self.library = result;
			self.commandRouter.pushConsoleMessage('Library loaded from DB.');

			return libQ.nfcall(libFast.bind(dbLibrary.get, dbLibrary), 'libraryIndex');
		})
		.then(function(result) {
			self.libraryIndex = result;
			self.commandRouter.pushConsoleMessage('Library index loaded from DB.');

			self.commandRouter.pushConsoleMessage('  Genres: ' + Object.keys(self.library['genre']).length);
			self.commandRouter.pushConsoleMessage('  Artists: ' + Object.keys(self.library['artist']).length);
			self.commandRouter.pushConsoleMessage('  Albums: ' + Object.keys(self.library['album']).length);
			self.commandRouter.pushConsoleMessage('  Tracks: ' + Object.keys(self.library['track']).length);
			self.commandRouter.pushConsoleMessage('  Indexes: ' + (Object.keys(self.libraryIndex).length - 1));

			self.commandRouter.notifyMusicLibraryUpdate.call(self.commandRouter);
			return libQ.resolve();
		})
		.fin(libFast.bind(dbLibrary.close, dbLibrary));
}

// Query all services for their tracklists, scan each track, and build music library
// This currently needs to be rerun when any tracklist changes, TODO make this updatable in place
CoreMusicLibrary.prototype.buildLibrary = function() {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'CoreMusicLibrary::buildLibrary');

	self.library = {};
	self.library.genre = {};
	self.library.artist = {};
	self.library.album = {};
	self.library.track = {};
	self.libraryIndex = {};
	self.libraryIndex.root = {
		name: 'root',
		uid: 'root',
		type: 'index',
		children: []
	}

	var dbLibrary = libLevel(self.sLibraryPath, {'valueEncoding': 'json', 'createIfMissing': true});
	return self.commandRouter.getAllTracklists()
		.then(function(arrayAllTracklists) {
			self.commandRouter.pushConsoleMessage('Populating library...');

			// need to wrap this with libQ.all()?
			return libFast.map(arrayAllTracklists, function(arrayTracklist) {
				return self.populateLibraryFromTracklist(arrayTracklist);
			});
		})
		.then(function() {
			self.commandRouter.pushConsoleMessage('  Genres: ' + Object.keys(self.library['genre']).length);
			self.commandRouter.pushConsoleMessage('  Artists: ' + Object.keys(self.library['artist']).length);
			self.commandRouter.pushConsoleMessage('  Albums: ' + Object.keys(self.library['album']).length);
			self.commandRouter.pushConsoleMessage('  Tracks: ' + Object.keys(self.library['track']).length);

			self.commandRouter.pushConsoleMessage('Generating indexes...');

			return libQ.all(libFast.map(self.arrayIndexDefinitions, function(curIndexDefinition) {
				return self.buildSingleIndex(curIndexDefinition);
			}));
		})
		.then(function() {
			self.commandRouter.pushConsoleMessage('Writing root listing...');

			self.libraryIndex.root.children = libFast.map(self.arrayIndexDefinitions, function(curEntry) {
				var sUid = convertStringToHashkey(curEntry.name);
				return {'uid': sUid, 'type': 'index', 'name': curEntry.name};
			});
		})
		.then(function() {
			self.commandRouter.pushConsoleMessage('Storing library in db...');
			return libQ.nfcall(libFast.bind(dbLibrary.put, dbLibrary), 'library', self.library);
		})
		.then(function() {
			self.commandRouter.pushConsoleMessage('Storing library index in db...');
			return libQ.nfcall(libFast.bind(dbLibrary.put, dbLibrary), 'libraryIndex', self.libraryIndex);
		})
		.then(function() {
			self.commandRouter.pushConsoleMessage('Library build complete.');

			self.commandRouter.notifyMusicLibraryUpdate.call(self.commandRouter);
		})
		.fin(libFast.bind(dbLibrary.close, dbLibrary));
}

CoreMusicLibrary.prototype.updateAllMetadata = function() {
	var self = this;

	return self.metadataCache.updateAllItems.call(self.metadataCache);
}

// Internal methods ---------------------------------------------------------------------------

// Given a Uid, pull an object out of the library
CoreMusicLibrary.prototype.getLibraryObject = function(sUid) {
	var self = this;
	var arrayUidParts = sUid.split(':');

	if (!(arrayUidParts[0] in self.library)) {
		throw new Error('Table ' + JSON.stringify(arrayUidParts[0]) + ' not found in library.');
	} else if (!(arrayUidParts[1] in self.library[arrayUidParts[0]])) {
		throw new Error('Object ' + JSON.stringify(arrayUidParts[1]) + ' not found in library table ' + JSON.stringify(arrayUidParts[0]) + '.');
	}

	return self.library[arrayUidParts[0]][arrayUidParts[1]];

}

// Navigate through a library object via the provided path and retrieve requested data (possibly recursively).
// The path is an array with each item being the next traverse step. Using '#' in a given step indicates
// that all Uids shown at that level are to be recursed down, and the result will be
// presented in an array. Using '#x' will pick out only the Uid at index x, where x is a number.
// The last item in the path array is the data return specification. It is a JSON object, where each key
// represents the field in which the data is returned, and each value represents the field in which the
// data is stored in the source object. In the data return specification, any value which is an array
// will be treated as a further traversal path, the results of which will be stored in the corresponding
// return field.
//
// Examples:
// getObjectInfo(<object track:XYZ>, [{'name': 'name', 'uid': 'uid'}])
//   -> {'name': <name of track XYZ>, 'uid': 'track:XYZ'}
//
// getObjectInfo(<object album:UVW>, ['artistuids', '#', {'name': 'name', 'uid': 'uid'}])
//   -> [{'name': <name of artist ABC>, 'uid': 'artist:ABC'}, {'name': <name of artist DEF>, 'uid': 'artist:DEF'}]
//
// getObjectInfo(<object album:UVW>, ['artistuids', '#', 'genreuids', '#', {'name': 'name'}])
//   -> [[{'name': <name of genre GHI>}, {'name': <name of genre JKL>}], [{'name': <name of genre MNO}]]
//
// getObjectInfo(<object artist:ABC>, ['genreuids', '#0', {'name': 'name', 'uid': 'uid'}])
//   -> {'name': <name of genre GHI>, 'uid': 'genre:GHI'}
//
// getObjectInfo(<object artist:ABC>, ['trackuids', '#0', 'uris', '#', {'service': 'service', 'uri': 'uri'}])
//   -> [{'service': 'mpd', 'uri': '/path/to/track'}, {'service': 'spop', 'uri': 'spotify:track:XXXX'}]
//
// getObjectInfo(<object artist:ABC>, ['trackuids', '#', {'name': 'name', 'genres': ['genreuids', '#', {'name': 'name'}]}])
//   -> [
//		    {'name': <name of track XYZ>, 'genres': [{'name': <name of genre GHI>}, {'name': <name of genre JKL>}]},
//          {'name': <name of track MNO>, 'genres': [{'name': <name of genre JKL>}]}
//      ]
//
CoreMusicLibrary.prototype.getObjectInfo = function(objSource, arrayPath) {
	var self = this;

	var curStep = arrayPath[0];
	var arrayPathRemainder = arrayPath.slice(1);

	if (arrayPath.length === 1) {
		// We are at the last portion of the path, this is an object which specifies the data to collect
		var objReturnFields = curStep;
		var objReturn = {};
		libFast.map(Object.keys(objReturnFields), function(sCurReturnField) {
			var sCurSourceField = objReturnFields[sCurReturnField];
			if (typeof sCurSourceField === 'object') {
				// Further traversal is needed to get the required data
				objReturn[sCurReturnField] = self.getObjectInfo(objSource, sCurSourceField);
			} else if (sCurSourceField in objSource) {
				// This is a simple object key that we can access
				objReturn[sCurReturnField] = objSource[sCurSourceField];
			} else {
				// Can't find data to collect
				//throw new Error('Cannot read data field: ' + sCurReturnField);
				objReturn[sCurReturnField] = '';
			}
		});
		return objReturn;
	} else if (curStep === '#') {
		// A wildcard is specified. Recurse through all keys at this level.
		return libFast.map(Object.keys(objSource), function(curUid) {
			var objNew = self.getLibraryObject(curUid);
			return self.getObjectInfo(objNew, arrayPathRemainder);
		});
	} else if (curStep.substr(0,1) === '#') {
		// A specific numeric index is requested. Get data from just the key at that index.
		var objNew = self.getLibraryObject(Object.keys(objSource)[curStep.substr(1)]);
		return self.getObjectInfo(objNew, arrayPathRemainder);
	} else if (curStep in objSource) {
		// This is a simple object key that we can traverse down
		return self.getObjectInfo(objSource[curStep], arrayPathRemainder);
	} else {
		// Cannot find the path to traverse down
		throw new Error('Cannot nagivate path field: ' + JSON.stringify(curStep));
	}
}

// Put the contents of a tracklist into the library
CoreMusicLibrary.prototype.populateLibraryFromTracklist = function(arrayTracklist) {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'CoreMusicLibrary::populateLibraryFromTracklist');

	// need to wrap this with libQ.all()?
	return libFast.map(arrayTracklist, function(curTrack) {
		return self.addLibraryItem(curTrack);
	});
}

// Create a sorted index of a given music library table
CoreMusicLibrary.prototype.buildSingleIndex = function(objIndexDefinition) {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'CoreMusicLibrary::buildSingleIndex');

	var sIndexName = objIndexDefinition.name;
	var sTableName = objIndexDefinition.table;
	var sSortBy = objIndexDefinition.sortby;
	var arrayPath = objIndexDefinition.datapath;
	var sIndexUid = convertStringToHashkey(sIndexName);

	if (!(sTableName in self.library)) {
		throw new Error('Specified table ' + sTableName + ' not found in library for indexing');
	}

	return libQ.all(libFast.map(Object.keys(self.library[sTableName]), function(curKey) {
			var objSource = self.library[sTableName][curKey];
			return self.getObjectInfo(objSource, arrayPath);
		}))
		/*.then(function(arrayUnsorted) {
			return self.sortDataArray(arrayUnsorted, sSortBy);
		})*/
		.then(function(arraySorted) {
			self.libraryIndex[sIndexUid] = {
				name: sIndexName,
				uid: sIndexUid,
				type: 'index',
				children: arraySorted
			}
		});
}

// Sort an array of objects based on a provided sort field.
CoreMusicLibrary.prototype.sortDataArray = function(arrayData, sSortBy) {
	var self = this;

	// TODO - use a sort function which ignores prefixes "the", "a", etc., and case
	return libQ.fcall(libSortOn, arrayUnsorted, sSortBy);
}

// Function to add an item to all tables in the database.
CoreMusicLibrary.prototype.addLibraryItem = function(curTrack) {
	var self = this;

	var sService = curTrack.service;
	var sUri = curTrack.uri;
	var sName = curTrack.name;
	var sAlbum = curTrack.album;
	var arrayArtists = curTrack.artists;
	var arrayGenres = curTrack.genres;
	var nTrackNumber = curTrack.tracknumber;
	var dateTrackDate = curTrack.date;
	var sAlbumArtUri = curTrack.albumart_uri;

	var tableGenres = self.library.genre;
	var tableArtists = self.library.artist;
	var tableAlbums = self.library.album;
	var tableTracks = self.library.track;

	curTrackKey = convertStringToHashkey(sAlbum + sName);

	if (!(curTrackKey in tableTracks)) {
		tableTracks[curTrackKey] = {};
		tableTracks[curTrackKey].name = sName;
		tableTracks[curTrackKey].uid = 'track:' + curTrackKey;
		tableTracks[curTrackKey].type = 'track';
		tableTracks[curTrackKey].tracknumber = nTrackNumber;
		tableTracks[curTrackKey].date = dateTrackDate;
		tableTracks[curTrackKey].albumuids = {};
		tableTracks[curTrackKey].artistuids = {};
		tableTracks[curTrackKey].uris = {};
	}

	tableTracks[curTrackKey].uris[sService] = {};
	tableTracks[curTrackKey].uris[sService].uri = sUri;
	tableTracks[curTrackKey].uris[sService].format = '';
	tableTracks[curTrackKey].uris[sService].bitdepth = '';
	tableTracks[curTrackKey].uris[sService].samplerate = '';
	tableTracks[curTrackKey].uris[sService].channels = '';
	tableTracks[curTrackKey].uris[sService].duration = '';
	//self.metadataCache.addTask.call(self.metadataCache, 'track', curTrackKey);

	if (sAlbum === 'Greatest Hits') {
		// The 'Greatest Hits' album name is a repeat offender for unrelated albums being grouped together.
		// If that is the album name, derive the key using a combination of the first artist and album name instead.
		curAlbumKey = convertStringToHashkey(arrayArtists[0] + sAlbum);
	} else {
		// Otherwise, tracks which share the same album name but not the same artist are probably actually
		// in the same album.
		curAlbumKey = convertStringToHashkey(sAlbum);
	}

	if (!(curAlbumKey in tableAlbums)) {
		tableAlbums[curAlbumKey] = {};
		tableAlbums[curAlbumKey].name = sAlbum;
		tableAlbums[curAlbumKey].uid = 'album:' + curAlbumKey;
		tableAlbums[curAlbumKey].type = 'album';
		tableAlbums[curAlbumKey].trackuids = {};
		tableAlbums[curAlbumKey].artistuids = {};
		tableAlbums[curAlbumKey].imageuris = {};
	}

	// Store a link to the album art URI for each service
	if (!(sService in tableAlbums[curAlbumKey].imageuris)) {
		tableAlbums[curAlbumKey].imageuris[sService] = sAlbumArtUri;
	}

	tableAlbums[curAlbumKey].trackuids['track:' + curTrackKey] = null;
	tableTracks[curTrackKey].albumuids['album:' + curAlbumKey] = null;
	//self.metadataCache.addTask.call(self.metadataCache, 'album', curAlbumKey);

	for (var iArtist = 0; iArtist < arrayArtists.length; iArtist++) {
		curArtistKey = convertStringToHashkey(arrayArtists[iArtist]);

		if (!(curArtistKey in tableArtists)) {
			tableArtists[curArtistKey] = {};
			tableArtists[curArtistKey].name = arrayArtists[iArtist];
			tableArtists[curArtistKey].uid = 'artist:' + curArtistKey;
			tableArtists[curArtistKey].type = 'artist';
			tableArtists[curArtistKey].albumuids = {};
			tableArtists[curArtistKey].genreuids = {};
			tableArtists[curArtistKey].trackuids = {};
		}

		tableArtists[curArtistKey].albumuids['album:' + curAlbumKey] = null;
		tableArtists[curArtistKey].trackuids['track:' + curTrackKey] = null;
		tableAlbums[curAlbumKey].artistuids['artist:' + curArtistKey] = null;
		tableTracks[curTrackKey].artistuids['artist:' + curArtistKey] = null;
		//self.metadataCache.addTask.call(self.metadataCache, 'artist', curArtistKey);

		for (var iGenre = 0; iGenre < arrayGenres.length; iGenre++) {
			curGenreKey = convertStringToHashkey(arrayGenres[iGenre]);

			if (!(curGenreKey in tableGenres)) {
				tableGenres[curGenreKey] = {};
				tableGenres[curGenreKey].name = arrayGenres[iGenre];
				tableGenres[curGenreKey].uid = 'genre:' + curGenreKey;
				tableGenres[curGenreKey].type = 'genre';
				tableGenres[curGenreKey].artistuids = {};
				tableGenres[curGenreKey].albumuids = {};
				tableGenres[curGenreKey].trackuids = {};
			}

			tableGenres[curGenreKey].artistuids['artist:' + curArtistKey] = null;
			tableGenres[curGenreKey].albumuids['album:' + curAlbumKey] = null;
			tableGenres[curGenreKey].trackuids['track:' + curTrackKey] = null;
			tableArtists[curArtistKey].genreuids['genre:' + curGenreKey] = null;
			//self.metadataCache.addTask.call(self.metadataCache, 'genre', curGenreKey);
		}
	}

	return libQ.resolve();
}

CoreMusicLibrary.prototype.notifyMusicLibraryUpdate = function() {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'CoreMusicLibrary::notifyMusicLibraryUpdate');

	return self.commandRouter.notifyMusicLibraryUpdate.call(self.commandRouter);
}

// Pass the error if we don't want to handle it
// TODO calls to this function should instead be replaced by 'throw new Error()', which would be caught by
// any listening promise failure handler.
CoreMusicLibrary.prototype.pushError = function(sReason) {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'CoreMusicLibrary::pushError(' + sReason + ')');

	// Return a resolved empty promise to represent completion
	return libQ.resolve();
}

// Helper functions ------------------------------------------------------------------------------------

// Create a URL safe hashkey for a given string. The result will be a constant length string containing
// upper and lower case letters, numbers, '-', and '_'.
function convertStringToHashkey(input) {
    if (input === null) {
        input = '';

    }

	return libBase64Url.escape(libCrypto.createHash('sha256').update(input, 'utf8').digest('base64'));
}

// Takes a nested array of strings and produces a comma-delmited string. Example:
// ['a', [['b', 'c'], 'd']] -> 'a, b, c, d'
function flattenArrayToCSV(arrayInput) {
	if (typeof arrayInput === "object") {
		return libFast.reduce(arrayInput, function(sReturn, curEntry, nIndex) {
			if (nIndex > 0) {
				return sReturn + ", " + flattenArrayToCSV(curEntry);
			} else {
				return flattenArrayToCSV(curEntry);
			}
		},"");
	} else {
		return arrayInput;
	}
}

