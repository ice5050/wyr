$(document).ready(function() {

	var socket = io()

	$("#new-room").click(function() {

		if ($('#room-number').is(":visible")) {
			$('#room-number').slideUp(200)
		}	else	{
			$('#room-number').attr('style', 'display: none')
		}

		$('#game-form').slideDown(200)
		$('#game-form').attr('action', '/new_game')

		$('#player_name').focus()
		
	})

	$('#join-room').click(function() {

		$('#game-form').slideDown(200)
		$('#room-number').slideDown(200)
		$('#game-form').attr('action', '/join_game')
		
		$('#player_name').focus()

	});

	$('#game-form').submit(function(e) {

		let name = $('#player_name').val()
		let roomNumber = $('#room_number').val()
		
		e.preventDefault()

		switch(e.target.getAttribute('action')) {

			case '/new_game':

				if (name) {
					$('#name-error').addClass('d-none')
					socket.emit('set_player_name', name)
					document.getElementById('game-form').submit()
				}	else	{
					$('#name-error').removeClass('d-none')
				}

				break;

			case '/join_game':

				if (name) {
					$('#name-error').addClass('d-none')
				}	else	{
					$('#name-error').removeClass('d-none')
				}

				if (roomNumber) {
					socket.emit('set_player_name', name)
					$('#room-number-error').addClass('d-none')
				}	else 	{
					$('#room-number-error').removeClass('d-none')
				}

				if (name && roomNumber) {
					e.target.submit()
				}

				break;

			default:
				throw new Error("Action url is not covered in the validation")
		}
		return false
	})
})