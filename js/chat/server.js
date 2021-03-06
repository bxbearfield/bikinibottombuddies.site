var express = require('express');
var https = require('https');
var fs = require('fs');
var PORT = 8080;
var mongo = require('mongodb').MongoClient,
	options = {
 		key: fs.readFileSync('/etc/letsencrypt/live/bikinibottombuddies.site/privkey.pem'),
 		cert: fs.readFileSync('/etc/letsencrypt/live/bikinibottombuddies.site/fullchain.pem'),
		ca: fs.readFileSync('/etc/letsencrypt/live/bikinibottombuddies.site/chain.pem'),
        	requestCert: true,
        	rejectUnauthorized: false
 	},
	ioClient = require('socket.io')(https.createServer(options, express).listen(PORT));
// var app = express();
//var server = http.createServer(app).listen(PORT, () => console.log(`Listening on ${PORT}`));

//var ioClient = require('socket.io')(server);

mongo.connect('mongodb://www.bikinibottombuddies.site:27017/chat',{ 
	//Connect to mongodb database 'chat '
    useNewUrlParser: true,
    useUnifiedTopology: true
  }, function(err, mgClient){
	if(err) throw err;
	console.log('MONGO CONNECTED')
	ioClient.sockets.on('connection', function(socket){
		socket.emit('setUp', 'connected user\'s room');
	});

	ioClient.of('/chat').on('connection', function(socket){
		var coll = '';
		var myRoom = '';
		var getMsgs = null;
		var sendStatus = function(s) {
			socket.emit('status', s);
		};
		//Join user's own room named after email
		socket.on('join', function(data) {
			socket.join(data.myRoom);
			myRoom = data.myRoom;
			socket.emit('setUp', 'connected user\'s room');
		});

		getMsgs = function(a,b) {
			//Set user chat db name to both names combined alphabetically
			var collName = a < b ? a+b : b+a;
			coll = mgClient.db('chat').collection(collName); //Connect to database collection and return any saved msgs
			
			//Emit all msgs in database
			coll.find().limit(1000).sort({_id: 1}).toArray(function(err, res) {
				if(err) throw err; 
				res.db = true; 
				socket.emit('output', res, true);
			});
		}

		//Listen for chat request
		socket.on('sendChatRequest', function(data) {
			socket.to(data.roomToJoin).emit('chatRequestRec', data);
		});
		
		//Chat request denied.
		socket.on('abortChat', function(data){
			socket.to(data.senderRoom).emit('abortChat', data);
		});

		//Chat request was accepted. Emit to requestor's room chat started
		socket.on('acceptChat', function(data){
			socket.to(data.senderRoom).emit('connectChat', data);
		});
		
		//Finally, join recepient's room, get db msgs
		socket.on('connectChat', function(data){
			socket.join(data.roomToJoin);
			getMsgs(data.roomToJoin, myRoom);
			socket.to(data.roomToJoin).emit('outputDbMsgs', data);
		});

		//Get db msgs. Emit connection msg to requestor only
		socket.on('outputDbMsgs', function(data){
			getMsgs(data.senderRoom, myRoom);
			socket.to(data.roomToJoin).emit('connectionStatus', data, false, false);
		});

		//Send connection msg to recipient only
		socket.on('startChat', function(data){
			socket.to(data.roomToJoin).emit('connectionStatus', data, true, false);
		});

		//Listen for input (msg sent), save to database, then emit to users
		socket.on('input', function(data) {
			var name = data.name,
				message = data.message,
				chatroom = Object.keys(socket.rooms).pop(),
				whitespace = /^\s*$/;
				
			if(whitespace.test(name) || whitespace.test(message)) {
				sendStatus('Name and message is required.');
			}else{
				coll.insertOne({name: name, message: message, myRoom}, function() {
					ioClient.of('/chat').to(chatroom).emit('output', [{...data, myRoom}]); // Emit Latest msg to ALL clients use ioClient.emit
					socket.to(chatroom).emit('clearOutputStatus', data); // Clear output status to other user
					sendStatus({message: "Message sent.", clear: true}); // Update user status to show message sent
				});
			}
		});

		socket.on('inputStatus', function(data) {
			var chatroom = Object.keys(socket.rooms).pop();
			socket.to(chatroom).emit('outputStatus', data);
		});

		socket.on('clearOutputStatus', function(){
			var chatroom = Object.keys(socket.rooms).pop();
			socket.to(chatroom).emit('clearOutputStatus');
		});

		socket.on('disconnectChat', function(data){
			var rooms = Object.keys(socket.rooms);
			
			if(rooms.length == 3) {
				var chatroom = rooms[2];
				//If requestor wants to disconnect
				ioClient.of('/chat').to(chatroom).emit('connectionStatus', data, true, true);
				socket.leave(chatroom);
			}else{
				//If recipient wants to disconnect, disconnect requestor
				socket.to(rooms[1]).emit('disconnectChat', data);
			}
		});
	});
});
