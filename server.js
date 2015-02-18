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
var Menu = require('./models/Menu')

app.use(require('body-parser').json());
app.use(function(req,res,next){
    res.setHeader('Access-Control-Allow-Origin','*');
    res.setHeader('Access-Control-Allow-Methods','GET','POST');
    res.setHeader('Access-Control-Allow-Headers','X-Requested-With,Content-Type,Authorization,X-Auth');
    next();
});

//module.exports = app;


var secretkey = 'yeshavantagiridhar';

/**********************************************************************************************************************//*

// All helper methods should be written in the top of this Javascript file
*/
/**********************************************************************************************************************//*

/*
This function will check if the request is authorized, it checks if the token is present or not
and also sees if the token is expired or not.
 */

function ensureauthorized(req,res,next){
    var tokenFromRequest = req.header('X-Auth');
    console.log('token obtained is: ',tokenFromRequest)
    if(tokenFromRequest !== undefined){
        var decodedToken = jwt.decode(tokenFromRequest,secretkey);
        if(decodedToken.exp > Date.now()){
            console.log("decoded token is, ",decodedToken);
            next();
        }else{
            // token is present but has expired
            res.sendStatus(401);
            console.log('Token is present but has expired');
        }
    }else{
        //token is not present at all
        res.sendStatus(401);
        console.log('Token is not present in the request');
    }

}
/*
This function generates unique merchant numbers for every request
 */

function getUniqueMerchantNumber(){
    var merchantNumber = intformat(flakeidgen.next(),'dec');
    console.log('MerchantNumber for this User is: ',merchantNumber);
    return merchantNumber;
}


/*
This is the object that would be converted as a token and will be sent to Hotel owners.
 */

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

/*
This is the function that checks if the token is still valid
 */

function checkTokenStatus(req,res,next){
    console.log('Inside the checkTokenStatus');
    next();
}

function getOrdersForUser(user){

}
/*
 returns decoded token by extracting the token from header
 */
function getDecodedXAuthTokenFromHeader(req){
    var encodedXAuthToken = req.header('X-Auth');
    var decodedXAuthToken = jwt.decode(encodedXAuthToken,secretkey);
    return decodedXAuthToken;
}
/********************************************************************************************************************/
//All the URL end points should be here
/********************************************************************************************************************/

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
                    }else{
                        console.log('sending the response back')
                        res.json({token:token,data:'Congratulations, you have successfully signed up'});
                    }
                });
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
    console.log('request has been received to login: ');
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
            orderswithpayload.data = objectToBeEncoded.merchantNumber;
            res.json(orderswithpayload)
        })
    })
});

app.post('/checkTokenExpiry',ensureauthorized,function(req,res,next){
    //res.json({data:"The token is valid and is not expired"});
    res.sendStatus(200);
})

app.post('/uploadMenu',ensureauthorized,function(req,res,next){
    var decodedToken = getDecodedXAuthTokenFromHeader(req);
    var merchantNumber=decodedToken.merchantNumber;
    console.log('received request from front end to upload menu for merchant: '+merchantNumber+' and the menu is: '+JSON.stringify(req.body.menu));

    Menu.findOne({merchantNumber:merchantNumber},function(err,menu){
        if(err){
            res.sendStatus(500);
            console.log('Could not save the menu due to this error',err.message);
        }
        if(!menu){
            var menu = new Menu({
                merchantNumber:merchantNumber,
                menu:req.body.menu
            });
            menu.save(function(err,menu){
                if(err){
                    res.sendStatus(500);
                    console.log('Could not save the menu due to this error',err.message);
                }
            })
        }
        else if(menu){
            /*menu.menu = req.body.menu;
            menu.update(function(err,menu){
                if(err){
                    res.sendStatus(500);
                    console.log('Could not save the menu due to this error',err.message);
                }
            })
            res.sendStatus(200);*/
            Menu.update({merchantNumber:merchantNumber},{menu:req.body.menu},function(err,numberAffected,raw){
                if(err){
                    console.log('There was an error while updating the menu, please try again');
                    res.json(500);
                }
                else{
                    console.log('Number of rows affected is ',numberAffected);
                    res.json(200);
                }
            })
        }
    })


})

app.post('/getMenu',ensureauthorized,function(req,res,next){
    var decodedToken = getDecodedXAuthTokenFromHeader(req);
    var merchantNumber=decodedToken.merchantNumber;
    console.log('received request from front end to get menu for merchant: ',merchantNumber);
    Menu.findOne({merchantNumber:merchantNumber},function(err,menu){
        if(!menu){
            res.sendStatus(404);
            console.log('Menu does not exist or could not find it for customer with merchant number: ',merchantNumber);
        }
        if(err){
            res.sendStatus(500);
            console.log('Error occurred while retrieving menu for customer with merchant number: ',merchantNumber);
        }
        console.log('sending menu: ',menu.menu);
        res.json(menu.menu);
    })
})

/********************************************************************************************************************/

//These are the urls for mobile app
/********************************************************************************************************************/

app.post('/appLaunch',function(req,res){

})

/********************************************************************************************************************/

var server= app.listen(3000,function(){
    console.log('listening on port number,',3000);
});
var io = require('socket.io').listen(server);
var socketToMerchantNumber = {};
var activeSockets= [];

io.on('connection',function(socket){
    console.log('Certain socket connected with data');
    socket.emit('news',{hello: 'world'});

    socket.on('disconnect',function(){
        console.log('certain socket is closed');
    })

    socket.on('connectingWithMerchantNumber',function(data){
        console.log('Data received from the socket and im about to register the socket ',data.merchantNumber);
        socketToMerchantNumber[data.merchantNumber] = socket.id;
    })


})


app.post('/sendToThisMerchant',function(req,res,next){
    console.log('entered the send to this merchant')
    var merchantNumber = req.body.merchantNumber;
    var socketid = socketToMerchantNumber[merchantNumber];
    io.to(socketid).emit('messagetoyou','hello only to you');
    console.log('sending to only me');
    res.sendStatus(200);
})

