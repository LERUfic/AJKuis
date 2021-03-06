var listen_port = 8080;
var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var express_validator = require('express-validator');
var koneksi = require('express-myconnection'); 
var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var mysql = require('mysql');
var _ = require('underscore')._;
var Room = require('./room.js');
var connection = require ('./db');

//Load routes
var routes = require('./routes');
var index = require('./routes/index');
var users = require('./routes/users');
var admin = require('./routes/admin');

app.use(
  koneksi(mysql,{
       host:'localhost',
       user:'aguelsatria',
       password:'aswijaya',
       database:'ajkuiz'
   },'single')
);



/**
 * setting up the templating view engine
 */ 
// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/img',express.static(path.join(__dirname, 'public/images')));
app.use('/js',express.static(path.join(__dirname, 'public/javascripts')));
app.use('/css',express.static(path.join(__dirname, 'public/stylesheets')));
app.use('/font',express.static(path.join(__dirname, 'public/fonts')));

//Routing
app.get('/admin', admin.list);
app.get('/admin/add', admin.add);
app.post('/admin/add', admin.save);
app.post('/admin/delete/:soal_id', admin.delete);
app.get('/admin/edit/:soal_id', admin.edit);
app.post('/admin/edit/:soal_id', admin.save_edit);


app.use('/', index);
app.use('/users', users);
//app.use('/admin', admin);

//io.set("log level", 1);
var people = {};
var rooms = {};
var clients = [];
var allRooms = [];


function purge(s, action) {
  if (people[s.id].roomID) { //user is in a room
    var room = rooms[people[s.id].roomID]; //check which room user is in.
    if (s.id === room.owner) { //user in room and owns room
      if (action === "disconnect") {
        //io.sockets.in(people[socket.id].roomID).emit('disconnect');
        var socketids = [];
        for (var i in clients) {
          socketids.push(clients[i].id);
          if(_.contains((socketids)), room.people) {
            clients[i].leave(room.id);
          }
        }

        if(_.contains((room.people)), s.id) {
          for (var i in room.people){
            people[room.people[i]].roomID = null;
          }
        }
        room.people = _.without(room.people, s.id); //remove people from the room:people{}collection
        delete rooms[people[s.id].roomID]; //delete the room
        delete people[s.id]; //delete user from people collection
        var o = _.findWhere(clients, {'id': s.id});
        clients = _.without(clients, o);
        //socket.emit('joinServerDash');
      } 
      else {//user in room but does not own room
        if (action === "disconnect") {
          if (_.contains((room.people), s.id)) {
            var personIndex = room.people.indexOf(s.id);
            room.people.splice(personIndex, 1);
            s.leave(room.id);
          }
          delete people[s.id];
          console.log(people[s.id]);
          var o = _.findWhere(clients, {'id': s.id});
          clients = _.without(clients, o);
          //socket.emit('showFirst');
        }
      }
    }
  }
  else {
    //The user isn't in a room, but maybe he just disconnected, handle the scenario:
    if (action === "disconnect") {
      delete people[s.id];
      var o = _.findWhere(clients, {'id': s.id});
      clients = _.without(clients, o);
      //socket.emit('showFirst');
    }   
  }
}

