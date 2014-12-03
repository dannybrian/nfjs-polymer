// I'm using a functional, caching, curried mixin approach derived from 
// http://javascriptweblog.wordpress.com/2011/05/31/a-fresh-look-at-javascript-mixins/.
// And, I freakin love it. It's incredibly fast, efficient with memory (since the closures
// prevent duplication of every method) and still allows named parameter arguments to be
// passed to individual calls.

/*
Function.prototype.curry = function() {
  var fn = this;
  var args = [].slice.call(arguments, 0);
  return function() {
    return fn.apply(this, args.concat([].slice.call(arguments, 0)));
  };
}
*/

'use strict';

// MIXINS


// class-manipulate-able element
var asElManip = (function () {
    function addClass (tclass) {
        return this._el.classList.add(tclass);
    }
    
    function removeClass (tclass) {
        return this._el.classList.remove(tclass);
    }
    
    function toggleClass (tclass) {
        return this._el.classList.toggle(tclass);
    }
    
    function hasClass (tclass) {
        return this._el.classList.contains(tclass);
    }
    
    return function (options) {
        this.addClass = addClass;
        this.removeClass = removeClass;
        this.toggleClass = toggleClass;
        this.hasClass = hasClass;
        return this;
    }
})();

// simple hover and press for buttons
var asButton = (function() {
  function hover (bool) {
    bool ? this.addClass('hover') : this.removeClass('hover');
  }
    
  function press (bool) {
    bool ? this.addClass('pressed') : this.removeClass('pressed');
  }
    
  function fire () {
    return this.action();
  }
    
  return function (options) {
      this.hover = hover;
      this.press = press;
      this.fire  = fire;
      // e.g. this.fire = fire.curry(options['action'])
      // requires elmanip
      return this;
  }
})(); 

// movables, stuff that can have its position set
var asMovable = (function() {
    function getPos () {
        return { x: this.x, y: this.y };
    }
    
    function setPos (x, y, now) {
        this.x = x;
        this.y = y;
        if (now) {
            this.commitPos();
        }
    }

    function commitPos () {
        // apply whatever is set for this.
        var transform =
            "translate3d(" + (this.x - beadgame.beadRadius) + "px," + (this.y - beadgame.beadRadius) + "px, 0) "
            // "translate(" + cache.posX + "px," + cache.posY + "px) "
            // + rotation
            + "scale3d(" + this.scale + "," + this.scale + ", 1)";
            // + "scale(" + cache.scale + ")";
        this._el.style.transform = transform;
        this._el.style.oTransform = transform;
        this._el.style.msTransform = transform;
        this._el.style.mozTransform = transform;
        this._el.style.webkitTransform = transform;
        //console.log(transform);
    }
    
    return function (options) {
        this.x = 0;
        this.y = 0;
        this.scale = 1;
        this.getPos = getPos;
        this.setPos = setPos;
        this.commitPos = commitPos;
        return this;
    }
})();

// draggables
var asDraggable = (function() {
    
    function touch (ev) {
        // console.log(ev);
        // put this bead at the top zindex.
        this.panning = true;
        this.repulse = 0.05;
        var ztops = document.querySelectorAll('.ztop')
        for (var i = 0; i < ztops.length; i++) {
            ztops[i].classList.remove('ztop');
        }
        this.addClass('ztop');
    }
    
    function init () {
        var self = this;
        this._ht = new Hammer(this._el);
        
        this._el.addEventListener('touchstart', function(ev) {
            self.touch(ev);
        });
        
        this._el.addEventListener('mousedown', function(ev) {
            self.touch(ev);
        });
        
        this._el.addEventListener('touchend', function(ev) {

        });
        
        this._ht.on('tap', function(ev) {
            //console.log(ev);
        });

        this._ht.on('pan', function(ev) {
            //console.log(ev);
            self.setPos(ev.center.x, ev.center.y, true);
        });
        
        this._ht.on('panend', function(ev) {
            //console.log(ev);
            self.panning = false;
            self.repulse = 0.4;
            self.setPos(ev.center.x, ev.center.y, true);
        });
    }
    
    return function (options) {
        this.touch = touch;
        this.init = init;
        return this;
    }
})(); 

// CLASSES

var Link = (function() {

    return function(options) {
    
        return this;
    }
    
})();

// Bead implements all our dragging behaviors. We need the 
// bead data itself separate in the beadgame handlers.
var Bead = (function () { 
    
    function setTimer (time) {
        
    }
    
    function show () {
        this.addClass('shown');
    }
    
    function addEdge (tobead) {
        
    }
    
    function removeEdge (tobead) {
        
    }
    
    return function(options) {
        this._type = 'bead';
        this._ht = {};

        if (!options) {
            _fatal("Bead needs an options argument.");
            //return;
        }
        if (!options['id']) {
            _fatal("Bead needs an id option.");
            //return;
        }
        if (!options['el']) {
            _fatal("Bead needs an element option.");
            return;
        }
        
        //console.log(options);

        this.setTimer = setTimer;
        this.show = show;
        this.addEdge = addEdge;
        this.removeEdge = removeEdge;
        
        this.edges = [];
        this._el = options['el'];
        this.x = options['x'];
        this.y = options['y'];
        this.newx = 0;
        this.newy = 0;
        
        this.repulse = 0.4;
        this.panning = false;
        this.commitPos();
        
        var self = this;
        setTimeout(function() {
            self.show();
        }, 1000);
        

        return this;
    }
})();

