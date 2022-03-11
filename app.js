

const express = require('express')
const app = express()
const http = require("http");

const server = http.createServer(app);
const io = require("socket.io")(server);
const bodyParser = require('body-parser')
const cors = require('cors')

app.use(cors())
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))

let timenow = require('./lib/datetime');
let add_minutes = require('./lib/add_minutes');
const port = process.env.PORT || 3001;
const db = require('./db/database')

const makeid = require('./lib/makeid')
let qrcodeexpirationtime = require('./lib/expirationtime');


app.get('/', async (req, res) => {

  let limitbooking = await db.query('select * from limit_table;');
  res.send(limitbooking)

})


io.on("connection", (socket) => {
  console.log(socket.id, "has joined");


  socket.on('join', function (data) {
    console.log(data);
  });



  socket.on("disconnect", () => {
    console.log(socket.id, 'has disconnect'); // undefined
  });
});





setInterval(async () => {
  // io.emit('clock', "Hello world from server");
 
  let parking  = await db.query(`SELECT * FROM parkdata_tables;`);

  io.emit('parking', parking);
  
}, 2000);

app.post('/booking', async (req, res) => {
  let userid = req.body.userid;
  try {
    const chekeuser = await db.query(`select * from users_table where id = '${userid}';`);
    const bookinglimit = await db.query(`select * from limit_table`);

    const chekebooking = await db.query(`select * from booking_table where users_table_id = ${userid}  and booking_status = 'รอการเข้าจอด';`);
    const chekebooking2 = await db.query(`select * from booking_table where users_table_id = ${userid}  and booking_status = 'เข้าจอด';`);
    // console.log(chekebooking);




    if (chekeuser.length === 0) {
      return res.status(401).json({
        status: 401,
        message: "no email for this system.",
      });
    }

    if (chekeuser[0].money <= 200) {
      return res.status(401).json({
        status: 401,
        message: "lower limit than we set.",
      });
    }


    if (bookinglimit[0].limitbooking <= 0) {
      return res.status(401).json({
        status: 401,
        message: "booking limit for this system.",
      });
    }

    if (chekebooking.length > 0) {
      return res.status(401).json({
        status: 401,
        message: "has already been reserved in the system.",
      });
    }





    if (chekebooking2.length > 0) {
      return res.status(401).json({
        status: 401,
        message: "have been parked in the parking.",
      });
    }



    let qrcode = makeid(10);
    let insertbooking = `insert into booking_table(booking_code,booking_status,users_table_id) values('${qrcode}' ,'รอการเข้าจอด',${userid});`;
    db.query(insertbooking, (err, result) => {
      if (err) throw err;
      db.query(`update limit_table set limitbooking = limitbooking-1 where id=1;`, async (err, result) => {
        if (err) throw err;
        await db.query(`UPDATE users_table SET money = money-20  WHERE (id = ${userid});`);
        // res.status(200).json(result);
        db.query(`select * from limit_table;`, (err, result) => {
          if (err) throw err;


          // io.emit('bookingrights2',)
          console.log(result[0].limitbooking);
          io.emit('bookingrights2', result[0].limitbooking)
          res.status(200).json(result);
        })
      });
    });
  } catch (error) {
    console.log(error.message);
    res.status(500).json({ message: error.message, status: '500' });
  }
});


app.post('/qrcodecancel', async (req, res) => {
  let qrcodeid = req.body.qrcodeid
  console.log(qrcodeid);
  try {


    bookingcheck = await db.query(`select * from booking_table where id = ${qrcodeid} and booking_status = "เข้าจอด";`);

    if (bookingcheck.length > 0) {
      res.status(401).json({ message: "You have already parked.", status: '401' });
    } else {
      await db.query(`UPDATE booking_table SET booking_status = 'ยกเลิก' WHERE (id = '${qrcodeid}');`);
      db.query(`update limit_table set limitbooking = limitbooking+1 where id=1;`, (err, result) => {
        if (err) throw err;
        db.query(`select * from limit_table;`, (err, result) => {
          if (err) throw err;
          console.log(result[0].limitbooking);
          io.emit('bookingrights2', result[0].limitbooking)
          res.status(200).json(result);
        })
      });
    }



  } catch (error) {
    console.log(error.message);
    res.status(500).json({ message: error.message, status: '500' });
  }
});





