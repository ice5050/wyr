let Game = function(firstQuestion, secondQuestion) {
	this.currentQuestion = firstQuestion
	this.nextQuestion = secondQuestion
	this.players = {}
}

Game.prototype.playerJoin = function(player) {
	this.players[player.playerId] = {}
	this.players[player.playerId].playerName = player.playerName
	this.players[player.playerId].selectedAnswer = null
}

Game.prototype.playerLeave = function(playerId) {
	delete this.players[playerId]
}

Game.prototype.playerSelectAnswer = function(playerId, answer) {
	this.players[playerId].selectedAnswer = answer
}


Game.prototype.hasEveryoneAnswered = function() {
	for (let player in this.players) {
		if (this.players[player].selectedAnswer == null) {
			return false
		}
	}
	return true
}

Game.prototype.playerAnswered = function() {
	let playerAnsweredAmount = 0
	for (let player in this.players) {
		if (this.players[player].selectedAnswer !== null) playerAnsweredAmount += 1
	}
	return playerAnsweredAmount
}

Game.prototype.playerAmount = function() {
	return Object.keys(this.players).length
}

Game.prototype.answerProgress = function() {
	return this.playerAnswered() / this.playerAmount()
}

Game.prototype.resetAllAnswers = function() {
	for (let player in this.players) {
		this.players[player].selectedAnswer = null
	}
}

Game.prototype.addNextQuestion = function(question) {
	this.currentQuestion = this.nextQuestion
	this.nextQuestion = question
}

module.exports = Game