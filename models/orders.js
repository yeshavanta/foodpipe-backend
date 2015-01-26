/**
 * Created by ykp on 1/25/2015.
 */

var db = require('../db');

var orders = db.model('Orders',{
    email:String,
    date:String,
    Orders:Object
})

module.exports = orders
