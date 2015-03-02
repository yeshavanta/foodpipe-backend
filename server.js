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
var app = express();
app.use(require('body-parser').json());
app.use(function(req,res,next){
    res.setHeader('Access-Control-Allow-Origin','*');
    //res.setHeader('Access-Control-Allow-Credentials','true');
    res.setHeader('Access-Control-Allow-Methods','GET','POST');
    res.setHeader('Access-Control-Allow-Headers','X-Requested-With,Content-Type,Authorization,X-Auth');
    next();
});
app.use('/mock',  express.static(__dirname + '/mock'));
var jwt = require('jwt-simple');

var _ = require('lodash');
var bcrypt = require('bcrypt');
var HotelProfile  = require('./models/hotelprofile')
var Orders = require('./models/orders')
var FlakeID = require('flake-idgen')
var flakeidgen = new FlakeID();
var intformat = require('biguint-format')
var Menu = require('./models/Menu');
var moment = require('moment');
var Customer = require('./models/Customer');
var SubOrder = require('./models/SubOrder');

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
    if(tokenFromRequest !== undefined){
        var decodedToken = jwt.decode(tokenFromRequest,secretkey);
            console.log("decoded token is, ",decodedToken);
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
This function generates unique numbers, and returns 16,32,64,128 bit numbers
based on the argument passed
 */

function getUniqueId(bits){

    if(bits == 16 || bits == 32 || bits == 64){
        var number = Date.now();
        number = number & 0xffffffff;
        if(number < 0){
            number = number * -1;
        }
        return number;
    }else{
        var number = intformat(flakeidgen.next(),'dec');
        return number;
    }
}
/*
This function generates unique merchant numbers for every request - 32 bit
 */
function getUniqueMerchantNumber(){
    var merchantNumber = Date.now();
    merchantNumber = merchantNumber & 0xffffffff;
    if(merchantNumber < 0){
        merchantNumber = merchantNumber * -1;
    }
    console.log('Unique merchant number for this user is: ',merchantNumber);
    return merchantNumber;
}


/*
This is the object that would be converted as a token and will be sent to Hotel owners. after they login
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
 This is the object that would be converted as a token and will be sent to customers after they login
 */
/*
This is the function that checks if the token is still valid
 */

function checkTokenStatus(req,res,next){
    console.log('Inside the checkTokenStatus');
    next();
}
/*
This function generates a unique 64 bit number to be assigned to a merchant
 */
function getUniqueCustomerNumber(){
    var customerNumber = intformat(flakeidgen.next(),'dec');
    console.log('customerNumber for this User is: ',customerNumber);
    return customerNumber;
}
/*
 returns decoded token by extracting the token from header
 */
function getDecodedXAuthTokenFromHeader(req){
    var encodedXAuthToken = req.header('X-Auth');
    var decodedXAuthToken = jwt.decode(encodedXAuthToken,secretkey);
    return decodedXAuthToken;
}

function getCustomerDetails(customerNumber){
    Customer.findOne({customerNumber:customerNumber},function(err,customer){
        if(err){
            return 'NOTFOUND';
        }else{
            return customer;
        }
    })
}

function getCustomerObjectToEncoded(customerObject){
    var customerObjectToBeEncoded = customerObject;
    customerObjectToBeEncoded.iss='foodpipe.in';
    customerObjectToBeEncoded.exp = Date.now()+86400000;
    return customerObjectToBeEncoded;
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
                newuserobject.merchantNumber = getUniqueId(64);
                console.log('obtained the unique merchant ID: ',newuserobject.merchantNumber);
                var objectToBeEncoded = getobjectToBeEncoded(newuserobject);
                console.log('Object to be encoded: ',objectToBeEncoded.exp);
                var token = jwt.encode(objectToBeEncoded,secretkey);
                newuserobject.save(function(err,user){
                    if(err){
                        return next(err);
                    }else{
                        var payload = {};
                        payload.name = req.body.fullname;
                        payload.email = req.body.email;
                        payload.phoneNumber = req.body.mobile;
                        console.log('sending the response back')
                        res.json({token:token,data:payload});
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
            res.sendStatus(401)
        }
        bcrypt.compare(req.body.password,user.password,function(err, valid){
            if(err){
                res.json({data:'The user does not exist, please signup'});
            }
            else if(!valid){
                res.json({data:'The Username or password is not valid'});
            }else{
                var objectToBeEncoded = getobjectToBeEncoded(user);
                var token = jwt.encode(objectToBeEncoded,secretkey);
                console.log('The token obtained here is: ',token);
                var payload = {};
                payload.phoneNumber = user.mobile;
                payload.email = user.email;
                payload.name = user.fullname;
                payload.merchantNumber = objectToBeEncoded.merchantNumber;
                res.json({token:token,data:payload});
            }

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
        else if(err){
            res.sendStatus(500);
            console.log('Error occurred while retrieving menu for customer with merchant number: ',merchantNumber);
        }else{
            console.log('sending menu: ',menu.menu);
            res.json(menu.menu);
        }
    })
})


/********************************************************************************************************************/
// socket related things
/********************************************************************************************************************/


var server = app.listen(3000,function(){
    console.log('listening on port number,',3000);
});

function isSocketDisconnected(socketid){
    var sockets = [];
    sockets = io.sockets.sockets;
    if(sockets.length == 0){
        return true;
    }
    for(var i=0;i<sockets.length;i++){
        if(sockets[i].id == socketid){
            return false;
        }
    }
    return true;
}


var io = require('socket.io').listen(server);
var socketToMerchantNumber = {};


io.on('connection',function(socket){
    console.log('Certain socket connected with socketId: ',socket.id);
    socket.emit('news',{hello: 'world'});

    socket.on('disconnect',function(){
        var currentSockets = [];
        currentSockets = io.sockets.sockets;
        console.log('size of current sockets before deleting: ',currentSockets.length);
        for(var index in socketToMerchantNumber){
            var socketid = socketToMerchantNumber[index];
            if(isSocketDisconnected(socketid)){
                console.log('socket for merchant number '+index+' is being deleted '+socketid);
                delete socketToMerchantNumber[index];
            }
        }
        //console.log('size of current sockets after deleting: ',currentSockets.length);
    })

    socket.on('connectingWithMerchantNumber',function(data){
        console.log('Data received from the socket and im about to register the socket with merchant number'+data.merchantNumber+' socketid: '+socket.id);
        socketToMerchantNumber[data.merchantNumber] = socket.id;
    })


})

/********************************************************************************************************************/

//These are the urls for mobile app
/********************************************************************************************************************/
app.post('/getPendingOrdersForToday',function(req,res,next){
    var decodedToken = getDecodedXAuthTokenFromHeader(req);

})

/*
This http post request is to accept the order, the details that needs to be sent are as follows
{
    orderid:orderid,
    suborderid:suborderid,
    customerNumber:customerNumber
}
 */
app.post('/acceptSubOrder',ensureauthorized,function(req,res,next){
    var decodedToken = getDecodedXAuthTokenFromHeader(req);
    var orderid = req.body.orderid;
    var suborderid = req.body.suborderid;
    var customerNumber = req.body.customerNumber;


    SubOrder.update({orderid:orderid,suborderid:suborderid},{status:'accepted'},function(err,numberAffected,raw){
        if(err){
            console.log('There was an error while accepting the order, please try again');
            res.json(500);
        }
        else{
            console.log('Number of rows affected is ',numberAffected);
            //add code to talk to android phone here to notify that his order has been accepted.
            res.json(200);
        }
    })
})

/*
To place an order, we need to have the following arguments
Token in the header and the following json to be sent
{
    merchantNumber:merchantNumber,
    order:order,
    orderSummary:orderSummary
}
 */
app.post('/placeOrder',ensureauthorized,function(req,res,next)//noinspection BadExpressionStatementJS
{

    var decodedToken = getDecodedXAuthTokenFromHeader(req);
    console.log('The decoded token is: ',decodedToken);
    var customerNumber = req.body.customerNumber;
    var merchantNumber = req.body.merchantNumber;
    var date = moment().format('DD-MM-YYYY');
    var mainorderid = getUniqueId(32);
    console.log('obtained mainorder id is: ',mainorderid);
    var mainorder = new Orders({
        merchantNumber: merchantNumber,
        customerNumber:customerNumber,
        Date: date,
        orderid: mainorderid,
        status: 'notpaid'
    });
    mainorder.save(function(err,order){
        if(err){
            console.log('Error while saving the order with order id: '+mainorderid);
            res.sendStatus(500);
        }else{
            console.log('Successfully saved the order, now trying to save the suborder');
            var suborderid = getUniqueId(32);
            console.log('obtained suborder id is: ',suborderid);
            var suborder = new SubOrder({
                merchantNumber:merchantNumber,
                customerNumber:customerNumber,
                orderid:mainorderid,
                suborderid:suborderid,
                status:'pending',
                order:req.body.order,
                orderSummary:req.body.orderSummary
            });
            suborder.save(function(err,suborder){
                if(err){
                    console.log('Error while saving the suborder with id: '+suborderid+' for merchant: '+merchantNumber);
                    res.sendStatus(500);
                }else{
                    console.log('Constructing the payload required by morpheus for the placed order');
                    var payload= {};
                    var socketid = socketToMerchantNumber[merchantNumber];
                    var customerObject = {};
                    customerObject.Name = decodedToken.name;
                    customerObject.PhoneNumber = decodedToken.phoneNumber;
                    customerObject.Email = decodedToken.email;
                    customerObject.customerNumber = decodedToken.customerNumber;
                    payload.CustomerDetails = customerObject;
                    payload.OrderSummary = {};
                    payload.OrderSummary = req.body.orderSummary;
                    payload.Orders = [];
                    payload.Orders = req.body.order;
                    payload.TimeSent = moment().format('DD-MM-YYYY');
                    payload.Status = 'Unpaid';
                    //console.log('Placed order details are as follows: orderid:'+order.orderid+', suborder id: '+suborderid);
                    io.to(socketid).emit('placedOrder',{payload:payload});
                    res.sendStatus(200);
                }
            })
        }
    })
})
/*
The request must have the following format:
{
    merchantNumber:merchantNumber,
    orderid:orderid,
    order:order ( this is an array ),
    orderSummary:orderSummary
}
 */
app.post('/appendToMainOrder',ensureauthorized,function(req,res){
    var decodedToken = getDecodedXAuthTokenFromHeader(req);
    var merchantNumber = req.body.merchantNumber;
    var customerNumber = decodedToken.customerNumber;
    var suborderid = getUniqueMerchantNumber();
    var date = moment().format('DD-MM-YYYY');

    var suborder = new SubOrder({
        merchantNumber:merchantNumber,
        customerNumber:customerNumber,
        orderid:req.body.orderid,
        suborderid:suborderid,
        date:date,
        status:'pending',
        order:req.body.order
    })

    suborder.save(function(err,suborder){
        if(err){
            console.log('Error while saving the suborder for merchant number: '+merchantNumber+' customer number: '+customerNumber+' for main order id: '+req.body.orderid);
            res.sendStatus(500);
        }else{
            console.log('Constructing the payload required by morpheus for the placed order');
            var payload= {};
            var socketid = socketToMerchantNumber[merchantNumber];
            var customerObject = {};
            customerObject.Name = decodedToken.name;
            customerObject.PhoneNumber = decodedToken.phoneNumber;
            customerObject.Email = decodedToken.email;
            payload.CustomerDetails = customerObject;
            payload.orderSummary = req.body.orderSummary;
            payload.Orders = [];
            payload.Orders.push(req.body.order);
            payload.TimeSent = moment().format('DD-MM-YYYY');
            payload.Status = 'Unpaid';

            io.to(socketid).emit('placedOrder',{payload:payload});
            res.sendStatus(200);
        }
    })

})

/*
The customer details required to make the registration are
name, email address and phone number.
{
    name:name,
    email:email,
    phoneNumber:phoneNumber
}
 */
app.post('/registerCustomer',function(req,res,next){
    var name = req.body.name;
    var customerNumber = getUniqueId(32);
    console.log('Customer Number obtained for this user is ',customerNumber);
    var email = req.body.email;
    var phoneNumber = req.body.phoneNumber;

    Customer.findOne({phoneNumber:phoneNumber},function(err,customer){
        if(err){
            console.log('Error while retrieving the customer from the DB, in registerCustomer function');
            res.sendStatus(500);
        }else if(!customer){
            var newCustomer = new Customer({
                name:name,
                customerNumber:customerNumber,
                phoneNumber:phoneNumber,
                email:email
            });
            newCustomer.save(function(err,customer){
                if(err){
                    console.log('Error while saving the new customer to DB');
                    res.sendStatus(500);
                }else{
                    var objectToBeEncoded = {};
                    objectToBeEncoded.name = name;
                    objectToBeEncoded.customerNumber = customerNumber;
                    objectToBeEncoded.email = email;
                    objectToBeEncoded.phoneNumber = phoneNumber;
                    objectToBeEncoded.iss ='foodpipe.in';
                    objectToBeEncoded.exp =Date.now()+86400000;
                    console.log('A Customer has been created with the following customer ID ',customerNumber);
                    var token = jwt.encode(objectToBeEncoded,secretkey);
                    res.json({token:token,data:'Welcome'});
                }
            })
        }else{
            res.json({data:'The phone number is already registered'});
        }
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

/********************************************************************************************************************/






