/**
 * Created by ykp on 1/18/2015.
 */

var db = require('../db');

var user = db.model('User',{
    fullname:String,
    email:String,
    mobile:String,
    password:String
})

module.exports = user;
