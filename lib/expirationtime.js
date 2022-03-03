function qrcodeexpirationtime(expiration){

    const dateOneObj = new Date();
    const dateTwoObj = new Date(expiration);

    if (dateOneObj > dateTwoObj) {
        return false
    }else{
        return true;
    }
}



module.exports = qrcodeexpirationtime;