io.on('connection', function(socket){
  socket.on("joinServerDash", function() {
    console.log("Server "+socket.id+" join to server");
    //var d = new Date();
    //var id = d.valueOf();
    var exists = true;
    while(exists){
    	var add = true;
    	var id=Math.floor(Math.random()*900)+100;
    	for(var i=0;i<=allRooms.length;i++){
  			if(allRooms[i] == id){
  				add = false;
  				console.log("acak lagi gan");
  			}
  		}
  		if(add){
  			allRooms.push(id)
  			exists = false;
  		}
    }
    var room = new Room(id, socket.id);
    rooms[id] = room;

    allRooms.push(id);

    var name = 'layar_'+id;
    people[socket.id] = {"name" : name, "roomID": id};

    room.addPerson(socket.id);
    people[socket.id].roomID = id;
    socket.join(people[socket.id].roomID);
    console.log("Server "+socket.id+" join the room "+people[socket.id].roomID);
    clients.push(socket);
    socket.emit("numberView", id);
  });

  socket.on("joinServerClient", function(name) {
    var exists = false;
    var roomID = null;

    _.find(people, function(key,value) {
    if (key.name.toLowerCase() === name.toLowerCase())
      return exists = true;
    });

    if (exists) {
      var randomNumber=Math.floor(Math.random()*1001);
      do {
        proposedName = name+randomNumber;
        _.find(people, function(key,value) {
        if (key.name.toLowerCase() === proposedName.toLowerCase())
          return exists = true;
        });
      } while (!exists);
      socket.emit("errorMsg", {msg: "The username already exists, please pick another one.", proposedName: proposedName});
    }else{
      people[socket.id] = {"name" : name, "roomID": roomID};
      clients.push(socket);
      socket.emit('showNext');
    }
    console.log("Client "+socket.id+" Username:"+name+" join to server");
  });

  socket.on("joinRoom", function(noid) {
    if (typeof people[socket.id] !== "undefined") {
      var exists = false;

      for(var i = 0; i<allRooms.length; i++){
        if(allRooms[i] == noid){
          exists = true;
          break;
        }
      }

      if(exists){
        var room = rooms[noid];
        room.addPerson(socket.id);
        people[socket.id].roomID = noid;
        socket.join(people[socket.id].roomID);
        console.log("Client "+socket.id+" Username:"+people[socket.id].name+" join room "+people[socket.id].roomID);
        socket.emit('showReady');
      }
      else{
        socket.emit("errorMsgRoom", {msg: "The room does not exists, please check your input."});
      }
    }
  });

  socket.on("displayTimer", function(counter) {
     io.in(people[socket.id].roomID).emit('showTimer',counter);
     //console.log(counter);
  });

  socket.on("disconnect", function() {
    if (typeof people[socket.id] !== "undefined") { //this handles the refresh of the name screen
      purge(socket, "disconnect");
    }
  });

  socket.on("getSoal", function(catSoal){
        //sendUserApp();
        
    queryAct = "SELECT * from soalAjkuiz where kategori_id ='"+catSoal+"'";
    console.log(queryAct);
    connection.query(queryAct, function(err, rows, fields) {
      if (!err)
      {
        //console.log(rows);
        //io.sockets.in(people[socket.id].roomID).emit('recvSoal',rows);
        socket.emit('recvSoal',rows);
      }
      else
      {
        console.log('Gagal');
      }
    });
  });

  socket.on('receiveClient', function(data){
      //console.log(data);
      socket.broadcast.to(rooms[people[socket.id].roomID].owner).emit('recvClientAns', data);
      //socket.emit('recvClientAns', data);
  });

  socket.on('debug', function(data){
      console.log(data);
  });

  socket.on('triggerNoSoal', function(noSoal, soalData){
    //console.log(soalData);
      io.in(people[socket.id].roomID).emit('recvNoSoal', noSoal, soalData);
  });

  socket.on('sendScores', function(userScore){
      //console.log("sini");
      socket.broadcast.to(people[socket.id].roomID).emit('recvScore', userScore);
      //io.sockets.in(people[socket.id].roomID).emit('recvScore', userScore);
      //socket.emit('recvScore', userScore);
  });

  socket.on('statusHubungan', function(status){
      socket.broadcast.to(people[socket.id].roomID).emit('status', status);
      //socket.emit('status', status);
  });
  socket.on('statusHubungans', function(status){
      io.emit('status', status);
  });

  socket.on("getWinner", function(data){
    for (var z=0;z < data.length;z++){
      var inputWinner = "INSERT INTO tblWinner (username, channel, urutan, score) VALUES ('"+data[z].username+"', '"+people[socket.id].roomID+"', '"+data[z].urutan+"', '"+data[z].nilai+"')";
        connection.query(inputWinner, function (err, result) {
          if (err) throw err;
          console.log("1 record inserted");
    });  
    }
  });
});


 /*socket.on('user', function(sock_id,username)
  {
      var tmp_id = '/#'+sock_id;
      for (i in clients) {
        if(clients[i].id==tmp_id)
        {
          clients[i].username=username;
           console.log('ID socket = '+clients[i].id+', with username = '+clients[i].username);
        }
      }
  });


  socket.on('disconnect', function()
  {
      var index = clients.indexOf(socket);
      if(index!=1)
      {
        clients.splice(index,1);
        console.log('Client disconnect -> id = '+ socket.id+', username');
      }
  });
  socket.on("leaveRoom", function(id) {
    var room = rooms[id];
    if (room)
      purge(socket, "leaveRoom");
  });

  socket.on("removeRoom", function(id) {
     var room = rooms[id];
     if (socket.id === room.owner) {
      purge(socket, "removeRoom");
    }
  });

  socket.on("getUserRoomId", function() {
     socket.emit('recvUserRoomId',people[socket.id].roomID);
  });*/

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
  app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
      message: err.message,
      error: err
    });
  });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
  res.status(err.status || 500);
  res.render('error', {
    message: err.message,
    error: {}
  });
});



http.listen(listen_port, function(){
  console.log('listening on *: '+listen_port);
});

module.exports = app;
