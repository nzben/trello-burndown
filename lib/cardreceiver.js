/*
 * Trello burndown chart generator
 *
 * Author: Norbert Eder <wpfnerd+nodejs@gmail.com>
 */

var required_trello = require('trello_ex');
var errors = require('./errors');

String.prototype.trim = function() { return this.replace(/^\s\s*/, '').replace(/\s\s*$/,'');};

var CardReceiver = function(applicationKey, userToken, boardId) {
	if (!applicationKey) {
		throw new Error(errors.MISSING_APP_KEY);
	}
	if (!userToken) {
		throw new Error(errors.MISSING_USER_TOKEN);
	}
	if (!boardId) {
		throw new Error(errors.MISSING_BOARD_ID);
	}
	this.applicationKey = applicationKey;
	this.userToken = userToken;
	this.boardId = boardId;
};

/*
 * Generates Markdown output with data from trello for the given lists
 */
CardReceiver.prototype.receive = function(boards, lists, receive_callback) {
	var me = this;
	var trello = new required_trello(this.applicationKey, this.userToken);
	var releaseNotesCards = [];
	var listsToHandle = [];

	console.log(boards);

	for (var i = boards.length - 1; i >= 0; i--) {
		var currentBoardID = boards[i];

		console.log("PROCESSING BOARD: " + currentBoardID);

		// put i in a closure so we can work out when we're complete (i==0)
		(function(clsi){
			trello.getListsOnBoardByFilter(currentBoardID, 'open', function(listsError, foundLists) {
				if (listsError) {
					receive_callback(listsError);
				} else if (foundLists.indexOf("invalid id") > -1 || foundLists.indexOf("invalid key") > -1) {
					receive_callback(new Error('No lists found. This might be due to an invalid board id or access token.'));
				} else {
					try {
						lists.forEach(function (list) {
							listId = findListId(foundLists, list);
							if (listId) {
								listsToHandle.push(listId);
							}
						});
						// if closure value of i is zero, then we're ready to go!
						if(clsi==0) {
							console.log("LISTS TO HANDLE:\n" +  listsToHandle.join('\n'));
							if (listsToHandle.length > 0) {
								var index = 0;
								listsToHandle.forEach(function(list) {
									var trelloInner = new required_trello(me.applicationKey, me.userToken);
									trelloInner.getCardsForList(list, 'updateCard', function(error, cards) {
										if (cards) {
											for (var i = 0; i < cards.length; i++) {
												releaseNotesCards.push(cards[i]);
											}
										}

										index++;

										if (index === listsToHandle.length) {
											receive_callback(null, releaseNotesCards);
										}
									});
								});
							}
						}
					} catch (findError) {
						receive_callback(findError);
						return;
					}
				}
			});
		})(i)

	};
	trello = null;
};

function findListId(lists, listName) {
	for (var i = 0; i < lists.length; i++) {
		if (lists[i].name.toLowerCase().trim() === listName.toLowerCase().trim()) {
			return lists[i].id;
		}
	}
	// With the new modification to work across multiple boards, not all lists will exist in all boards
	// just return null if there is no list by this name in the board
	return null;
	//throw new Error(errors.NO_SUCH_LIST);
}

module.exports = CardReceiver;