app.post('/bookingqrcode', async function (req, res) {

  let userid = req.body.userid;
  console.log(userid);
  try {


    let bookingqrcode_sql = `select * from booking_table where users_table_id = ${userid}  and booking_status = 'รอการเข้าจอด';`;
    let bookingqrcode_sql2 = `select * from booking_table where users_table_id = ${userid}  and booking_status = 'เข้าจอด';`;



    let bookingdetails = await db.query(bookingqrcode_sql);
    let bookingdetails2 = await db.query(bookingqrcode_sql2);

    if (bookingdetails2.length > 0) {
      res.status(401).json({ message: 'no reservation', status: '401' });
    }


    if (bookingdetails.length > 0) {
      let id = bookingdetails[0].id;
      let bookingtime = bookingdetails[0].TIMESTAMP;
      let expirationtime = add_minutes(bookingdetails[0].TIMESTAMP, 3);
      console.log(expirationtime);
      let qrcode_expirationtime = qrcodeexpirationtime(expirationtime);
      console.log(qrcode_expirationtime);


      if (qrcode_expirationtime) {
        res.status(200).json({
          'qrcodeid': id,
          'booking_code': bookingdetails[0].booking_code,
          'bookingtime': bookingtime,
          'expirationtime': expirationtime
        });
      } else {


        let updateqrcodeexpired = await db.query(`update booking_table set booking_status = 'หมดอายุการใช้งาน' where id=${id};`);

        db.query(`update limit_table set limitbooking = limitbooking+1 where id=1;`, (err, result) => {
          if (err) throw err;
          db.query(`select * from limit_table;`, (err, result) => {
            if (err) throw err;
            console.log(result[0].limitbooking);
            io.emit('bookingrights2', result[0].limitbooking)
            res.status(403).json(
              { message: 'This qrcode has expired.', status: '403' }
            );
          })
        });
      }


    } else {
      res.status(401).json({ message: 'no reservation', status: '401' });
    }
  } catch (error) {
    console.log(error.message);
    res.status(500).json({ message: error.message, status: '500' });
  }
});






app.post('/qrcodeexpire', async function (req, res, next) {

  let qrcodeid = req.body.qrcodeid;
  console.log(qrcodeid);
  try {
    let qrcode_incar = await db.query(`select * from booking_table where  booking_status =  'เข้าจอด' and id = '${qrcodeid}';`);
    if (qrcode_incar.length > 0) {
      res.status(200).json({ message: 'user in car ', status: '200' });
    } else {
      let updateqrcodeexpired = await db.query(`update booking_table set booking_status = 'หมดอายุการใช้งาน' where id=${qrcodeid};`);
      db.query(`update limit_table set limitbooking = limitbooking+1 where id=1;`, (err, result) => {
        if (err) throw err;
        db.query(`select * from limit_table;`, (err, result) => {
          if (err) throw err;
          console.log(result[0].limitbooking);
          io.emit('bookingrights2', result[0].limitbooking)
          res.status(403).json(
            { message: 'This qrcode has expired.', status: '403' }
          );
        })
      });

    }
  } catch (error) {
    console.log(error.message);
    res.status(500).json({ message: error.message, status: '500' });
  }
});






app.post('/bookingqrcodegenerate', async function (req, res) {
  let userid = req.body.userid;
  console.log(userid);
  try {

    let bookingqrcode_sql = `select * from booking_table where users_table_id = ${userid}  and booking_status = 'รอการเข้าจอด';`;
    let bookingqrcode_sql2 = `select * from booking_table where users_table_id = ${userid}  and booking_status = 'เข้าจอด';`;
    let bookingdetails = await db.query(bookingqrcode_sql);
    let bookingdetails2 = await db.query(bookingqrcode_sql2);

    if (bookingdetails2.length > 0) {
      return res.status(401).json({ message: 'you have parked', status: '401' });
    }


    if (bookingdetails.length > 0) {
      let id = bookingdetails[0].id;
      let bookingtime = bookingdetails[0].TIMESTAMP;
      let expirationtime = add_minutes(bookingdetails[0].TIMESTAMP, 3);
      console.log(expirationtime);
      let qrcode_expirationtime = qrcodeexpirationtime(expirationtime);
      console.log(qrcode_expirationtime);


      if (qrcode_expirationtime) {
        res.status(200).json({
          'qrcodeid': id,
          'booking_code': bookingdetails[0].booking_code,
          'bookingtime': bookingtime,
          'expirationtime': expirationtime
        });
      } else {
        let updateqrcodeexpired = await db.query(`update booking_table set booking_status = 'หมดอายุการใช้งาน' where id=${id};`);
        db.query(`update limit_table set limitbooking = limitbooking+1 where id=1;`, (err, result) => {
          if (err) throw err;
          db.query(`select * from limit_table;`, (err, result) => {
            if (err) throw err;
            console.log(result[0].limitbooking);
            io.emit('bookingrights2', result[0].limitbooking)
            res.status(403).json(
              { message: 'This qrcode has expired.', status: '403' }
            );
          })
        });
      }


    } else {
      res.status(401).json({ message: 'no reservation', status: '401' });
    }
  } catch (error) {
    console.log(error.message);
    res.status(500).json({ message: error.message, status: '500' });
  }
});






