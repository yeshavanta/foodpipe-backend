/**
 * Created by ykp on 2/10/2015.
 */

var app = require('./server');

app.get('/trialPage',function(req,res,next){
    res.json('Welcome from another page');
})

module.exports = app
