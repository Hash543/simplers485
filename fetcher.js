const ModbusRTU = require("modbus-serial");
const _ = require('lodash');
const fs = require('fs');
const sd = require('silly-datetime');
// create an empty modbus client
var async = require("async");
const client = new ModbusRTU();
const client2 = new ModbusRTU();
// open connection to a serial port
const d = new Date();
const comNameMap = require("c:\\nwjs\\config\\comNameMap.js");
const now = sd.format(d, 'YYYY-MM-DD HH:mm:ss');
var today = sd.format(d, 'YYYY-MM-DD 00:00:00');
var today2 = sd.format(d , 'YYYY-MM-DD 00:05:00');
var yesterday = sd.format(d - 86400000 , 'YYYY-MM-DD 00:00:00');
const sqlite3 = require('sqlite3').verbose();
const malfunctionId = {
    2: true,
    3: true,
    16: true,
    22: true,
    30: true
};
var result = {errorObj: []};
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
sleep(10000);
client.connectRTUBuffered("COM4", { baudRate: 9600 ,parity: 'none'});
// set timeout, if slave did not reply back
client.setTimeout(800);
// list of meter's id
const wastens = {};
var res = {
            wasten: [],
            water: {
                in: {
                    total: 0,
                    moment: 0
                },
                out: {
                    total: 0,
                    moment: 0
                }
            },
            errorObj: [],
            todayTotal: 0,
            yesterdayTotal: 0,
            elecValue: 0,
            test: 321
        };
//const metersIdList = [0,6,7];

var db = new sqlite3.Database('c:\\nwjs\\water.db');
const getMetersValue = async (returnStatus) => {
    try{

        await getMeterValue(0);
        // wait 100ms before get another device
        await sleep(600);
        await getMeterValue(1);
        // wait 100ms before get another device
        await sleep(600);
    } catch(e){
        // if error, handle them here (it should not)
        returnStatus(false);
        console.log(e)
    } finally {
        // after get all data from salve repeate it again
        setImmediate(() => {
            client._port.close();
            var wastenStmt = db.prepare("INSERT INTO monitor_record(source,m_time,ph,ec,temp,malfunction) VALUES (?,?,?,?,?,?)",function(errStmt){
                if(errStmt){
                    result.errorObj.push("wastenStmt prepare err");
                }
            });
            console.log(wastens);
            for(let t =1;t<=1;t++){
                let item = comNameMap[t-1];
                console.log(t);
                wastenStmt.run([item['tno'],now,wastens[t].ph,wastens[t].ec,wastens[t].temp,0]);
            }
            wastenStmt.finalize();
            console.log("wastenStmt.finalize();");
            res.wasten = wastens;
            
            returnStatus(true);
            //getMetersValue(metersIdList);
        })
    }
}
 
const getMeterValue = async (id) => {
    try {
        var val;
        let addr =id;
        
        if(id==1){
            addr=13;
        }
        // set ID of slave
        await client.setID(addr);
        // read the 1 registers starting at address 0 (first register)

            val =  await client.readHoldingRegisters(0, 10);
            // return the value
            let dataBuf = val.buffer;
            let temp = val.data[8]/10;
            let ph = val.data[0]/100;
            let ec = val.data[6]*10;
            
            wastens[id] = {
                ph: ph,
                ec: ec,
                temp: temp
            };
        
        return val;
    } catch(e){
        console.log(e);
        // if error return -1
        return -1
    }
}
 
// start get value

async.series({
    one: function(callback) {
        getMetersValue(function(status){
            callback(null,status);
        });
    },
    two: async function(callback){
        await client2.connectRTUBuffered("COM3", { baudRate: 9600 ,parity: 'none'});//水訊號
        // set timeout, if slave did not reply back
        client2.setTimeout(800);
        try{
            let readval;
            // set ID of slave
            await client2.setID(14);
            let d1 =  await client2.readHoldingRegisters(4, 2);
            let d2 =  await client2.readHoldingRegisters(0, 2);
            console.log("d1");
            console.log(d1);
            client2._port.close();
            complete = true;
            var total = _.round((d1.data[0]+(d1.data[1]*65536))/100 , 2);
            var moment = _.round((d2.data[0]+(d2.data[1]*65536))/100 , 2);
            res.water.out={
                total: total,
                moment: moment
            }
            callback(null,true);
            
        } catch(e){
            // if error, handle them here (it should not)
            client2._port.close();
            callback(null,false);

            console.log(e)
        } finally {
            // after get all data from salve repeate it again
            //callback(null,false);
        }
    }
}, function(err, results) {
    //db start
    db.get("select out_total from water_record where record_time>=? and record_time <= ? order by record_time desc limit 1 ",[today,today2],function(errWater,rowWater){
        db.get("select out_total from water_record  order by record_time desc limit 1 ",function(errWater2,rowWater2){
            if(typeof(rowWater2) !="undefined" && typeof(rowWater) !="undefined"){
                res.todayTotal = rowWater2.out_total - rowWater.out_total;
                res.todayTotal = today2;
            }
        }); 
    });
    //db end
    //db start
    db.get("select out_total from water_record where record_time>=? order by record_time limit 1 ",[yesterday],function(errWater,rowWater){
        db.get("select out_total from water_record where record_time<? order by record_time desc limit 1 ",[today],function(errWater2,rowWater2){
            if(typeof(rowWater2) !="undefined" && typeof(rowWater) !="undefined"){
                res.yesterdayTotal = rowWater2.out_total - rowWater.out_total;
                res.todayTotal = today2;
            }
        }); 
    });
    //db end
    //if(res.water.in.total == 0 || res.water.out.total==0){
    if(res.water.out.total==0){
        res.test="water 0000";
        db.get("select in_total,out_total from water_record where in_total >=0 and out_total>0 order by record_time desc limit 1 ",function(errWater2,rowWater2){
            //res.todayTotal = rowWater2.out_total - rowWater.out_total;
            //res.todayTotal = today2;
            console.log(rowWater2);
            if(typeof(rowWater2) !="undefined"){
                res.water.in.total = rowWater2.in_total;
                res.water.out.total = rowWater2.out_total;
            }
        }); 
        //return false;
    }else{
        var stmt = db.prepare("INSERT INTO water_record(in_total,in_moment,out_total,out_moment,record_time) VALUES (?,?,?,?,?)",function(err1){
            if(err1){
                res.errorObj.push("stmt"+err1);
            }
        });
        stmt.run([res.water.in.total,res.water.in.moment,res.water.out.total,res.water.out.moment,now],function(err2){
            if(err2){
                res.errorObj.push("stmt"+err2);
                console.log(err2);
            }
        });
        stmt.finalize();
    }   
    console.log(res);    
    fs.writeFile('c:\\nwjs\\rs485Data.json', JSON.stringify(res), (err) => {
      if (err) throw err;
      console.log('The file has been saved!');
    });
});