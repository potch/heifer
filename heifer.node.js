var _ = require('underscore');

var spawn = require('child_process').spawn;

var url = process.argv[2];

console.log(process.argv);

var doc = '';

function append(content) {
    doc += content + '\n';
}

if (!url) {

    console.log('no URL given!');

} else {

    var args = process.argv.slice(3);

    yslow(url, args, analyze);

}

function analyze(data) {

    data = JSON.parse(data);

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

    console.log(doc);
}

function header(txt) {
    return '<h1>' + txt + '</h1>';
}

function table(data, rowFunc, header) {
    var out = '<table>';
    if (header) {
        out += '<tr><th>' + header.join('</th><th>') + '</th></tr>';
    }
    data.forEach(function(row) {
        out += '<tr><td>' + rowFunc(row).join('</td><td>') + '</td></tr>';
    });
    out += '</table>';
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
