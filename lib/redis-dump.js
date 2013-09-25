/**
 * Redis dump main file.
 *
 * @author Dmitriy Yurchenko <feedback@evildev.ru>
 */

var Redis = require('redis'),
	async = require('async'),
	_ = require('underscore');

/**
 * Redis dump class.
 *
 * @param {Object} params init params.
 * @constructor
 */
var RedisDump = module.exports = function(params) {
	'use strict';

	var client;

	/**
	 * @return {String} version of library.
	 */
	this.getVersion = function() {
		return '0.1.0';
	};

	/**
	 * @return {Object} redis client.
	 */
	this.getClient = function() {
		return client || params.client;
	};

	/**
	 * @return {Object} initialize parameters.
	 */
	this.getConnectParams = function() {
		return params;
	};

	/**
	 * Connect to redis server if not set client during initialize.
	 *
	 * @return {Boolean} true if success connect.
	 */
	this.connect = function() {
		client = Redis.createClient(params.port, params.host, params);
		if (!_.isEmpty(params.password)) {
			client.auth(params.password);
		}

		return !client;
	};
};

/**
 * Read key callback by type.
 */
RedisDump.prototype.getForTypeCallback = function(key, data, callback) {
	'use strict';

	/**
	 * Read scores by values.
	 *
	 * @param {Array} values
	 * @param {Function} callback
	 */
	var ReadScores = function(values, callback) {
		var result = [];

		/**
		 * Get scores recursive.
		 */
		var GetRecursive = function() {
			if (!values.length) {
				callback(null, result);
				return;
			}

			var value = values.pop();

			this.getClient().zscore(key, value, function(err, score) {
				if (err) {
					callback(err);
					return;
				}

				result.push(score);
				GetRecursive();
			});
		}.bind(this);

		GetRecursive();
	}.bind(this);

	/**
	 * Read key.
	 *
	 * @param {String} key
	 * @param {String} type
	 * @param {Function} rkCallback
	 */
	var ReadKey = function(key, type, rkCallback) {
		var params = [ key ],
			command = {
				set: 'smembers',
				zset: 'zrange',
				list: 'lrange'
			}[ type ] || 'get';

		if (command.indexOf('range') !== -1) {
			params.push(0);
			params.push(-1);
		}

		params.push(function(err, values) {
			if (err) {
				rkCallback(err);
				return;
			}

			if (command.indexOf('zrange') !== -1) {
				ReadScores(_.clone(values).reverse(), function(err, scores) {
					rkCallback(null, _.zip(scores, values));
				});
				return;
			}

			rkCallback(null, values);
		});

		this.getClient()[ command ].apply(this.getClient(), params);
	}.bind(this);


	switch (this.getExportParams().type) {
		//	Export as redis type.
		case 'redis':
			return function(err, type) {
				var type2PrintSetCommand = {
					string: 'SET',
					set: 'SADD',
					zset: 'ZADD',
					list: 'RPUSH'
				};

				if (!data) {
					data = '';
				}

				ReadKey(key, type, function(err, value) {
					if (err) {
						callback(err);
						return;
					}

					var command = type2PrintSetCommand[ type ];

					if (_.isArray(value)) {
						_.each(value, function(item) {
							data += (item[1] && command === 'ZADD') ?
								command + ' ' + key + ' ' + item[0] + ' "' + item[1] + "\"\n" :
								command + ' ' + key + ' "' + item + "\"\n";
						});
						callback(null, data);
						return;
					}

					data += command + ' ' + key + ' "' + value + "\"\n";

					callback(null, data);
				});
			};

		//	Export as json type.
		case 'json':
			return function(err, type) {
				if (!data) {
					data = {};
				}

				ReadKey(key, type, function(err, value) {
					if (err) {
						callback(err);
						return;
					}

					if (_.isArray(value)) {
						var withoutScores = [];
						_.each(value, function(item) {
							withoutScores.push(item[1]);
						});
						value = withoutScores;
					}

					data[ key ] = value;

					callback(null, data);
				});
			};
	}
};

/**
 * Make redis dump.
 *
 * @param {Object} params
 */
RedisDump.prototype.export = function(params) {
	'use strict';

	/**
	 * @return {Object} export params
	 */
	this.getExportParams = function() {
		return params;
	};

	async.waterfall([
		/**
		 * Get keys.
		 *
		 * @param callback
		 */
		function(callback) {
			this.getClient().keys('*', callback);
		}.bind(this),

		/**
		 * Read keys.
		 *
		 * @param keys
		 * @param callback
		 */
		function(keys, callback) {
			var exportData;

			/**
			 * Read keys recursive.
			 */
			var ReadKeysRecursive = function(err, data) {
				if (err) {
					callback(err);
					return;
				}

				if (data) {
					exportData = data;
				}

				if (!keys.length) {
					callback(null, exportData);
					return;
				}

				var key = keys.pop();

				this.getClient().type(key, this.getForTypeCallback(key, exportData, ReadKeysRecursive));
			}.bind(this);

			ReadKeysRecursive();
		}.bind(this)
	], function(err, data) {
		if (!_.isFunction(params.callback)) {
			params.callback = function() {};
		}

		params.callback(err, data);
	});
};