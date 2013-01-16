var _ = require('underscore');

if (!process.stdin) {

    console.log('no input!');

} else {

    process.stdin.resume();
    process.stdin.setEncoding('utf8');

    var input = '';

    process.stdin.on('data', function (chunk) {
      input += chunk;
    });

    process.stdin.on('end', function () {
      analyze(input);
    });

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
    console.log('<style>tr { line-height: 1.4em; } tr:nth-child(2n+1) { background:#eee; }</style>');
    console.log('<table style="width: 100%;font-family:monospace">');
    console.log('<tr><th>URL<th>type<th>size');
    _.sortBy(files, 'size').reverse().forEach(function(f) {
        console.log('<tr><td>' + [f.url,f.type,f.size].join('<td>'));
    });
    console.log('</table>');
}

