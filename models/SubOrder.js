/**
 * Created by ykp on 2/24/2015.
 */

var db = require('../db');

var suborder = db.model('suborder',{
    merchantNumber:Number,
    customerNumber:Number,
    orderid:String,
    suborderid:String,
    status:String,
    order:Array,
    date:String,
    orderSummary:Object
})

module.exports = suborder;
