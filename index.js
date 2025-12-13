let http = require('http');
let fs = require('fs');

let server = http.createServer((req, res) => {
    let url = req.url;
    if (url.split("/")[1] === "public") {
        handlePublic(url, req, res);
    }
    else {
        if (req.url === '/' && req.method === "GET") {
            let html = fs.readFileSync("./views/index.html");
            res.setHeader("Content-type", "text/html");
            res.statusCode = 200;
            res.end(html);
        }
        else if (req.url === '/driversPage.html' && req.method === "GET") {
            let html = fs.readFileSync("./views/driversPage.html");
            res.setHeader("Content-type", "text/html");
            res.statusCode = 200;
            res.end(html);
        }
        else if (req.url === '/constructorsPage.html' && req.method === "GET") {
            let html = fs.readFileSync("./views/constructorsPage.html");
            res.setHeader("Content-type", "text/html");
            res.statusCode = 200;
            res.end(html);
        }
        else {
            res.writeHead(404, {
                "content-type": "text/plain"
            });
            res.end("Page Not Found!")
        }
        
    }
})

function handlePublic(url, req, res) {
    let file = fs.readFileSync("./" + url);
    res.end(file);
}

server.listen(3000);