#!/usr/bin/env node

var _ = require('underscore');
var fs = require('fs');
var program = require('commander');
var spawn = require('child_process').spawn;

// Command line signature
program
  .version('0.0.1')
  .usage('[options] <URL or file ...>')
  .option('-u, --url', 'Analyze URL (default)')
  .option('-j, --json', 'Parse JSON output from YSlow')
  .option('-o, --out [file]', 'Path to write report to')
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
} else {
    var url = program.args[0];
    if (url) {
        yslow(url, [], analyze);
    } else {
        console.log('no input specified.');
    }
}


var doc = '';

function append(content) {
    doc += content + '\n';
}

function analyze(data) {

    try {
        data = JSON.parse(data);
    } catch (e) {
        console.log(data.substring(0,100));
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

    append('<style>table { font-family:monospace} tr { line-height: 1.4em; } tr:nth-child(2n+1) { background:#eee; } td { padding: 0 8px; }</style>');

    append(header('Resource Breakdown'));

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

    if (program.out) {
        fs.writeFile(program.out, doc, function(err) {
            if (err) throw err;
            console.log('Output written to ' + program.out);
        });
    } else {
        console.log(doc);
    }
}

function header(txt) {
    return '<h1>' + txt + '</h1>';
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

function yslow(url, args, cb) {
    var output = '';
    var error = '';

    args = ['yslow.js', '-icomps'].concat(args).concat([url]);
    var job = spawn('phantomjs', args);

    job.stdout.on('data', function(data) {
        output += data;
    });
    job.stderr.on('data', function(data) {
        error += data;
    });
    job.on('exit', function() {
        cb(output, error);
    });

}