app.post('/chekbill', async function (req, res) {
  let userid = req.body.userid;

  try {
    let check_userid = await db.query(`select * from booking_table where  users_table_id = ${userid} and booking_status = 'เข้าจอด';`);

    if (check_userid.length == 0) {
      return res.status(401).json({ message: "not parking in the parking lot", status: '401' })
    }

    var date1 = new Date(check_userid[0].timeincar).getTime();
    var date2 = new Date(Date(Date.now())).getTime();

    var msec = date2 - date1;
    var mins = Math.floor(msec / 60000);
    var hrs = Math.floor(mins / 60);

    var b = 0;
    mins = mins % 60;
    if ((mins = mins % 60) > 0) {
      b = 20
    }
    var servicecharge = hrs * 20 + b;
    console.log("In hours: ", hrs + " hours, " + mins + " minutes");
    console.log(servicecharge + " บาท ");
    res.status(200).json({
      "qrcodeid": check_userid[0].id,
      "timeincar": check_userid[0].timeincar,
      "timeoutcar": new Date(Date(Date.now())),
      "hrs": hrs,
      "mins": mins,
      "servicecharge": servicecharge,
      "userid": check_userid[0].users_table_id
    });
  } catch (error) {
    console.log(error.message);
    res.status(500).json({ message: error.message, status: '500' });
  }
});

app.post('/pey', async function (req, res) {
  let qrcodeid = req.body.qrcodeid;
  let servicecharge = parseInt(req.body.servicecharge);
  let userid = req.body.userid;
  let hourincar = req.body.hourincar;
  console.log(req.body);



  console.log(`update booking_table set booking_status = 'สำเร็จ' , timeoutcar = '${timenow()}' where id = ${qrcodeid};`);

  try {
    // res.status(200).send('200');
    let usercheck = await db.query(`select * from users_table where id = ${userid};`);

    if (usercheck.length == 0) {
      return res.status(401).json({ message: 'This user does not exist in the system.', status: '401' });
    }




    if (usercheck[0].money < servicecharge) {
      return res.status(401).json({ message: 'Your balance is not enough', status: '401' });
    }

    console.log(`update booking_table set booking_status = 'สำเร็จ' , timeoutcar = '${timenow()}' where id = ${qrcodeid};`);
    let updateqrcode = await db.query(`update booking_table set booking_status = 'สำเร็จ' , timeoutcar = '${timenow()}' where id = ${qrcodeid};`);




    db.query(`update limit_table set limitbooking = limitbooking+1 where id=1;`, async (err, result) => {
      if (err) throw err;
      await db.query(`UPDATE users_table SET money = money-${servicecharge}  WHERE (id = ${userid});`);
      await db.query(`insert into bill_table(hourincar,bookingservice,servicecharge,booking_table_id)value("${hourincar}" ,20 , ${servicecharge} ,${qrcodeid});`);
      // res.status(200).json(result);

      await db.query('UPDATE barrier set status = 1 WHERE (id = 1);');
      db.query(`select * from limit_table;`, (err, result) => {
        if (err) throw err;


        // io.emit('bookingrights2',)
        console.log(result[0].limitbooking);
        io.emit('bookingrights2', result[0].limitbooking)
        res.status(200).json(result);
      })
    });


  } catch (error) {
    console.log(error.message);
    res.status(500).json({ message: error.message, status: '500' });
  }
});









server.listen(port, () => {
  console.log("server started");
});
