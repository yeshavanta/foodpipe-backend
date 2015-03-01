/**
 * Created by ykp on 1/25/2015.
 */

var db = require('../db');

var orders = db.model('Orders',{
    merchantNumber:Number,
    customerNumber:Number,
    orderid:Number,
    Date:String,
    status:String
})

module.exports = orders;
