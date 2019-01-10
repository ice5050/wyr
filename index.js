var express = require('express')
var app = express()
var http = require('http').Server(app)
var io = require('socket.io')(http)
var bodyParser = require('body-parser')
var session = require('express-session')
var uuidv4 = require('uuid/v4')
var shortid = require('shortid')
var MongoClient = require('mongodb').MongoClient
var ObjectID = require('mongodb').ObjectID

app.use(express.static(__dirname + '/public'))
app.use(bodyParser.urlencoded({ extended: true }))
app.use(session({
	genid: function(req) {
		return uuidv4()
	},
	secret: 'i hit my head so hard it hurts'
}))

app.set('view engine', 'pug')

app.get('/', function(req, res) {
	res.render('index', {title: "WYR"})
})

app.post('/new_game', function(req, res) {

	req.session.playerName = req.body['player_name']
	res.redirect('/play/' + shortid.generate())

})

app.post('/join_game', function(req, res) {

	req.session.playerName = req.body['player_name']
	res.redirect('/play/' + req.body['room_number'])
	
})

app.get('/play/:room_number', function(req, res) {

	res.render('playing', {title: "WYR: Room " + req.params.room_number, player_name: req.session['playerName'], room_number: req.params.room_number})

})

io.on('connection', function(socket) {

	// when a new player joins a room, set the player name and emit the new player's details to everyone in the room
	socket.on('join', function(data) {
		socket.join(data.roomNumber)
		socket.broadcast.to(data.roomNumber).emit('player_join', {player_id: socket.id, player_name: data.playerName})
		socket.playerName = data.playerName
		
	})

	socket.on('get_question', function(data) {
		//get the question from the database and send out 2 to clients
		MongoClient.connect('mongodb://localhost:27017/wyr', function (err, client) {
			if (err) throw err
			var db = client.db('wyr')
			db.collection('questions').aggregate([{ $sample: {size: 2} }]).toArray(function (err, result) {
				if (err) throw err
				socket.emit('receive_question', result)

				io.sockets.adapter.rooms[data.roomNumber]['current_question'] = result[0]
				io.sockets.adapter.rooms[data.roomNumber]['next_question'] = result[1]
			})
		})
	})

	socket.on('select_answer', function(data) {
		socket.selectedAnswer = data.selectedAnswer
		socket.broadcast.to(data.roomNumber).emit('player_selected_an_answer', {player_id: socket.id, selected_answer: data.selectedAnswer})
	})

	socket.on('get_current_room_status', function(data) {
		// send players' name in the same room when joined
		io.of('/').in(data.roomNumber).clients((error, clients) => {
			if (error) throw error;

			var sameRoomPlayerStatus = clients.reduce(function(result, client) { 
				result[client] = {}
				result[client].player_name = io.sockets.connected[client].playerName
				result[client].selected_answer = io.sockets.connected[client].selectedAnswer || null
				return result
			}, {})
			
			socket.emit('current_room_status', {
				question: io.sockets.adapter.rooms[data.roomNumber]['current_question'],
				currentPlayers: sameRoomPlayerStatus,
				nextQuestion: io.sockets.adapter.rooms[data.roomNumber]['next_question']
			})

		})

	})

	socket.on('leave', function(data) {
		socket.broadcast.to(data.roomNumber).emit('player_leave', {player_id: socket.id, player_name: data.playerName})
	})

	socket.on('last_player_selected', function(data) {
		// set the current question to the next one and retrieve new question to be the next
		var firstQuestion = io.sockets.adapter.rooms[data.roomNumber]['current_question']
		var secondQuestion = io.sockets.adapter.rooms[data.roomNumber]['next_question']

		firstQuestionId = new ObjectID(firstQuestion['_id'])
		secondQuestionId = new ObjectID(secondQuestion['_id'])

		console.log(firstQuestionId, secondQuestionId)

		// set the next question to a new one
		MongoClient.connect('mongodb://localhost:27017/wyr', function (err, client) {
			if (err) throw err
			var db = client.db('wyr')
			db.collection('questions').aggregate([ {$sample: {size: 1}}, {$match: {_id: {$nin: [firstQuestionId, secondQuestionId]}}}]).toArray(function (err, result) {
				if (err) throw err
				console.log(result)
			})
		})

	})

})

http.listen(3000, function() {
	console.log("The server is now open on port: 3000")
})