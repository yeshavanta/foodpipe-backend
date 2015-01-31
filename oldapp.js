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