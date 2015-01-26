/**
 * Created by ykp on 1/18/2015.
 */
/*
Here for now consider User as Merchant, i will implement the notificaiton mechanism later

Currently assume that the worflow is like this

--> Customer orders and it comes to morpheus
--> Morpheus then sends the data and this is in turn stored in DB

functionalities:

/signin:

The moment a user ( for now user means Hotel Owner ), a token is generated with a timestamp and is returned to him

/login:

The moment a user logs in, a token is generated and also orders for him on that particular day is returned to him

/saveOrdersForMerchant:

The moment you call this url, the order you sent in a json format , it is stored in DB

Format of Json to be sent to save in server
 {
 email:String(email of the merchant or the hotel owner),
 date:String(in DD-MM-YYYY format),
 Orders:Object
 }

/getOrdersForMerchant:

The moment you call this URL, the orders for this merchant whose email, and the date you have specified will be returned.


for the last two urls please include the token in the header with key as
X-Auth

if the header is not present it will be rejected
 */

var express = require('express');
var jwt = require('jwt-simple');
var app = express();
var _ = require('lodash');
var bcrypt = require('bcrypt');
var User  = require('./models/user')
var Orders = require('./models/orders')


app.use(require('body-parser').json());
app.use(function(req,res,next){
    res.setHeader('Access-Control-Allow-Origin','*');
    res.setHeader('Access-Control-Allow-Methods','GET','POST');
    res.setHeader('Access-Control-Allow-Headers','X-Requested-With,Content-Type,Authorization');
    next();
});
var secretkey = 'yeshavantagiridhar';

/*function findUserByUsername(username){
    return _.find(users,{username:username});
}

function validateUser(user,password,cb){
    console.log('inside the post call');
    console.log(bcrypt.compareSync(password,user.password));
    bcrypt.compare(password,user.password,cb);
}

app.post('/session',function(req,res){
    console.log('inside the post call');
    var username = req.body.username;
    console.log('username obtained is: ',username);
    //TODO: validate password
    var user =  findUserByUsername(req.body.username);
    console.log('User obtained is: ',user.username)
    *//*if(!validateUser(user,req.body.password)){
        console.log('inside the if condition')
        return res.sendStatus(401);
    }
    var token = jwt.encode({username:username},secretkey);
    res.json(token);*//*

    validateUser(user,req.body.password,function(err, valid){
        console.log('inside the callback')
        if(err || !valid){
            return res.sendStatus(401);
        }
        var token = jwt.encode({username:username},secretkey);
        res.json(token);
    })
});

app.get('/user',function(req,res){
    var token = req.header('X-Auth');
    console.log(token);
    var user =  jwt.decode(token,secretkey);
    //TODO: Pull user from database
    User.findOne({username:user.username}, function(err, user){
        res.json(user)
    })
    res.json(user);
})

app.post('/user',function(req,res,next){
    var userobject = new User({username:req.body.username});
    bcrypt.hash(req.body.password, 10, function(err, hash){
        userobject.password = hash;
        userobject.save(function(err, user){
            if(err){
                throw next(err);
            }
            res.sendStatus(201)
        })
    });
})*/

/*
 The latest code starts from here.
 */


function ensureauthorized(req,res,next){
    var tokenfromrequest = req.header('X-Auth');
    console.log('token obtained is: ',tokenfromrequest)
    if(tokenfromrequest !== undefined){
        var decodedtoken = jwt.decode(tokenfromrequest,secretkey);
        if(decodedtoken.exp > Date.now()){
            console.log("decoded token is, ",decodedtoken);
            next();
        }else{
            // token is present but has expired
            res.sendStatus(401);
        }
    }else{
        //token is not present at all
        res.sendStatus(401);
    }

}

function getobjectToBeEncoded(newuserobject){
    var objectToBeEncoded = {};
    objectToBeEncoded.iss="foodpipe.in";
    objectToBeEncoded.exp=Date.now()+86400000;
    objectToBeEncoded.email=newuserobject.email;
    objectToBeEncoded.mobile=newuserobject.mobile;
    return objectToBeEncoded;
}

function getOrdersForUser(user){

}

app.post('/restrictedresource',ensureauthorized,function(req,res){
    console.log('inside the restricted resource method');
    res.sendStatus(200);
})

app.post('/signup',function(req,res,next){
    console.log('request has been received to signup: ',req.body.email);
    var newuserobject = new User({fullname:req.body.fullname,email:req.body.email,mobile:req.body.mobile});
    bcrypt.hash(req.body.password, 10, function(err, hash){
        newuserobject.password = hash;
        newuserobject.save(function(err,user){
            if(err){
                throw next(err);
            }
        });
    })
    var objectToBeEncoded = getobjectToBeEncoded(newuserobject);
    console.log('Object to be encoded: '+objectToBeEncoded.exp);
    var token = jwt.encode(objectToBeEncoded,secretkey);
    res.json(token);

})

app.post('/login',function(req,res,next){
    User.findOne({email:req.body.email},function(err, user){
        if(err){
            return next(err);
        }
        if(!user){
            return res.sendStatus(401)
        }
        bcrypt.compare(req.body.password,user.password,function(err, valid){
            if(err){
                return next(err)
            }
            if(!valid){
                return res.sendStatus(401)
            }
            var objectToBeEncoded = getobjectToBeEncoded(user);
            var token = jwt.encode(objectToBeEncoded,secretkey);
            var orderswithpayload = {};
            orderswithpayload.token =token;
            orderswithpayload.orders = getOrdersForUser(user);
            res.json(orderswithpayload)
        })
    })
});

app.post('/saveOrdersForMerchant',ensureauthorized,function(req,res,next){
    var order = new Orders({email:req.body.email,date:req.body.date,orders:req.body.orders});
    order.save(function(err,user){
        if(err){
            throw next(err);
        }
    });


});

app.post('/getOrdersForMerchant',ensureauthorized,function(req,res,next){
    Orders.find({email:req.body.email,date:req.body.date},function(err,OrdersFromDB){
        if(err){
            return next(err);
        }
        if(!OrdersFromDB){
            return res.sendStatus(401)
        }

    });
});
app.listen(3000,function(){
    console.log('listening on port number,',3000);
});