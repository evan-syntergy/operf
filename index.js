var fs = require( 'fs' ),
    _ = require( "lodash" ),
    md5 = require('MD5'),
    exec = require('child_process').exec,
    program = require( 'commander' ),
    temp = require( 'temp' );
    
var INPUT_FILE = "c:/opentext/CS10A/logs/profile_0",
    OUTPUT_FG_FILE = "profile.svg",
    FG_TEMP_FILE = "flamedata.tmp";

temp.track();

program.version('0.0.1')
    .usage( "[options] <profile_file>" )
    .option( '-o, --output <file>', "Generator report as <file>", "report.html" )
    .option( '-d, --decode <file>', "Decode function names using <file>" )
    .option( '--flamecmd <cmd>', "path to flamegraph.pl command", "cmd /C dist\\flamegraph.pl" )
    .option( '--fgoptions <options>', "flamegraph.pl options", '--countname ms ' )
    .parse(process.argv);
    
if( !program.args.length )  {
    console.log( "Please specify a profile file to process." );
    program.help();
    return;
}

genAll( program.args[0], program.decode, program.output );

function genAll( inputFile, decodeFile, outputFile ) { 

    var tmpFile = temp.dir + "/" + OUTPUT_FG_FILE
    var stats = loadProfileFile( inputFile, decodeFile, outputFile );
    
    generateFlameGraph( stats, 
                    program.flamecmd + ' ' + program.fgoptions, 
                    tmpFile  );

    var flameGraph = fs.readFileSync( tmpFile, { encoding: 'utf8' } );
                    
    generateReport( stats, flameGraph, outputFile );
}

function td( v, cls, title ) { 
    return "<td class='" + cls + "'" + ( title ? " title='" + title + "'>": ">" ) + v + "</td>";
}

