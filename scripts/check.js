import {readdirSync} from 'node:fs';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
const scan=dir=>readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.name.startsWith('.')||['dist','node_modules'].includes(e.name)?[]:e.isDirectory()?scan(join(dir,e.name)):e.name.endsWith('.js')?[join(dir,e.name)]:[]);
for(const file of scan('.')){const result=spawnSync(process.execPath,['--check',file],{stdio:'inherit'});if(result.status!==0)process.exit(result.status||1);}
console.log('All JavaScript files passed syntax checks.');
