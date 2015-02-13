/**
 * Created by ykp on 2/5/2015.
 */

var db = require('../db');

var menu = db.model('Menu',{
    merchantNumber:Number,
    menu:Object
})

module.exports = menu
