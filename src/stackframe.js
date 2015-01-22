function StackFrame( id, parent ) { 
    this.id = id;
    this.time = 0;
    this.parent = parent;
}

StackFrame.prototype.addTime( uSec ) { 
    this.time += uSec;
    if( this.parent ) { 
        this.parent.addTime( uSec );
    }
}

module.exports = StackFrame;
