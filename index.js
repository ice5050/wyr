require('dotenv').config()

const express = require('express')
const app = express()
const http = require('http').Server(app)
const io = require('socket.io')(http)
const bodyParser = require('body-parser')
const session = require('express-session')
const uuidv4 = require('uuid/v4')
const shortid = require('shortid')
const getDb = require('./helpers/db')
const Game = require('./helpers/game')
const ObjectID = require('mongodb').ObjectID
const path = require('path')
const HTTPStatus = require('http-status-codes')

let wyrDb

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
  let roomNumber = shortid
    .generate()
    .slice(0, 4)
    .toLowerCase()
  if (req.body['player_name'] === 'managequestion') {
    res.redirect('/questions')
    return true
  }
  req.session.playerName = req.body['player_name']
  req.session.roomNumber = roomNumber
  res.redirect(`/play/${roomNumber}`)
})

app.post('/join_game', (req, res) => {
  req.session.playerName = req.body['player_name']
  req.session.roomNumber = req.body['room_number']
  res.redirect('/play/' + req.body['room_number'])
})

app.get('/play/:room_number', (req, res) => {
  res.render('playing', {
    title: 'WYR: Room ' + req.params.room_number,
    player_name: req.session['playerName'],
    room_number: req.params.room_number
  })
})

app.get('/question/add', (req, res) => {
  res.render('add_question', {
    title: 'Add New Question'
  })
})

app.post('/question/add', (req, res) => {
  wyrDb.collection('questions').insertOne({
    option1: req.body['option1'],
    option2: req.body['option2'],
    status: 'pending'
  })
  res.redirect('/question/add')
})

function getTitleByStatus (questionStatus) {
  return {
    all: 'All Questions',
    denied: 'Denied Questions',
    pending: 'Pending Questions',
    approved: 'Approved Questions'
  }[questionStatus]
}

app.get('/questions', async (req, res) => {
  try {
    let status = req.query.status || 'all'
    let path = (status == 'all') ? req.path : `${req.path}?status=${status}`
    let result = await wyrDb
      .collection('questions')
      .find(status === 'all' ? {} : { status })
      .toArray()
    res.render('question', {
      title: getTitleByStatus(status),
      questions: result,
      path: path
    })
  } catch (e) {
    res.status(HTTPStatus.NOT_FOUND)
  }
})

app.get('/question/approve/:id', async (req, res) => {
  try {
    await wyrDb
      .collection('questions')
      .updateOne(
        { _id: new ObjectID(req.params.id) },
        { $set: { status: 'approved' } },
        { upsert: false }
      )
    res.redirect(req.query['from'])
  } catch (e) {
    res.status(HTTPStatus.UNPROCESSABLE_ENTITY)
  }
})

app.get('/question/deny/:id', async (req, res) => {
  try {
    await wyrDb
      .collection('questions')
      .updateOne(
        { _id: new ObjectID(req.params.id) },
        { $set: { status: 'denied' } },
        { upsert: false }
      )
    res.redirect(req.query['from'])
  } catch (e) {
    res.status(HTTPStatus.UNPROCESSABLE_ENTITY)
  }
})

app.get('/question/remove/:id', async (req, res) => {
  try {
    await wyrDb
      .collection('questions')
      .remove({ _id: new ObjectID(req.params.id) }, { justOne: true })
    res.redirect(req.query['from'])
  } catch (e) {
    res.status(HTTPStatus.UNPROCESSABLE_ENTITY)
  }
})

