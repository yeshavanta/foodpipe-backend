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
var HotelProfile  = require('./models/hotelprofile')
var Orders = require('./models/orders')
var FlakeID = require('flake-idgen')
var flakeidgen = new FlakeID();
var intformat = require('biguint-format')

app.use(require('body-parser').json());
app.use(function(req,res,next){
    res.setHeader('Access-Control-Allow-Origin','*');
    res.setHeader('Access-Control-Allow-Methods','GET','POST');
    res.setHeader('Access-Control-Allow-Headers','X-Requested-With,Content-Type,Authorization,X-Auth');
    next();
});
var secretkey = 'yeshavantagiridhar';

/**********************************************************************************************************************/
// All helper methods should be written in the top of this Javascript file
/**********************************************************************************************************************/

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
            console.log('The token is present but has expired');
        }
    }else{
        //token is not present at all
        res.sendStatus(401);
        console.log('Token is not present in the request');
    }

}
function getUniqueMerchantNumber(){
    var merchantNumber = intformat(flakeidgen.next(),'dec');
    console.log('MerchantNumber for this User is: ',merchantNumber);
    return merchantNumber;
}
function getobjectToBeEncoded(newuserobject){
    var objectToBeEncoded = {};
    objectToBeEncoded.iss="foodpipe.in";
    objectToBeEncoded.exp=Date.now()+86400000;
    objectToBeEncoded.email=newuserobject.email;
    objectToBeEncoded.mobile=newuserobject.mobile;
    objectToBeEncoded.merchantNumber = newuserobject.merchantNumber;
    console.log('Merchant number is :',objectToBeEncoded.merchantNumber);
    return objectToBeEncoded;
}

function checkTokenStatus(req,res,next){
    console.log('Inside the checkTokenStatus');
    next();
}

function getOrdersForUser(user){

}
/**********************************************************************************************************************/
/*
    All the URL end points should be here
 */
app.post('/restrictedresource',ensureauthorized,function(req,res){
    //console.log('inside the restricted resource method');
    res.sendStatus(200);
})

app.post('/signup',function(req,res,next){
    //console.log('request has been received to signup: ',req.body.email);
    HotelProfile.findOne({email:req.body.email},function(err,user){
        if(!user){
            var newuserobject = new HotelProfile({fullname:req.body.fullname,email:req.body.email,mobile:req.body.mobile});
            bcrypt.hash(req.body.password, 10, function(err, hash){
                console.log('inside the has function');
                newuserobject.password = hash;
                newuserobject.merchantNumber = getUniqueMerchantNumber();
                console.log('obtained the unique merchant ID: ',newuserobject.merchantNumber);
                var objectToBeEncoded = getobjectToBeEncoded(newuserobject);
                console.log('Object to be encoded: ',objectToBeEncoded.exp);
                var token = jwt.encode(objectToBeEncoded,secretkey);
                newuserobject.save(function(err,user){
                    if(err){
                        return next(err);
                    }
                });
                console.log('sending the response back')
                res.json({token:token,data:'Congratulations, you have successfully signed up'});
            })

        }else if(err){
            return next(err);
        }
        else{
            res.json({data:'Email already in use, please use a different one'})
        }
    })


})

app.post('/login',function(req,res,next){
    HotelProfile.findOne({email:req.body.email},function(err, user){
        if(err){
            return next(err);
        }
        if(!user){
            return res.sendStatus(401)
        }
        bcrypt.compare(req.body.password,user.password,function(err, valid){
            if(err){
                res.json({data:'The user does not exist, please signup'});
            }
            if(!valid){
                res.json({data:'The Username or password is not valid'});
            }
            var objectToBeEncoded = getobjectToBeEncoded(user);
            var token = jwt.encode(objectToBeEncoded,secretkey);
            var orderswithpayload = {};
            orderswithpayload.token =token;
            orderswithpayload.data = 'Congratulations, you have successfully logged in';
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

app.post('/getOrdersForMerchant',ensureauthorized,checkTokenStatus,function(req,res,next){
    console.log('inside the getOrdersForMerchant function');
    var token = req.header('X-Auth');
    console.log(token);
    var object =  jwt.decode(token,secretkey);
    console.log('Obtained merchant number is: ',object.merchantNumber);
    res.json({data:"Go to hell"});
    /*Orders.find({email:req.body.email},function(err,OrdersFromDB){
        if(err){
            return next(err);
        }
        if(!OrdersFromDB){
            return res.sendStatus(401)
        }
        res.json({'data':'nothing was found'})
    });*/
});

app.post('/checkTokenExpiry',ensureauthorized,function(req,res,next){
    //res.json({data:"The token is valid and is not expired"});
    res.sendStatus(200);
})

/**********************************************************************************************************************/
//These are the urls for mobile app
/**********************************************************************************************************************/
app.post('/appLaunch',function(req,res){

})



/**********************************************************************************************************************/
app.listen(3000,function(){
    console.log('listening on port number,',3000);
});