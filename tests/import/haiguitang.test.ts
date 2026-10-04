import { DatabaseSync } from 'node:sqlite';
import { expect, it } from 'vitest';
import { parseHaiguitangDb } from '../../scripts/import/parsers/haiguitangDb.js';
it('没有候选列时打印可诊断的完整表结构',()=>{
 const db=new DatabaseSync(':memory:');
 try {db.exec('CREATE TABLE unknown(x TEXT,y TEXT)');expect(()=>parseHaiguitangDb(db)).toThrow('unknown: x, y');}finally{db.close();}
});
it('正确引用特殊表名并探测大小写列名',()=>{
 const db=new DatabaseSync(':memory:');
 try {db.exec('CREATE TABLE "odd""table"(ID TEXT, TITLE TEXT, QUESTION TEXT, TRUTH TEXT); INSERT INTO "odd""table" VALUES(\'x\',\'标题\',\'问题\',\'真相\')');expect(parseHaiguitangDb(db)).toEqual([{id:'x',title:'标题',surface:'问题',bottom:'真相'}]);}finally{db.close();}
});
it('探测数据库表和候选列名', () => {
 const db = new DatabaseSync(':memory:');
 try { db.exec("CREATE TABLE metadata(x TEXT); CREATE TABLE soups(id INTEGER,name TEXT,description TEXT,solution TEXT); INSERT INTO soups VALUES(7,'标题','问题','答案');");
 expect(parseHaiguitangDb(db)).toEqual([{id:7,title:'标题',surface:'问题',bottom:'答案'}]);
 } finally { db.close(); }
});
