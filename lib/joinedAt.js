const moment = require('moment');

function joinedAt(user) {
    const joinedAtTimestamp = user.joinedAt / 1000;

    const formattedJoinedAt = moment.unix(joinedAtTimestamp);

    // calculate the difference in hours between now and joinedAt
    const hoursAgo = moment().diff(formattedJoinedAt, 'hours');

    let joinedDisplay;
    if (hoursAgo < 24) {
        joinedDisplay = formattedJoinedAt.fromNow();
    } else {
        joinedDisplay = formattedJoinedAt.format('MMMM Do YYYY');
    }
    return joinedDisplay
}

module.exports = joinedAt;