function generateReport( stats, flameGraph, htmlFile ) {
    
    var byFunction = {}, totalTime = 0;
    
    stats.forEach( function( v ) { 
        var f = byFunction[v.frame];
        
        if( !f ) { 
            byFunction[v.frame] = { func: v.func, frame: v.frame, ownTime: v.ownTime, totalTime: v.time, count: v.count };
        }
        else {
            f.ownTime += v.ownTime;
            f.totalTime += v.time;
            f.count += v.count;
        }
        
        totalTime += v.ownTime;
    } );

    var statsTable = [ "<table id='profiler'><thead><tr>", 
                    "<th class='txt'>Name</th>",
                    "<th class='num'>&#37; Time</th>",
                    "<th class='num'>Cumulative Seconds</th>",
                    "<th class='num'>Self Seconds</th>", 
                    "<th class='num'>Count</th>",
                    "<th class='num'>Self ms/Call</th>",
                    "<th class='num'>Total ms/Call</th>",
                    "</tr></thead><tbody>" ];
    
    _.each( byFunction, function( v ) { 
        var totalTimeEach = v.totalTime / v.count;
        var selfTimeEach = v.ownTime / v.count;
        var percentTime = ( v.ownTime / totalTime ) * 100.0;
    
        statsTable.push( "<tr>" 
            + td( v.func, 'txt', v.frame ) 
            + td( percentTime.toFixed( 3 ), 'num' ) 
            + td( ( v.totalTime / 1000.0 ).toFixed( 4 ), 'num' ) 
            + td( ( v.ownTime / 1000.0 ).toFixed( 4 ), 'num' ) 
            + td( v.count, 'num' ) 
            + td( selfTimeEach.toFixed( 3 ), 'num' ) 
            + td( totalTimeEach.toFixed( 3 ), 'num' ) 
            + "</tr>" );
    } );
    
    statsTable.push( "</tbody></table>" );        

    var content = [
        '<!DOCTYPE html>',
        '<html lang="en">',
        '  <head>',
        '    <meta charset="utf-8">',
        '    <meta http-equiv="X-UA-Compatible" content="IE=edge">',
        '    <meta name="viewport" content="width=device-width, initial-scale=1">',
        '    <title>OScript Profiler</title>',
        //'    <link rel="stylesheet" type="text/css" href="https://cdnjs.cloudflare.com/ajax/libs/datatables/1.10.4/css/jquery.dataTables.min.css" />',
        '    <link rel="stylesheet" type="text/css" href="https://cdn.datatables.net/plug-ins/3cfcc339e89/integration/bootstrap/3/dataTables.bootstrap.css" />',
        '    <link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/bootstrap/3.3.2/css/bootstrap.min.css">',
        '    <link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/bootstrap/3.3.2/css/bootstrap-theme.min.css">',
        '    <style>',
        '       body { padding-top:50px; } ',
        '       .num { text-align:right;white-space:nowrap; } ',
        '       .txt { text-align:left;white-space:nowrap; } ',
        '    </style>',
        '    <!--[if lt IE 9]>',
        '      <script src="https://oss.maxcdn.com/html5shiv/3.7.2/html5shiv.min.js"></script>',
        '      <script src="https://oss.maxcdn.com/respond/1.4.2/respond.min.js"></script>',
        '    <![endif]-->',
        '  </head>',
        '  <body>',
        '    <nav class="navbar navbar-inverse navbar-fixed-top">',
        '      <div class="container">',
        '        <div class="navbar-header">',
        '          <button type="button" class="navbar-toggle collapsed" data-toggle="collapse" data-target="#navbar" aria-expanded="false" aria-controls="navbar">',
        '            <span class="sr-only">Toggle navigation</span>',
        '            <span class="icon-bar">Test</span>',
        '            <span class="icon-bar">Test 2</span>',
        '            <span class="icon-bar">Test 3</span>',
        '          </button>',
        '          <a class="navbar-brand" href="#">OScript Profiler Report</a>',
        '        </div>',
        '        <div id="navbar" class="collapse navbar-collapse">',
        '          <ul class="nav navbar-nav">',
        '            <li class="active"><a id="function-stats-link" href="#stats">Function Stats</a></li>',
        '            <li><a id="flame-graph-link" href="#flamegraph">Flame Graph</a></li>',
        '          </ul>',
        '        </div><!--/.nav-collapse -->',
        '      </div>',
        '    </nav>',
        '    <div class="container">',
        '           <div id="stats">',
        '           <h1>Profiler Stats</h1>',
        statsTable.join( "\n" ),
        '           </div>',
        '           <div id="flamegraph" style="display:none">',
        '           <h1>Execution Time Flame Graph</h1>',
        flameGraph,
        '           </div>',
        '    </div><!-- /.container -->    ',
        '    <script src="https://code.jquery.com/jquery-1.11.2.min.js"></script>',
        '    <script src="https://maxcdn.bootstrapcdn.com/bootstrap/3.3.2/js/bootstrap.min.js"></script>',
        '    <script src="https://cdnjs.cloudflare.com/ajax/libs/datatables/1.10.4/js/jquery.dataTables.min.js"></script>',
        '    <script src="http://cdn.datatables.net/plug-ins/3cfcc339e89/integration/bootstrap/3/dataTables.bootstrap.js"></script>',
        '    <script>',
        '       $( "#function-stats-link" ).click( function(t) { t.preventDefault(); $( "li.active" ).removeClass( "active" ); $( "#stats" ).show(); $( "#flamegraph" ).hide(); $( this ).parent().addClass( "active" ); } );\n', 
        '       $( "#flame-graph-link" ).click( function(t) { t.preventDefault(); $( "li.active" ).removeClass( "active" );  $( "#stats" ).hide(); $( "#flamegraph" ).show(); $( this ).parent().addClass( "active" ); } );\n', 
        '       $( function() { $( "#profiler" ).DataTable(); } );\n',
        '    </script>',
        '  </body>',
        '</html>'
    ];
    
    fs.writeFileSync( htmlFile, content.join( "" ), { encoding: "utf8" } );
}

function loadProfileFile( fname, decodeFile ) {     
    var decodeData = null;

    if( decodeFile )  {
        decodeData = JSON.parse( fs.readFileSync( decodeFile, { encoding: 'utf8' } ) );
    }
    
    var data = fs.readFileSync( fname, { encoding: "utf8" } );
    return traceStacks( data, decodeData );
}

function generateFlameGraph( stats, fgCmd, destFile ) { 
    var tmpFile = temp.dir + "/" + FG_TEMP_FILE;

    var fgData = makeFlameGraphData( stats );
    fs.writeFileSync( tmpFile, fgData );
    makeFlameGraph( fgCmd, tmpFile, destFile );
    
    // remove our temp file.
    //  fs.unlinkSync( tmpFile );
}

