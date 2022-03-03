var add_minutes = function (dt, minutes) {
    return new Date(dt.getTime() + minutes * 60000);
}


module.exports = add_minutes;