io.on('connection', socket => {
  // 1. when a new player joins a room, check if the room already has a game running
  // 2. if there is no game running create a new game object, assign it to the room
  // 3. join the new player to the room
  // 4. send the new game status to joined player
  // 5. if there is a game running, add the new player to the game
  // 6. send the game status to joined player
  // 7. send the new player and game room status to everyone else

  socket.on('join', data => {
    socket.join(data.roomNumber)
    socket.playerName = data.playerName

    if (!io.sockets.adapter.rooms[data.roomNumber]['game']) {
      // 1

      wyrDb
        .collection('questions')
        .aggregate([
          { $match: { status: 'approved' } },
          { $sample: { size: 2 } }
        ])
        .toArray((err, result) => {
          if (err) throw err
          io.sockets.adapter.rooms[data.roomNumber]['game'] = new Game(
            result[0],
            result[1]
          ) // 2
          io.sockets.adapter.rooms[data.roomNumber]['game'].playerJoin({
            playerId: socket.id,
            playerName: data.playerName
          }) // 3
          socket.emit(
            'currentGameStatus',
            io.sockets.adapter.rooms[data.roomNumber]['game']
          ) // 4
        })
    } else {
      io.sockets.adapter.rooms[data.roomNumber]['game'].playerJoin({
        playerId: socket.id,
        playerName: data.playerName
      }) // 5
      socket.emit(
        'currentGameStatus',
        io.sockets.adapter.rooms[data.roomNumber]['game']
      ) // 6
    }

    socket.broadcast.to(data.roomNumber).emit('newPlayerJoin', {
      // 7
      playerId: socket.id,
      playerName: data.playerName,
      game: io.sockets.adapter.rooms[data.roomNumber]['game']
    })
  })

  socket.on('selectAnswer', data => {
    // 1. update the game of the room with new answer
    // 2. send the game status to players
    // 3. check if all players have answered
    // 4. if all players have answered, 4.1 reset all answers,  4.2 get new questions
    // 5. emit new question to current players
    io.sockets.adapter.rooms[data.roomNumber]['game'].playerSelectAnswer(
      socket.id,
      data.selectedAnswer
    ) // 1
    io.in(data.roomNumber).emit(
      'playerSelectedAnswer',
      io.sockets.adapter.rooms[data.roomNumber]['game']
    ) // 2

    if (
      io.sockets.adapter.rooms[data.roomNumber]['game'].hasEveryoneAnswered()
    ) {
      // 3
      io.sockets.adapter.rooms[data.roomNumber]['game'].resetAllAnswers() // 4.1
      io.in(data.roomNumber).emit(
        'nextQuestion',
        io.sockets.adapter.rooms[data.roomNumber]['game']
      )
      getNewQuestion(data.roomNumber, wyrDb)
    }
  })

  socket.on('leave', data => {
    // 1. update the game by removing the player from room
    // 2. send the game status to players
    // 3. check if all current players have answered
    // 4. if all players have answered, 4.1 reset all answers, 4.2 get new questions
    // 5. emit new question to current players

    try {
      // there is a case where a user leave a room after server reset, causing an error
      io.sockets.adapter.rooms[data.roomNumber]['game'].playerLeave(socket.id) // 1
      socket.broadcast.to(data.roomNumber).emit('playerLeave', {
        playerName: data.playerName,
        game: io.sockets.adapter.rooms[data.roomNumber]['game']
      }) // 2

      if (
        io.sockets.adapter.rooms[data.roomNumber]['game'].hasEveryoneAnswered()
      ) {
        // 3
        io.sockets.adapter.rooms[data.roomNumber]['game'].resetAllAnswers() // 4.1
        io.in(data.roomNumber).emit(
          'nextQuestion',
          io.sockets.adapter.rooms[data.roomNumber]['game']
        )
        getNewQuestion(data.roomNumber, wyrDb)
      }
    } catch (error) {
      console.log('A user left an empty room.')
    }
  })
})

http.listen(process.env.PORT || 8080, async () => {
  wyrDb = await getDb()
  console.log('The server is now open on port: 3000')
})

async function getNewQuestion (roomNumber, db) {
  let currentQuestionId =
    io.sockets.adapter.rooms[roomNumber]['game'].currentQuestion._id
  let nextQuestionId =
    io.sockets.adapter.rooms[roomNumber]['game'].nextQuestion._id

  db.collection('questions')
    .aggregate([
      {
        $match: {
          $and: [
            { _id: { $nin: [currentQuestionId, nextQuestionId] } },
            { status: 'approved' }
          ]
        }
      },
      { $sample: { size: 1 } }
    ])
    .toArray((err, result) => {
      if (err) throw err
      try {
        io.sockets.adapter.rooms[roomNumber]['game'].addNextQuestion(result[0])
      } catch (err) {
        console.log("A bug I'm too lazy to care")
      }
    })
}
