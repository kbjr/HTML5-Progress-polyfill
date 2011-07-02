/*
 * <progress> polyfill
 * You may need to change
 * @author Lea Verou
 */
 
(function(){

// The location of the polyfill stylesheet
var CSS_FILE = 'progress-polyfill.css';

// Test browser support first
if('position' in document.createElement('progress')) {
	return;
}

// Load the progress-polyfill.css file dynamically only
// if needed for the polyfill
var cssElem = document.createElement('link');
cssElem.rel = 'stylesheet';
cssElem.type = 'text/css';
cssElem.href = CSS_FILE;
document.getElementsByTagName('head')[0].appendChild(cssElem);

/**
 * Private functions
 */

// Smoothen out differences between Object.defineProperty
// and __defineGetter__/__defineSetter__
var defineProperty = Object.defineProperty,
	supportsEtters = true;
	
if (!defineProperty) {
	if ('__defineSetter__' in document.body) {
		defineProperty = function(o, property, etters) {
			o.__defineGetter__(property, etters.get);
			
			if(etters.set) {
				o.__defineSetter__(property, etters.set);
			}
		};
	}
	else {
		// Fallback to regular properties if getters/setters are not supported
		defineProperty = function(o, property, etters) {
				o[property] = etters.get();
			},
			supportsEtters = false;
	}
}

// Get a function arr() for casting NodeList to Array
try {
	[].slice.apply(document.images)
	
	var arr = function(collection) {
		return [].slice.apply(collection);
	}
} catch(e) {
	var arr = function(collection) {
		var ret = [], len = collection.length;
		
		for(var i=0; i<len; i++) {
			ret[i] = collection[i];
		}
		
		return ret;
	}
}

// Does the browser use attributes as properties? (IE8- bug)
var attrsAsProps = (function(){
	var e = document.createElement('div');
	e.foo = 'bar';
	return e.getAttribute('foo') === 'bar';
})();

// Parses an outerHTML string to get the attributes section
// of a progress tag and allows selecting individual attributes
var getAttr = (function() {
	var
	regexes = { },
	getAttributes = /<progress([^>]+)/;
	return function(elem, attr) {
		if (elem.outerHTML) {
			var attrs = getAttributes.exec(elem.outerHTML);
			if (attrs) {
				attrs = attrs[1];
				if (! regexes[attr]) {
					regexes[attr] = new RegExp('/\\s+' + attr + '=(.+)(\\s|$)/');
				}
				var value = regexes[attr].exec(attrs);
				console.log(elem.id, attrs)
				if (value) {
					value = value[1];
					if (value.charAt(0) === '"' || value.charAt(0) === "'") {
						value = value.substring(0, value.length - 1);
					}
				}
				return value;
			}
		}
	};
}());

var self = window.ProgressPolyfill = {
	DOMInterface: {
		max: {
			get: function(){
				return parseFloat(this.getAttribute('aria-valuemax')) || 1;
			},
			
			set: function(value) {
				this.setAttribute('aria-valuemax', value);

				if(!attrsAsProps) {
					this.setAttribute('max', value);
				}
				
				self.redraw(this);
			}
		},
		
		value: {
			get: function(){
				return parseFloat(this.getAttribute('aria-valuenow')) || 0;
			},
			
			set: function(value) {
				this.setAttribute('aria-valuenow', value);
				
				if(!attrsAsProps) {
					this.setAttribute('value', value);
				}
				
				self.redraw(this);
			}
		},
		
		position: {
			get: function(){
				return this.hasAttribute('aria-valuenow')? this.value/this.max : -1;
			}
		},
		
		labels: {
			get: function(){
				var label = this.parentNode;
				
				while(label && label.nodeName !== 'LABEL') {
					label = label.parentNode;
				}
				
				var labels = label? [label] : [];
				
				if(this.id && document.querySelectorAll) {
					var forLabels = arr(document.querySelectorAll('label[for="' + this.id + '"]'));
					
					if(forLabels.length) {
						labels = labels.concat(forLabels);
					}
				}
				
				return labels;
			}
		}
	},
	
	redraw: function redraw(progress) {
		if(self.isInited(progress)) {
			self.init(progress);
		}
		else if(!attrsAsProps) {
			progress.setAttribute('aria-valuemax', parseFloat(progress.getAttribute('max')) || 1);
			
			if(progress.hasAttribute('value')) {
				progress.setAttribute('aria-valuenow', parseFloat(progress.getAttribute('value')) || 0);
			}
			else {
				progress.removeAttribute('aria-valuenow');
			}
		}
		    
		if(progress.position !== -1) {
		   progress.style.paddingRight = progress.offsetWidth * (1-progress.position) + 'px';
		}
	},
	
	isInited: function(progress) {
		return progress.getAttribute('role') === 'progressbar';
	},
	
	init: function (progress) {
		if(self.isInited(progress)) {
			return; // Already init-ed
		}

		// Add ARIA
		progress.setAttribute('role', 'progressbar');
		progress.setAttribute('aria-valuemin', '0');
		progress.setAttribute('aria-valuemax', parseFloat(progress.getAttribute('max')) || 1);
		
		if(progress.hasAttribute('value')) {
			progress.setAttribute('aria-valuenow', parseFloat(progress.getAttribute('value')) || 0);
		}
		
		// We can't add them on a prototype, as it's the same for all unknown elements
		for(var attribute in self.DOMInterface) {
			defineProperty(progress, attribute, {
				get: self.DOMInterface[attribute].get,
				set: self.DOMInterface[attribute].set
			});
		}

		// Fix getAttribute in IE
		try {
			progress.getAttribute = function(attr) {
				var value = progress.constructor.prototype.getAttribute.call(progress, attr);
				if (value === null && (attr === 'max' || attr === 'value')) {
					var fromOuter = getAttr(progress, attr);
					if (fromOuter) {
						return fromOuter;
					}
				}
				return value;
			}
			progress.getAttribute.toString = function() {
				progress.constructor.prototype.getAttribute + '';
			}
		} catch (e) { }
		
		self.redraw(progress);
	},
	
	// Live NodeList, will update automatically
	progresses: document.getElementsByTagName('progress')
};

for(var i=self.progresses.length-1; i>=0; i--) {
	self.init(self.progresses[i]);
}

// Take care of future ones too, if supported
if(document.addEventListener) {
	document.addEventListener('DOMAttrModified', function(evt) {
		var node = evt.target, attribute = evt.attrName;
		
		if(node.nodeName === 'PROGRESS' && (attribute === 'max' || attribute === 'value')) {
			self.redraw(node);
		}
	}, false);
	
	document.addEventListener('DOMNodeInserted', function(evt) {
		var node = evt.target;
		
		if(node.nodeName === 'PROGRESS') {
			self.init(node);
		}
	}, false);
}

})();
