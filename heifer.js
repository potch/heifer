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
  .option('-u, --url <url>', 'Analyze URL (default)')
  .option('-j, --export-json <file>', 'Path to write JSON report to')
  .option('-h, --export-html <file>', 'Path to write HTML report to')
  .option('-p, --port <port>', 'Port to listen on in service mode')
  .parse(process.argv);

if (program.url) {
    yslow(program.url, [], analyze, null);
} else {
    var port = program.port || 8080;
    http.createServer(function (req, res) {
        var query = urlparse.parse(req.url, true).query;
        if (!query.url) {
            res.writeHead(200, {'Content-Type': 'text/plain'});
            res.end('Missing URL parameter\n');
        } else {
            var ct = query.format == 'json' ? 'application/json' : 'text/html';
            res.writeHead(200, {'Content-Type': ct});
            yslow(query.url, [], analyze, res, query.format);
        }
    }).listen(port, '0.0.0.0');
    console.log('Server running at http://0.0.0.0:' + port + '/');
}

var docJSON = {};
var docHTML = '';

function append(content) {
    docHTML += content + '\n';
}

function analyze(data, error, res) {
    try {
        data = JSON.parse(data);
    } catch (e) {
        throw 'Sorry, mate - invalid JSON!';
    }

    var files = data.comps;

    files = files.map(function (f) {
        return {
            type: f.type,
            size: f.size,
            url: decodeURIComponent(f.url)
        };
    });


    docHTML = '';
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

    var resources = _.sortBy(files, 'size').reverse();

    if (program.exportJson) {
        docJSON = JSON.stringify({
            total: _.object(types),
            resources: resources
        }, null, 2);

        (res ? res.end : console.log)(docJSON);
    }

    if (program.exportHtml) {
        append(table(types, _.identity));

        append(header('Resources Loaded'));

        append(table(resources, function(row) {
            return [row.url, row.type, row.size];
        }, ['URL', 'type', 'size']));

        (res ? res.end : console.log)(docHTML);
    }

    if (program.url) {
        if (program.exportJson) {
            fs.writeFile(program.exportJson, docJSON, function(err) {
                if (err) throw err;
                console.log('Output written to ' + program.exportJson);
            });
        }
        if (program.exportHtml) {
            fs.writeFile(program.exportHtml, docHTML, function(err) {
                if (err) throw err;
                console.log('Output written to ' + program.exportHtml);
            });
        }
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
    job.on('exit', function(code) {
        if (code !== 0) {
            console.error('Error:', 'phantomjs', args[0], 'exited:', code);
            console.error('stderr:', error || '<empty>');
        } else {
            cb(output, error, res);
        }
    });
}
