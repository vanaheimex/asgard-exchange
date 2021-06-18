// Reading the file using default 
// fs npm package  
const fs = require("fs"); 
csv = fs.readFileSync("skip_events.csv") 
  
// Convert the data to String and 
// split it in an array 
var array = csv.toString().split("\r"); 
  
// All the rows of the CSV will be  
// converted to JSON objects which  
// will be added to result in an array 
let result = []; 
  
// The array[0] contains all the  
// header columns so we store them  
// in headers array 
let headers = array[0].split(", ") 
  
// Since headers are separated, we  
// need to traverse remaining n-1 rows.
var json = {}

for (let i = 2; i < array.length - 1; i++) { 
    // replace all the \n with nothing
    array[i] = array[i].split(['\n']).join()
    var attrs = array[i].split(',')
    var record = {
        label: attrs[5],
        category: attrs[4],
        action: attrs[2],
        thorwallet: attrs[3] ? true : false ,
        value: attrs[6] ? true : false,
        // location: attrs[1]
    }
    if (!json[record.category])
        json[record.category] = {};
    json[record.category][record.label] = record
}
fs.writeFileSync('output.json', JSON.stringify(json, null, 2))

