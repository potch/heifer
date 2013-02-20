#!/usr/bin/env node

var _ = require('underscore');
var fs = require('fs');
var program = require('commander');
var spawn = require('child_process').spawn;
var http = require('http');
var urlparse = require('url');


// Command line signature
program
  .version('0.0.2')
  .usage('[options] <URL or file ...>')
  .option('-u, --url', 'Analyze URL (default)')
  .option('-j, --json', 'Parse JSON output from YSlow')
  .option('-o, --out [file]', 'Path to write report to')
  .option('-p, --port [port]', 'Port to listen on in service mode')
  .parse(process.argv);

// --json
if (program.json) {
    (function() {
        var file = program.args[0];

        fs.readFile(file, function (err, data) {
          if (err) throw err;
          analyze(data);
        });
    })();
} else if (program.url) {
    var url = program.args[0];
    if (url) {
        yslow(url, [], analyze);
    } else {
        console.log('no input specified.');
    }
} else {
    var port = program.port || 8080;
    http.createServer(function (req, res) {
        var url = urlparse.parse(req.url, true).query.url;
        if (!url) {
            res.writeHead(200, {'Content-Type': 'text/plain'});
            res.end('Missing URL parameter\n');
        } else {
            res.writeHead(200, {'Content-Type': 'text/html'});
            yslow(url, [], analyze, res);
        }
    }).listen(port, '127.0.0.1');
    console.log('Server running at http://127.0.0.1:' + port + '/');
}


var doc = '';

function append(content) {
    doc += content + '\n';
}

function analyze(data, error, res) {

    try {
        data = JSON.parse(data);
    } catch (e) {
        throw "Data not valid JSON!";
    }

    var files = data.comps;

    files = files.map(function (f) {
        return {
            type: f.type,
            size: f.size,
            url: decodeURIComponent(f.url)
        };
    });


    doc = '';
    append('<style>table { font-family:monospace} tr { line-height: 1.4em; } tr:nth-child(2n+1) { background:#eee; } td { padding: 0 8px; }</style>');

    append(header('Page Weight Report for ' + decodeURIComponent(data.u)));

    append(header('Resource Breakdown', 2));

    var total = 0;
    var types = {};

    files.forEach(function(file) {
        total += file.size;
        if (types[file.type] === undefined) {
            types[file.type] = 0;
        }
        types[file.type] += file.size;
    });

    types = _.map(types, function(v, k) {
        return [k, v];
    });
    types = _.sortBy(types, 1).reverse();
    types.push(['total', total]);

    append(table(types, _.identity));

    append(header('Resources Loaded'));

    append(table(_.sortBy(files, 'size').reverse(), function(row) {
        return [row.url, row.type, row.size];
    }, ['URL', 'type', 'size']));

    if (program.url) {
        if (program.out) {
            fs.writeFile(program.out, doc, function(err) {
                if (err) throw err;
                console.log('Output written to ' + program.out);
            });
        } else {
            console.log(doc);
        }
    } else {
        res.end(doc);
    }
}

function header(txt, l) {
    l = l || 1
    return '<h'+l+'>' + txt + '</h'+l+'>';
}

function table(data, rowFunc, header) {
    var out = '<table>\n';
    if (header) {
        out += '<tr><th>' + header.join('</th><th>') + '</th></tr>\n';
    }
    data.forEach(function(row) {
        out += '<tr><td>' + rowFunc(row).join('</td><td>') + '</td></tr>\n';
    });
    out += '</table>\n';
    return out;
}

function yslow(url, args, cb, res) {
    var output = '';
    var error = '';

    args = [__dirname + '/yslow.js', '-icomps'].concat(args).concat([url]);
    var job = spawn('phantomjs', args);

    job.stdout.on('data', function(data) {
        output += data;
    });
    job.stderr.on('data', function(data) {
        error += data;
    });
    job.on('exit', function() {
        cb(output, error, res);
    });

}
