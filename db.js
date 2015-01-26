/**
 * Created by ykp on 1/26/2015.
 */
var mongoose = require('mongoose');

mongoose.connect('mongodb://localhost/foodpipedatabase',function(){
    console.log('Connected to Mongodb to database Foodpipedatabase');
})

module.exports=mongoose