import * as fs from 'fs';
import * as path from 'path';
import * as csv from 'fast-csv';

const x: any[] = [];

fs.createReadStream(path.resolve(__dirname, 'cs.csv'))
.pipe(csv.parse())
.on('error', error => console.error(error))
.on('data', row => {
    x.push(row)
})
.on('end', (rowCount: number) => {
    fs.writeFileSync('airdrop.json', JSON.stringify(x))
    console.log(`Successfully written all the addresses to JSON. Now run "npm run airdrop"`)
})