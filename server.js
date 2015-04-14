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
var q = require('q');
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
var gcm = require('node-gcm');
/**********************************************************************************************************************/

/*
// All helper methods should be written in the top of this Javascript file
*/
/**********************************************************************************************************************/

/*
This function will check if the request is authorized, it checks if the token is present or not
and also sees if the token is expired or not.
 */

function ensureauthorized(req,res,next){
    var tokenFromRequest = req.header('X-Auth');
    if(tokenFromRequest !== undefined){
        var decodedToken = jwt.decode(tokenFromRequest,secretkey);
            console.log("decoded token is, ",decodedToken);
        if(decodedToken.isMobile === undefined){
            if(decodedToken.exp > Date.now()){
                console.log("decoded token is, ",decodedToken);
                next();
            }else{
                // token is present but has expired
                res.sendStatus(401);
                console.log('Token is present but has expired');
            }
        }else{
            next();
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

/*
Constructs the single order object from suborders so that the final order can be built based on weder its for
 mobile app or morpheus
 */

function buildOrder(suborders,orderid){
    var counter=0;
    var payload = {};
    var orders = [];
    var total=0;
    var totalQuantity=0;
    for(var index=0;index<suborders.length;index++) {
        var suborder = {};
        suborder = suborders[index];
        counter = counter+1;
        total = total + suborder.orderSummary.Total;
        totalQuantity = totalQuantity + suborder.orderSummary.TotalQuantity;
        orders = orders.concat(suborder.order);
        if(counter == suborders.length){
            payload.order = orders;
            payload.orderSummary = {Total:total,TotalQuantity:totalQuantity};
            payload.orderid = orderid;
        }
    }
    return payload;
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

/*
 This URL is to obtain the orders in that particular day
 {
 "status":"pending/accepted"
 }

 */
app.post('/getOrdersForToday',ensureauthorized,function(req,res,next){
    console.log('received call to get the pending orders for today');
    var decodedToken = getDecodedXAuthTokenFromHeader(req);
    var merchantNumber = decodedToken.merchantNumber;
    var status = req.body.status;
    var date = moment().format('DD-MM-YYYY');
    SubOrder.find({status:status,merchantNumber:merchantNumber,date:date},function(err,suborders){
        if(err){
            console.log('error while obtaining logs from the server');
            res.sendStatus(500);
        }else if(suborders.length == 0){
            console.log('There are no orders to return');
            var finalPayload = [];
            res.json(finalPayload);
        }else{
            var finalPayload = [];
            var counter=0;
            for(var index=0;index<suborders.length;index++) {
                var suborder = {};
                suborder = suborders[index];
                counter = counter+1;
                var payload = {};
                var customerObject = {};
                var orderids = {};
                var customer = suborder.customer;
                customerObject.Name = customer.name;
                customerObject.PhoneNumber = customer.phoneNumber;
                customerObject.Email = customer.email;
                customerObject.customerNumber = customer.customerNumber;
                payload.CustomerDetails = customerObject;
                payload.OrderSummary = {};
                payload.OrderSummary = suborder.orderSummary;
                payload.Orders = [];
                payload.Orders = suborder.order;
                payload.TimeSent = suborder.date;
                payload.Status = suborder.status;
                orderids.suborderid = suborder.suborderid;
                orderids.orderid = suborder.orderid;
                payload.orderDetails = orderids;
                finalPayload.push(payload);
                if(counter == suborders.length){
                    res.json({payload:finalPayload});
                }
            }
        }
    });
})

/*
 This http post request is to accept the order, the details that needs to be sent are as follows
 {
 orderid:orderid,
 suborderid:suborderid,
 customerNumber:customerNumber,
 status:accept/reject
 }
 */
app.post('/acceptOrRejectSubOrder',ensureauthorized,function(req,res,next){
    console.log('received the request to accept/reject a suborder');
    var decodedToken = getDecodedXAuthTokenFromHeader(req);
    var orderid = req.body.orderid;
    var suborderid = req.body.suborderid;
    var customerNumber = req.body.customerNumber;
    var acceptOrReject = req.body.status;

    SubOrder.update({orderid:orderid,suborderid:suborderid},{status:acceptOrReject},function(err,numberAffected,raw){
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

app.post('/getTodaysBillForMorpheus',ensureauthorized,function(req,res,next){
    console.log('received request to get todays bills for morpheus');
    var date = moment().format('DD-MM-YYYY');
    Orders.find({Date:date},function(err,orders){
        if(err){
            console.log('Error while retrieving orders from DB ',err);
            res.sendStatus(500);
        }else if(orders!=null){
            console.log('Obtained orders: ',orders);
            var orderindex = 0;
            var  payload = [];
            var newpayload = [];
            var counter = 0;
            for(orderindex=0;orderindex < orders.length;orderindex++){
                SubOrder.find({suborderid:{$in:orders[counter].suborderids}},function(err,suborders){
                    var order = orders[counter];
                    var data =buildOrder(suborders,order.orderid);
                    data.customer = suborders[0].customer;
                    newpayload.push(data);
                    counter = counter+1;
                    if(counter==orders.length){
                        res.json({payload:newpayload});
                    }
                });

            }

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
        console.log('Data received from the socket and im about to register the socket with merchant number'+data.merchantNumber.merchantNumber+'with socketid: '+socket.id);
        socketToMerchantNumber[data.merchantNumber.merchantNumber] = socket.id;
    })


})

/********************************************************************************************************************/

//These are the urls for mobile app
/********************************************************************************************************************/
/*
Sending notifications to the mobile app
 */
app.post('/sendNotification',function(req,res,next){
    console.log('inside the send Notification part');
    var customerNumber = req.body.customerNumber;
    Customer.findOne({customerNumber:customerNumber},function(err,customer){
        var regId = customer.gcmRegId;
        var message = new gcm.Message({
            collapseKey: 'demo',
            delayWhileIdle: true,
            timeToLive: 3,
            data: {
                key1: 'Hello'
            }
        });
        var sender = new gcm.Sender('AIzaSyByCmHXrGS53IMCQpY6Vv_Csl0Yu7vb-P8');
        var registrationIds = [];
        //registrationIds.push('APA91bEp4ge85-_h79M8Hw0AdcGOQKapuqdTTt9GYEDXm80b2aWaV1PX20iUzEWFJ1ZpQ-Sjiw5mazwv3oEjXjoUtLHKijAP7UCzyuzmFaKSL-lpZz72-gSn5HUO79MkI_GtIzU0jx5V8YwJZ8a4mWg9S-DWdhEOZcvtW4B8jC3x6LmUYYg7Ei0');
        registrationIds.push(regId);
        sender.send(message,registrationIds,2,function(err,result){
            if(err) console.error(err);
            else    console.log(result);
        })
    })
})

/*
This is to register a gcm client so that we can send notifications to it later on.
 */

app.post('/registerForProject',function(req,res,next){
    console.log('received request to register the android client');
    var customerNumber = req.body.customerNumber;
    var regId = req.body.regId;
    Customer.update({customerNumber:customerNumber},{gcmRegId:regId},function(err,numberAffected,raw){
        if(err){
            console.log('There was an error while accepting the order, please try again');
            throw new Error('Unable to register for the project currently');
        }
        else{
            console.log('Number of rows affected is ',numberAffected);
            res.json({data:"thanks for calling me"});
            //add code to talk to android phone here to notify that his order has been accepted.
            res.json(200);
        }
    })

})
/*
 This URL is to get the final bill for that particular order
 {
 "orderid":"orderid"
 }
 */
app.post('/getBill',ensureauthorized,function(req,res,next){
    var mainorderid = req.body.orderid;
    console.log('received request to obtain bill for the particular order: ',mainorderid);
    var orderid = req.body.orderid;
    var payload = {};
    SubOrder.find({orderid:orderid},function(err,suborders){
       if(err){
           console.log('Some error while accessing the the database');
           res.sendStatus(500);
       }else if(suborders.length > 0){
           payload=buildOrder(suborders,orderid);
           payload.customer = suborders[0].customer;
           res.json({payload:payload});
       }else{
           console.log('Unable to find any order with this particular order id: ',orderid);
           res.sendStatus(404);
       }
    });

})


/*
To place an order, we need to have the following arguments
Token in the header and the following json to be sent
{
    merchantNumber:merchantNumber,
    order:order,
    orderSummary:orderSummary,
    orderid:orderid( if order id is supplied, it will append this to the current exisintg order, else it will create a new user.
}
 */
app.post('/placeOrder',function(req,res,next)//noinspection BadExpressionStatementJS
{
    var decodedToken = getDecodedXAuthTokenFromHeader(req);
    console.log('The decoded token is: ',decodedToken);
    var customerNumber = decodedToken.customerNumber;
    var merchantNumber = req.body.merchantNumber;
    var date = moment().format('DD-MM-YYYY');
    var mainorderid;
    if(req.body.orderid !== undefined){
        mainorderid = req.body.orderid;
    }else{
        mainorderid = getUniqueId(32);
    }
    console.log('obtained mainorder id is: ',mainorderid);
    Customer.findOne({customerNumber:customerNumber},function(err,customer){
        if(err){
            console.log('Unable to find this particular customer to place the order, ensure that the customer is registered');
            res.sendStatus(500);
        }
        else{
            if(req.body.orderid !== undefined){
                console.log('Appending order to the existing order as the orderid exists')
                var suborderid = getUniqueId(32);

                console.log('obtained suborder id is: ',suborderid);
                var suborder = new SubOrder({
                    merchantNumber:merchantNumber,
                    customer:customer,
                    orderid:mainorderid,
                    suborderid:suborderid,
                    status:'pending',
                    order:req.body.order,
                    orderSummary:req.body.orderSummary,
                    date:date
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
                        var orderids = {};
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
                        orderids.suborderid = suborderid;
                        orderids.orderid = mainorderid;
                        payload.orderDetails = orderids;
                        console.log('Placed order details are as follows: orderid:'+mainorderid+', suborder id: '+suborderid);
                        Orders.update({orderid:mainorderid},{"$push":{suborderids:suborderid}},function(err,numberAffected,raw){
                            if(err){
                                console.log('Error while updating the main order',err);
                                res.sendStatus(500)
                            }else if(numberAffected != 0){
                                console.log('The number of rows affected are ',numberAffected);
                                io.to(socketid).emit('placedOrder',{payload:payload});
                                res.sendStatus(200);
                            }
                        });

                    }
                })
            }else{
                console.log('As the orderid doesn exist, we are creating a new order and saving it');
                var suborderid = getUniqueId(32);
                var suborderids = [];
                suborderids.push(suborderid);
                var mainorder = new Orders({
                    merchantNumber: merchantNumber,
                    customerNumber:customerNumber,
                    Date: date,
                    orderid: mainorderid,
                    status: 'notpaid',
                    suborderids:suborderids
                });
                mainorder.save(function(err,order){
                    if(err){
                        console.log('Error while saving the order with order id: '+mainorderid);
                        res.sendStatus(500);
                    }else{
                        console.log('Successfully saved the order, now trying to save the suborder');

                        console.log('obtained suborder id is: ',suborderid);
                        var suborder = new SubOrder({
                            merchantNumber:merchantNumber,
                            customer:customer,
                            orderid:mainorderid,
                            suborderid:suborderid,
                            status:'pending',
                            order:req.body.order,
                            orderSummary:req.body.orderSummary,
                            date:date
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
                                var orderids = {};
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
                                orderids.suborderid = suborderid;
                                orderids.orderid = mainorderid;
                                payload.orderDetails = orderids;
                                console.log('Placed order details are as follows: orderid:'+order.orderid+', suborder id: '+suborderid);
                                io.to(socketid).emit('placedOrder',{payload:payload});
                                res.sendStatus(200);
                            }
                        })
                    }
                })
            }
            }

    })
})

/*
The customer details required to make the registration are
name, email address and phone number.
{
    name:name,
    email:email,
    profile:(local/facebook/google),
    userid:userid
}
 */
app.post('/registerCustomer',function(req,res,next){
    var name = req.body.name;
    var email = req.body.email;
    var profile = req.body.profile;

    Customer.findOne({email:email},function(err,customer){
        if(err){
            console.log('Error while retrieving the customer from the DB, in registerCustomer function');
            res.sendStatus(500);
        }else if(customer){
            var profileFromDB = customer.profile;
            if(profileFromDB !== profile){
                res.json({data:"User has already signed up with this email id using the profile: "+profileFromDB});
            }else{
                console.log('About to send the information back to customer');
                var objectToBeEncoded = {};
                objectToBeEncoded.name = customer.name;
                objectToBeEncoded.customerNumber = customer.customerNumber;
                objectToBeEncoded.email = customer.email;
                objectToBeEncoded.iss ='foodpipe.in';
                objectToBeEncoded.isMobile=1;
                var token = jwt.encode(objectToBeEncoded,secretkey);
                res.json({token:token,data:'Welcome'});
            }
        }else if(!customer){
            var customerNumber = getUniqueId(32);
            var newCustomer = new Customer({
                name:name,
                customerNumber:customerNumber,
                profile:profile,
                email:email,
                userid:req.body.userid
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
                    objectToBeEncoded.iss ='foodpipe.in';
                    objectToBeEncoded.exp =Date.now()+86400000;
                    objectToBeEncoded.isMobile=1;
                    console.log('A Customer has been created with the following customer ID ',customerNumber);
                    var token = jwt.encode(objectToBeEncoded,secretkey);
                    res.json({token:token,data:'Welcome'});
                }
            })
        }else{
            res.json({data:'The email address is already registered'});
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
