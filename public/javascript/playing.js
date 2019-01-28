$(document).ready(() => {
  let game
  let socketId
  let nextQuestion
  let playerName = $('#player_name').text()
  const socket = io()

  socket.on('connect', () => {
    socketId = socket.id
  })

  let roomNumber = window.location.href.split('play/')[1]

  socket.emit('join', { roomNumber, playerName })

  window.onbeforeunload = e => {
    socket.emit('leave', { roomNumber, playerName })
  }

  socket.on('currentGameStatus', game => {
    $('#first-option').text(game.currentQuestion['option1'])
    $('#second-option').text(game.currentQuestion['option2'])
    showOptionsAndHideResult(0)
    updateProgressBar(game)
  })

  socket.on('newPlayerJoin', data => {
    addAlert('success', `${data.playerName} has joined the game.`)
    updateProgressBar(data.game)
    enableOptions()
  })

  socket.on('playerLeave', data => {
    console.log(data)
    addAlert('warning', `${data.playerName} has left the game.`)
    updateProgressBar(data.game)

    if (hasEveryoneAnswered(data.game)) { 
      disableOptions()
      hideOptionsAndShowResult(2000)
    }

  })

  socket.on('playerSelectedAnswer', game => {
    updateProgressBar(game)

    if (hasEveryoneAnswered(game)) { 
      disableOptions()
      hideOptionsAndShowResult(2000)
    }

  })

  socket.on('nextQuestion', question => {
    nextQuestion = question
    console.log(nextQuestion)
  })

  // when the user select an answer (not someone else)
  $('#options button').click(e => {
    $('#options .btn-primary').removeClass('btn-primary')
    e.target.classList.add('btn-primary')
    e.target.classList.remove('btn-light')
    let selectedAnswer = e.target.getAttribute('data-option')

    // set the result to the answer
    $('#personal-result > h1').text(selectedAnswer)
    $('#result').removeClass('bg-warning')
    $('#result').removeClass('bg-danger')

    if (selectedAnswer == 1) {
      $('#result').addClass('bg-warning')
    } else {
      $('#result').addClass('bg-danger')
    }

    socket.emit('selectAnswer', {
      roomNumber: roomNumber,
      selectedAnswer: selectedAnswer
    })

  })

  // when a user presses a next button
  $('#next-question').click(() => {
    enableOptions()
    $('#first-option').text(nextQuestion['option1'])
    $('#second-option').text(nextQuestion['option2'])
    $('#options .btn-primary').removeClass('btn-primary')
    showOptionsAndHideResult()
  })

  // flash message adding function
  function addAlert (alertClass, message, dismissable = true) {
    let div = document.createElement('div')
    const divClassList = [
      'alert',
      `alert-${alertClass}`,
      'alert-dismissible',
      'fade',
      'show',
      'm-0'
    ]
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
  function updateProgressBar (game) {
    let bar = $('#progress')
    let playerCount = totalPlayers(game)
    let playerAnswered = totalPlayerAnswered(game)
    let percent = playerAnswered/playerCount

    percent = percent * 100 + 1
    bar.attr('aria-valuenow', percent)
    bar.attr('style', `width: ${percent}%;`)
    bar.text(`${playerAnswered}/${playerCount}`)
  }

  function totalPlayers(game) {
    return Object.keys(game.players).length
  }

  function totalPlayerAnswered(game) {
    let count = 0
    for (let player in game.players) {
      if (game.players[player].selectedAnswer != null) {
        count++
      }
    }
    return count
  }

  function hasEveryoneAnswered(game) {
    return (totalPlayerAnswered(game)/totalPlayers(game)) == 1
  }

  function showOptionsAndHideResult(delay = 0) {
    setTimeout(() => {
        $('#options').slideDown(400)
        $('#result').slideUp(400)
        $('#progress-container').slideDown(400)
      }, delay)
  }

  function hideOptionsAndShowResult(delay = 0) {
      setTimeout(() => {
        $('#options').slideUp(400)
        $('#result').slideDown(400)
        $('#progress-container').slideUp(400)
      }, delay)
  }

  function enableOptions() {
    $('#options button').removeAttr('disabled')
  }

  function disableOptions() {
    $('#options button').attr('disabled', true)
  }

})
