const { getStore } = require("@netlify/blobs");
const fs = require("fs");
exports.handler=async(event)=>{
 const store=getStore("jin-storage");
 if(event.httpMethod==="GET"){
   let v=await store.get("items",{type:"json"});
   if(!v) v=JSON.parse(fs.readFileSync("data.json","utf8"));
   return {statusCode:200,headers:{"content-type":"application/json; charset=utf-8"},body:JSON.stringify(v)};
 }
 if(event.httpMethod==="POST"){
   let v=JSON.parse(event.body||"[]"); await store.setJSON("items",v);
   return {statusCode:200,body:"ok"};
 }
 return {statusCode:405,body:"method not allowed"};
};
