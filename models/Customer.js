/**
 * Created by ykp on 2/22/2015.
 */

var db = require('../db');

var Customer = db.model('Customer',{
    customerNumber:Number,
    name:String,
    email:String,
    gcmRegId:String,
    profile:String,
    userid:String
})

module.exports = Customer;
