$(document).ready(function() {

	var game
	var selfId
	var playerName = $('#player_name').text()
	var socket = io()

	socket.on('connect', function() {
		selfId = socket.id
	})

	var roomNumber = window.location.href.split('play/')[1]

	socket.emit('join', {roomNumber: roomNumber, playerName: playerName})
	socket.emit('get_current_room_status', {roomNumber: roomNumber})
	
	window.onbeforeunload = function(e) {
		socket.emit('leave', {roomNumber: roomNumber, playerName: playerName})
	}

	socket.on('receive_question', function(questions) {
		game.addQuestion(questions)
		$('#first-option').text(game.question['option1'])
		$('#second-option').text(game.question['option2'])
		game.showOptionsAndHideResult(0)
	})

	socket.on('next_question', function(nextQuestion) {
		console.log(nextQuestion)
	})

	socket.on('player_join', function(newPlayer) {
		game.addPlayer(newPlayer)
		addAlert('success', `${newPlayer.player_name} has joined the game.`)
		game.toggleOptions()
		updateProgressBar(game.answerProgress())
		game.showOptionsAndHideResult(0)
	})

	socket.on('player_leave', function(player) {
		addAlert('warning', `${player.player_name} has left the game.`)
		game.removePlayer(player)
		game.toggleOptions()
		updateProgressBar(game.answerProgress())
	})

	socket.on('player_selected_an_answer', function(data) {
		game.playerSelected(data.player_id, data.selected_answer)
		updateProgressBar(game.answerProgress())
	})
	
	socket.on('current_room_status', function(data) {
		game = new Game(data)
		console.log(game)
		game.toggleOptions()
		updateProgressBar(game.answerProgress())

		// get the options if they are not set yet
		if (game.question == undefined) { 
			socket.emit('get_question', {roomNumber: roomNumber})
		}	else 	{
			$('#first-option').text(game.question['option1'])
			$('#second-option').text(game.question['option2'])
			game.showOptionsAndHideResult(0)
		}
	})


	// when the user select an answer (not someone else)
	$('#options button').click(function(e) {
		$('#options .btn-primary').removeClass('btn-primary')
		e.target.classList.add('btn-primary')
		e.target.classList.remove('btn-light')
		var selectedAnswer = e.target.getAttribute('data-option')

		game.playerSelected(selfId, selectedAnswer)
		socket.emit('select_answer', {roomNumber: roomNumber, selectedAnswer: selectedAnswer})
		updateProgressBar(game.answerProgress())

		// set the result to the answer
		$('#personal-result > h1').text(selectedAnswer)
		$('#result').removeClass('bg-warning')
		$('#result').removeClass('bg-danger')

		if (selectedAnswer == 1) {
			$('#result').addClass('bg-warning')
		}	else 	{
			$('#result').addClass('bg-danger')
		}
	})

	// when a user presses a next button
	$('#next-question').click(function() {
		game.gameReset()
	})

	// flash message adding function
	function addAlert(alertClass, message, dismissable = true) {

		let div = document.createElement('div')
		divClassList = ['alert', `alert-${alertClass}`, 'alert-dismissible', 'fade', 'show', 'm-0']
		div.classList.add(...divClassList)
		div.setAttribute('role', 'alert')

		let button = document.createElement('button')
		button.setAttribute('type', 'button')
		button.setAttribute('class', 'close')
		button.setAttribute('data-dismiss', 'alert')
		button.setAttribute('aria-lable', 'Close')

		let span = document.createElement('span')
		span.setAttribute('aria-hidden', 'true')
		span.innerHTML = '&times;'

		div.innerText = message
		button.appendChild(span)
		div.appendChild(button)

		document.getElementById('alerts').appendChild(div)

	}

	// update the progress bar
	function updateProgressBar(percent) {
		let bar = $('#progress')
		percent = (percent * 100) + 1
		bar.attr('aria-valuenow', percent)
		bar.attr('style', `width: ${percent}%;`)

		bar.text(`${game.playerAnswered()}/${game.playerAmount()}`)
	}

	// the game object
	function Game(currentRoomStatus) {

		this.players = currentRoomStatus.currentPlayers
		this.question = currentRoomStatus.question
		this.nextQuestion = currentRoomStatus.nextQuestion

		this.addPlayer = function(newPlayer) {
			this.players[newPlayer.player_id] = {}
			this.players[newPlayer.player_id].player_name = newPlayer.player_name
			this.players[newPlayer.player_id].selected_answer = null
		}

		this.removePlayer = function(player) {
			delete this.players[player.player_id]
		}

		// assign the selected option to certain user and perform tasks when the last person has selected something
		this.playerSelected = function(playerId, selectedAnswer) {
			this.players[playerId].selected_answer = selectedAnswer
			this.toggleOptions()

			if (this.hasLastPlayerSelected()) { 
				this.hideOptionsAndShowResult()
			}	else 	{

			}
		}

		this.playerAmount = function() {
			return Object.keys(this.players).length
		}

		this.playerAnswered = function() {
			let numberPlayerAnswered = 0
			for (let player in this.players) {
				if (this.players[player].selected_answer != null) {
					numberPlayerAnswered += 1
				}
			}
			return numberPlayerAnswered
		}

		this.answerProgress = function() {
			progress = this.playerAnswered()/this.playerAmount()
			return progress
		}

		// check if the last player has selected (the game is still going)
		this.hasLastPlayerSelected = function() {
			for (let player in this.players) {
				if (this.players[player].selected_answer == null) {
					return false
				}
			}
			return true
		}

		// set both options to disabled if everyone has selected their option
		this.toggleOptions = function() {
			if (this.hasLastPlayerSelected()) {
				$('#options button').attr('disabled', true)
			}	else 	{
				$('#options button').removeAttr('disabled')
			}
		}

		// retrieve all the answers
		this.allAnswers = function() {
			let answers = {}
			for (let player in this.players) {
				answers[this.players[player].selected_answer] = answers[this.players[player].selected_answer] + 1 || 1
			}
			return answers
		}

		// check the answers getting punished
		this.badAnswer = function() {
			let allAnswers = this.allAnswers()
			if (allAnswers[1] == undefined) return 2
			if (allAnswers[2] == undefined) return 1
			if (allAnswers[1] > allAnswers[2]) return 2
			if (allAnswers[2] > allAnswers[1]) return 1
			return [1, 2]
		}

		this.gameReset = function() {

			for (let player in this.players) {
				this.players[player].selected_answer = null
			}

			$('#options button').removeClass('btn-primary')
			$('#options button').addClass('btn-light')
			this.toggleOptions()
			updateProgressBar(0)
		}

		this.addQuestion = function(question) {
			this.question = question[0]
			this.nextQuestion = question[1]
		}

		this.didYouLose = function() {
			return this.players[selfId].selected_answer == this.badAnswer()
		}

		this.hideOptionsAndShowResult = function(delay=1000) {
			setTimeout(function() {
				$('#options').slideUp(400)
				$('#result').slideDown(400)
				$('#progress-container').slideUp(400)
			}, delay)
		}

		this.showOptionsAndHideResult = function(delay=1000) {

			setTimeout(function() {
				$('#options').slideDown(400)
				$('#result').slideUp(400)
				$('#progress-container').slideDown(400)
			}, delay)

		}

		this.insertNextQuestion = function() {
			$('#first-option').text(this.nextQuestion['option1'])
			$('#second-option').text(this.nextQuestion['option2'])
		}

	}
	
})