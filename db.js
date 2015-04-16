/**
 * Created by ykp on 1/26/2015.
 */
var mongoose = require('mongoose');

var url = process.env.MONGOLAB_URI || 'mongodb://localhost/foodpipedatabase';
mongoose.connect(url);
module.exports = mongoose;