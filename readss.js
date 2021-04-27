const ModbusRTU = require("modbus-serial");
// create an empty modbus client
const client = new ModbusRTU();
// open connection to a serial port
//var gpio = require('rpi-gpio');
const metersIdList = [0, 1];
 
const getMetersValue = async (meters) => {
    try{

await client.connectRTUBuffered("/dev/ttyUSB0", { baudRate: 9600 });
// set timeout, if slave did not reply back
await client.setTimeout(500);
        // get value of all meters
        for(let meter of meters) {
            // output value to console
            console.log(await getMeterValue(meter));
            // wait 100ms before get another device
            await sleep(500);
    	}
    } catch(e){
        // if error, handle them here (it should not)
        console.log(e)
    } finally {
        // after get all data from salve repeate it again
        setImmediate(() => {
		    client._port.close()
        })
    }
}
 
const getMeterValue = async (id) => {
    try {
        // set ID of slave
        await client.setID(id);
        // read the 1 registers starting at address 0 (first register)
        let ssval =  await client.readHoldingRegisters(13, 1);
        let phval =  await client.readHoldingRegisters(0, 1);
        let ph = phval.data[0]/100
        let ss = ssval.data[0]
        // return the value
        var overSign = false
        if(ss>200 || ph <6|| ph >9){
            overSign =true
        }
        // gpio.setup(7, gpio.DIR_IN, readInput);
        // function readInput(err) {
        //     if (err) throw err;
        //     gpio.read(7, function(err, value) {
        //         if (err) throw err;
        //         if(value == true){
        //             if(overSign == false){
        //                 gpio.setup(7, gpio.DIR_OUT, write);
        //             }
        //             gpio.destroy(function() {
        //                 //console.log('All pins unexported');
        //             });
        //         }else{
        //             gpio.destroy(function() {
        //                 //console.log('All pins unexported');
        //             });
        //         }
        //     });
        // }
        // function write(err) {
        //     if (err) throw err;
        //     gpio.write(7, true, function(err) {
        //         if (err) throw err;
        //         console.log('Written to pin');
                
        //     });
        // }
        // gpio.setup(7, gpio.DIR_OUT, async function(err){
        //     if (err) throw err;
        //     gpio.write(7, overSign, async function(err) {
        //         if (err) throw err;
        //         //console.log('Written to pin');
        //         if(overSign == true){
        //             await sleep(10000);
        //         }
        //         gpio.destroy(function() {
        //             //console.log('All pins unexported');
        //         });
        //     });
        // });
        return JSON.stringify({ph: ph,ss: ss});
    } catch(e){
        // if error return -1
        return ''
    }
}
 
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
 
 
// start get value
getMetersValue(metersIdList);