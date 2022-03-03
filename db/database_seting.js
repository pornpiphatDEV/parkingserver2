let db = require('./database');


function database_settings() {
    db.query("select * from parkdata_tables;", async (err, result) => {
        if (err) throw err;
        if (result.length === 0) {
            console.log("Seting Database table parkdata_tables");
            const parkdata_tables = await db.query(`insert into parkdata_tables(slotname,slotstelus) value("p1",0) , ("p2",0) , ("p3",0) , ("p4",0),("p5",0);`);
            const SQL_SAFE_UPDATES = await db.query(`SET SQL_SAFE_UPDATES = 0;`);

        }
    });
    db.query("select * from limit_table;", async (err, result) => {
        if (err) throw err;
        if (result.length === 0) {
            console.log("Seting Database limit_table ");
            const limit_table = await db.query(`insert into limit_table(limitbooking) value(5);`);

        }
    });
    db.query("SELECT * FROM barrier;", async (err, result) => {
        if (err) throw err;
        if (result.length === 0) {
            console.log("Seting Database barrier");
            const barrier = await db.query(`insert into barrier(status) value(0);`);
        }
    });
}

module.exports = database_settings