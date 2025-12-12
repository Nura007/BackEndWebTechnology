let http = require('http');
let fs = require('fs');

let server = http.createServer((req, res) => {
    let url = req.url;
    if (url.split("/")[1] === "public") {
        handlePublic(url, req, res);
    }
    else {
        let html = fs.readFileSync("./index.html");
        res.setHeader("Content-type", "text/html");
        res.statusCode = 200;
        res.end(html);
    }
})

function handlePublic(url, req, res) {
    let file = fs.readFileSync("./" + url);
    res.end(file);
}

server.listen(3000);