function makeFlameGraphData( stats ) { 
    return stats.map( function( v ) { 
        return [ v.stackPath, v.ownTime ].join( " " );
    } ).join( '\n' );
}

function makeFlameGraph( cmd, stackFile, outFile ) { 
    exec( cmd + ' ' + stackFile + ' > ' + outFile, function (error, stdout, stderr) {
        if( error ) console.error( stderr )
    });
}
    
function getFunctionName( funcFullPath ) { 
    
    // return the name of the object plus the name of the script (which includes the name of the script's function.)
    var parts = funcFullPath.split( "::" );

    if( parts.length > 1 ) {
        parts = parts.slice(-2);
        
        var funcNames = parts[1].split( "." );
        
        if( funcNames.length === 2 && ( funcNames[0] === funcNames[1] ) ) { 
            parts[1] = funcNames[0];
        }        
    }
    return parts.join( "::" );
}

function getParentStackID( funcStack ) {
    return getStackID( funcStack.slice( 0, -1 ) );
}

function getStackID( funcStack ) { 
    return funcStack.join( ";" );
}

function identity(n) { 
    return n;
}

function traceStacks( data, decodeData ) { 
    "use strict";
    
    var decoder = identity;
    if( decodeData ) { 
        decoder = function( v ) { return decodeData[v]; }
    }
    
    var getDisplayStack = _.memoize( function( arr ) { 
        if( !arr.length ) return "";
        else if( arr.length === 1 ) return getFunctionName( decoder( arr[arr.length - 1] ) );
        return getDisplayStack( arr.slice(0,-1) ) + ";" + getFunctionName( decoder( arr[arr.length - 1] ) );
    } );

    var stack = [],
        frameStats = {},
        lines = data.split( "\n" );
    
    lines.forEach( function( line ) { 
        var fields = line.split( "," );
        
        if( fields.length >= 3 ) { 
            var dir = fields[0],
                frame = fields[1],
                timestamp = parseInt( fields[2], 10 );
            
            if( dir === "I" ) { 
                stack.push( { name: frame, startTime: timestamp } );
            }
            else { 
                var top = stack[stack.length - 1];
                
                if( top.name === frame ) {
                    var stackPath = _.pluck( stack, "name" ),   // grab all the names on the stack
                        fullStackID = getStackID( stackPath ) // create ID for that stack

                    stack.pop();
                    
                    var elapsed = ( timestamp - top.startTime );
                    
                    if( top.startTime >= timestamp ) { 
                        console.warn( "Had to calculate timestamp overflow." );
                        elapsed = ( 2147483647 - top.startTime ) + timestamp;
                    }
                    
                    var v = frameStats[fullStackID];
                    
                    if( v ) {
                        v.time += elapsed;
                        v.count++;
                    }
                    else {
                        var decodedFrame = decoder( frame );
                        var funcDisplayName = getFunctionName( decodedFrame ),
                            parentID = getParentStackID( stackPath );
                        
                        frameStats[fullStackID] = { 
                            func: funcDisplayName, 
                            frame: decodedFrame,
                            parentID: parentID, 
                            stackPath: getDisplayStack( stackPath ),
                            time: elapsed,
                            count: 1 
                        };
                    } 
                }
                else { 
                    console.warn( "Stack pop found frame mismatch -- resetting stack." );
                    stack = [];
                }
            }
        }
    } );
    
    // start with each stacks's own time equal to its total time.
    var rtnStats = _.map( frameStats, function( v, k ) { 
        v.ownTime = v.time;
        return v;
    } );
    
    // now calculate "ownTime" by subtracting every function's time from its parent's own time.
    rtnStats.forEach( function( v ) { 
        if( v.parentID ) { 
            var p = frameStats[v.parentID];
            if( p ) { 
                p.ownTime = Math.max( p.ownTime - v.time, 0 );
            }
        }
    } );
    
    // now convert owntime and time to ms instead of microseconds...
    rtnStats.forEach( function( v ) { 
        v.ownTime /= 1000.0;
        v.time /= 1000.0;
    } );
    
    return rtnStats;
}
