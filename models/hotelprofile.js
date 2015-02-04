/**
 * Created by ykp on 1/18/2015.
 */

var db = require('../db');

var hotelProfile = db.model('hotelProfile',{
    fullname:String,
    email:String,
    mobile:String,
    password:String,
    merchantNumber:Number
})

module.exports = hotelProfile;
