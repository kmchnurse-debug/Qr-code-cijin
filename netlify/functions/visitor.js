const { getStore } = require("@netlify/blobs");
exports.handler = async function(event) {
  try {
    const store = getStore("jin-storage");
    const currentRaw = await store.get("visitors");
    let current = parseInt(currentRaw || "0", 10);
    if (!Number.isFinite(current)) current = 0;
    if ((event.httpMethod || "GET").toUpperCase() === "GET") {
      current += 1;
      await store.set("visitors", String(current));
    }
    return {statusCode:200,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store, no-cache, must-revalidate"},body:JSON.stringify({count:current})};
  } catch (err) {
    return {statusCode:500,headers:{"content-type":"application/json; charset=utf-8"},body:JSON.stringify({error:String(err && err.message || err)})};
  }
};
