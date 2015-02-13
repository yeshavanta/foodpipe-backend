/**
 * Created by ykp on 2/13/2015.
 */
var redis = require('redis');
var client = redis.createClient();

module.exports = client;