// apply mixins to Bead
asButton.call(Bead.prototype);
asElManip.call(Bead.prototype);
asMovable.call(Bead.prototype);
asDraggable.call(Bead.prototype);

// BeadList manages the beads, and also their physics.
var BeadList = function (coptions) {
    
    var self = this;
    
    this.beadsById = {};
    this.beads = [];
    this.initEnergy = 6; // initial graph energy
    var speed = 1; // how quickly things move
    var t = this.initEnergy; // current energy
    
    // k is the optimal distance between vertices
    var C;
    var k;
    
    this.optimal = function () { k = C * Math.sqrt(this.width / this.count); }
    this.cool = function () { t -= (t * t * 0.013) } // this is the cooling decay function
    this.reset = function () { t = this.initEnergy; } // reset the energy
    this.setC = function () { C = (Math.log(this.count) / 3) * (beadgame.beadRadius / 2); } // tweakable constant
    this.midx = window.innerWidth / 2;
    this.midy = window.innerHeight / 2;
    this.count = 2;
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.area = this.width * this.height;
    
    this.setArea = function () {
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.midx = window.innerWidth / 2;
        this.midy = window.innerHeight / 2;
        this.area = this.width * this.height;
        this.setC();
        this.optimal();
    };
    
    this.setCount = function (ccount) {
		// THIS CAN'T BE < 2!!
		if (ccount < 5) { ccount = 5; } // 4 keeps few beads from clumping too much.
        this.count = ccount;
		this.setC();
        this.optimal();
		//console.log("C is " + C);
        //console.log("k is " + k);
    };
    
    // repulse function
    this.repulse = function (d) {
        //console.log("k: " + k);
        return ((-(k) * -(k)) / d);
    };
    
    // alt repulse function (testing)
    this.repulse2 = function (d) {
        return ((-(k) * -(k)) / d) * 1.4;
        //return ((-k * -k) / d);
    };
    
    this.force = function (verts) {
        //console.log(verts);
        //for (var i = 0; i < this.iters; i++) {
            // repulsion: iterate for each vertex for computation
            for (var v = 0; v < verts.length; v++) {
                
				if (verts[v].ignore) { continue; }
                verts[v].newx = self.midx;
                verts[v].newy = self.midy;
               
                for (var u = 0; u < verts.length; u++) {
                    if (u != v) {
                        // console.log(u);
                        // delta = difference vector
                        var deltax = verts[v].x - verts[u].x;
                        var deltay = verts[v].y - verts[u].y;
                        var deltal = Math.sqrt((deltax * deltax) + (deltay * deltay));
                        var repulse = this.repulse(deltal) * verts[v].repulse;
                        
                        //console.log("deltal: " + deltal);
                        //console.log("repulsen: " + repulsen);
                        //if (verts[v].player === true) {
                        
                        //    verts[v].newx = ( Number(verts[v].newx) + (deltax / deltal) * this.repulse2(deltal) );
                        //    verts[v].newy = ( Number(verts[v].newy) + (deltay / deltal) * this.repulse2(deltal) );
                        //}
                        
                        //else
                        //{
                            verts[v].newx = ( Number(verts[v].newx) + (deltax / deltal) * repulse );
                            verts[v].newy = ( Number(verts[v].newy) + (deltay / deltal) * repulse );
                        //}
                        //*/
                    }
                }
            }
        //}
        
        for (var v = 0; v < verts.length; v++) {
            var deltax = verts[v].newx - verts[v].x;
            var deltay = verts[v].newy - verts[v].y;
            
            var deltal = Math.sqrt((deltax * deltax) + (deltay * deltay));
            
            if (deltal != 0) {
                verts[v].newx = ( Number(verts[v].x) + (deltax / deltal * speed) * Math.min( deltal, t ) );
                verts[v].newy = ( Number(verts[v].y) + (deltay / deltal * speed) * Math.min( deltal, t ) );

                verts[v].newx = Math.min(this.width - 1, Math.max(1, verts[v].newx));
                verts[v].newy = Math.min(this.height - 1, Math.max(1, verts[v].newy));
                
                if (!verts[v].panning) {
                    verts[v].setPos(verts[v].newx, verts[v].newy, true);
                }
            }
        }
        
    };

    
    this.addBead = function (newbead) {
        // var newbead = new Bead();
        console.log(newbead);
        this.beads.push(newbead);
        this.beadsById[newbead.id] = newbead;
        this.setCount(this.beads.length);
        
    };
    
    this.removeBead = function (bead) {
        delete this.beadsById[bead.id];
        var index = this.beads.indexOf(bead);
        if (index > -1) {
            this.beads.splice(index, 1);
        }
    };
    
    this.applyForce = function () {
        
    };
    
    this.moveBeads = function () {
        // force direct and move beads to their new locations.
        console.log(this.beads);
        setInterval(function() {
            self.force(self.beads);
        }, 15)
    };
    
    
    return this;
};

function _fatal (talert) {
    console.log("FATAL: " + talert);
}

