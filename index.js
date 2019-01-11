const express = require('express')
const app = express()
const http = require('http').Server(app)
const io = require('socket.io')(http)
const bodyParser = require('body-parser')
const session = require('express-session')
const uuidv4 = require('uuid/v4')
const shortid = require('shortid')
const MongoClient = require('mongodb').MongoClient
const ObjectID = require('mongodb').ObjectID
const path = require('path')

app.use(express.static(path.join(__dirname, '/public')))
app.use(
  bodyParser.urlencoded({
    extended: true
  })
)
app.use(
  session({
    genid: req => uuidv4(),
    secret: 'i hit my head so hard it hurts',
    resave: false,
    saveUninitialized: false
  })
)

app.set('view engine', 'pug')

app.get('/', (req, res) => {
  res.render('index', {
    title: 'WYR'
  })
})

app.post('/new_game', (req, res) => {
  req.session.playerName = req.body['player_name']
  res.redirect('/play/' + shortid.generate())
})

app.post('/join_game', (req, res) => {
  req.session.playerName = req.body['player_name']
  res.redirect('/play/' + req.body['room_number'])
})

app.get('/play/:room_number', (req, res) => {
  res.render('playing', {
    title: 'WYR: Room ' + req.params.room_number,
    player_name: req.session['playerName'],
    room_number: req.params.room_number
  })
})

io.on('connection', socket => {
  // when a new player joins a room, set the player name and emit the new player's details to everyone in the room
  socket.on('join', data => {
    socket.join(data.roomNumber)
    socket.broadcast.to(data.roomNumber).emit('player_join', {
      player_id: socket.id,
      player_name: data.playerName
    })
    socket.playerName = data.playerName
  })

  socket.on('get_question', data => {
    // get the question from the database and send out 2 to clients
    MongoClient.connect(
      'mongodb://localhost:27017/wyr',
      (err, client) => {
        if (err) throw err
        var db = client.db('wyr')
        db.collection('questions')
          .aggregate([{ $sample: { size: 2 } }])
          .toArray((err, result) => {
            if (err) throw err
            socket.emit('receive_question', result)

            io.sockets.adapter.rooms[data.roomNumber]['current_question'] =
              result[0]
            io.sockets.adapter.rooms[data.roomNumber]['next_question'] =
              result[1]
          })
      }
    )
  })

  socket.on('select_answer', data => {
    socket.selectedAnswer = data.selectedAnswer
    socket.broadcast.to(data.roomNumber).emit('player_selected_an_answer', {
      player_id: socket.id,
      selected_answer: data.selectedAnswer
    })
  })

  socket.on('get_current_room_status', data => {
    // send players' name in the same room when joined
    io.of('/')
      .in(data.roomNumber)
      .clients((error, clients) => {
        if (error) throw error

        var sameRoomPlayerStatus = clients.reduce((result, client) => {
          result[client] = {}
          result[client].player_name = io.sockets.connected[client].playerName
          result[client].selected_answer =
            io.sockets.connected[client].selectedAnswer || null
          return result
        }, {})

        socket.emit('current_room_status', {
          question:
            io.sockets.adapter.rooms[data.roomNumber]['current_question'],
          currentPlayers: sameRoomPlayerStatus,
          nextQuestion:
            io.sockets.adapter.rooms[data.roomNumber]['next_question']
        })
      })
  })

  socket.on('leave', data => {
    socket.broadcast.to(data.roomNumber).emit('player_leave', {
      player_id: socket.id,
      player_name: data.playerName
    })
  })

  socket.on('last_player_selected', data => {
    // set the current question to the next one and retrieve new question to be the next
    const firstQuestion =
      io.sockets.adapter.rooms[data.roomNumber]['current_question']
    const secondQuestion =
      io.sockets.adapter.rooms[data.roomNumber]['next_question']

    const firstQuestionId = new ObjectID(firstQuestion['_id'])
    const secondQuestionId = new ObjectID(secondQuestion['_id'])

    // set the next question to a new one
    MongoClient.connect(
      'mongodb://localhost:27017/wyr',
      (err, client) => {
        if (err) throw err
        var db = client.db('wyr')
        db.collection('questions')
          .aggregate([
            { $match: { _id: { $nin: [firstQuestionId, secondQuestionId] } } },
            { $sample: { size: 1 } }
          ])
          .toArray((err, result) => {
            if (err) throw err

            io.sockets.adapter.rooms[
              data.roomNumber
            ].current_question = secondQuestion
            io.sockets.adapter.rooms[data.roomNumber].next_question = result[0]

            io.of('/')
              .in(data.roomNumber)
              .emit('next_question', {
                nextQuestion: result[0]
              })
          })
      }
    )
  })
})

http.listen(3000, () => {
  console.log('The server is now open on port: 3000')
})
