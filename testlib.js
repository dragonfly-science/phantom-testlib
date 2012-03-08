/*
 * This library provides some simple functions for doing automated browser
 * testing using PhantomJS. It has tap output
 */

(function(exports) {

    /**
     * Represents a value that will eventually be set.
     * @class
     * @private
     */
    var Promise = function() {
        var resolved = false, value;
        this.__defineGetter__('resolved', function() {
            return resolved;
        });
        this.__defineGetter__('value', function() {
            if ( ! resolved ) {
                throw "Unresolved promise queried";
            }
            return value;
        });
        this.__defineSetter__('value', function(val) {
            resolved = true;
            value = val;
        });
    };

    /**
     * A library for writing web application tests in javascript.
     *
     * Provides a procedural interface for writing tests, so you don't have to
     * grok event based programming. Uses PhantomJS to provide a webkit-based
     * headless browser to run your tests against.
     *
     * Synopsis:
     * <pre>phantom.injectJs('testlib.js');
     * var t = new Test('https://github.com');
     * t.open('/');
     * t.is(t.text('title'), 'GitHub · Social Coding', 'Homepage loaded');
     * t.done();</pre>
     *
     * @param {String} base_url The base URL that all {@link #open} calls will be relative to.
     * @class
     */
    var Test = function(base_url) {
        var running = false;
        var page;
        var opt = {
            base_url: null,
            width: 1024,
            height: 768,
            timeout: 10000
        };
        var tests = {
            total: 0,
            ok: 0,
            failed: 0
        };
        var queue = [];

        // initialise
        opt.base_url = base_url;

        /** @private */
        function proxy(func) {
            var self = this;
            return function() { return func.apply(self, arguments); };
        }

        /** @private */
        function ok(success, description, got, expected) {
            var n = ++tests.total;
            if ( success ) {
                console.log('ok ' + n + ' ' + description);
                tests.ok++;
            }
            else {
                console.log('not ok ' + n + ' ' + description);
                if ( arguments.length == 4 ) {
                    diag("Got: " + got + "\nExpected: " + expected, 1);
                }
                tests.failed++;
            }
        }

        /** @private */
        function diag(message, indent) {
            indent = indent || 0;
            indent = Array(1+indent).join("\t");
            message.split(/\r?\n/).forEach(function(line) {
                console.log('# ' + indent + line);
            });
        }

        /** @private */
        function job_done_factory(source) {
            var done = false;
            return function() {
                if ( done ) {
                    // We will not be done twice!
                    return;
                }
                //console.log('job done: ' + source);
                running = false;
                done = true;
                setTimeout(run_queue, 0);
            };
        }

        /** @private */
        function run_queue() {
            if ( running || queue.length === 0 ) {
                // Nothing needs doing
                return;
            }
            running = true;
            var job = queue.shift();
            try {
                if ( job.is_async ) {
                    var done = job_done_factory(job.func);
                    var timeout = setTimeout(function() {
                        ok(false, job.func + ' timed out');
                        done();
                    }, opt.timeout);
                    job.func.call(this, function() {
                        clearTimeout(timeout);
                        done();
                    });
                }
                else {
                    job.func.call(this);
                    setTimeout(job_done_factory(job.func), 0);
                }
            }
            catch(e) {
                console.log('Internal error: ' + e);
                phantom.exit(127);
            }
        }

        /** @private */
        function queue_async(name, func) {
            /** @ignore */
            func.toString = function() { return name; };
            queue.push({
                is_async: true,
                func: func
            });
            run_queue();
        }

        /** @private */
        function queue_sync(name, func) {
            /** @ignore */
            func.toString = function() { return name; };
            queue.push({
                is_async: false,
                func: func
            });
            run_queue();
        }

        /** @private */
        function page_eval(arg) {
            if ( typeof(arg) === 'function' ) {
                return page.evaluate(arg);
            }
            if ( arg instanceof Promise ) {
                return arg.value;
            }
            if ( typeof(arg) === 'string' ) {
                return arg;
            }
            throw "Can't page_eval type: " + typeof(arg);
        }

        /** @private */
        function page_set_argument(arg) {
            page.evaluate('function() { __testlib_argument = ' + JSON.stringify(arg) + '; }');
        }

        /** @private */
        function invoke_jquery() {
            var promise = new Promise();
            var args = Array.prototype.slice.call(arguments);
            var method = args.shift();
            var selector = args.shift();

            queue_sync('invoke_jquery', function() {
                page_set_argument({
                    selector: selector,
                    method: method,
                    args: args
                });
                promise.value = page_eval(function() {
                    var arg = __testlib_argument;
                    var obj = $(arg.selector);
                    var ret = obj[arg.method].apply(obj, arg.args);
                    if ( ret instanceof $ ) {
                        return null;
                    }
                    return ret;
                });
            });

            return promise;
        }

        /** @private */
        function page_open_callback_factory(done) {
            return function() {
                diag('loaded: ' + page_eval(function() { return location.href; }));
                page_eval(function() {
                    $(window).click(function(e) {
                        var link = $(e.target).filter('a');
                        if ( link.length ) {
                            location = link.prop('href');
                        }
                    });
                });
                done();
            };
        }

        // Public functions start here

        /**
         * Set a configuration value. Available settings:
         *
         * <dl>
         *   <dt><tt>timeout</tt></dt>
         *   <dd>The timeout for calls that wait for an event to be completed in milliseconds, e.g. {#open}. Default 10 seconds</dd>
         *   <dt><tt>width</tt></dt>
         *   <dd>The width of the browser window</dd>
         *   <dt><tt>height</tt></dt>
         *   <dd>The height of the browser window</dd>
         * </dl>
         *
         * <pre>t.set('timeout', 30000);
         * t.open('/a_sloooooow_page');
         * t.set('timeout', 10000); // put it back once we're done</pre>
         *
         * @param {String} key
         * @param value
         */
        this.set = function(key, value) {
            queue_sync('set', function() { opt[key] = value; });
        };

        /**
         * Dumps a message into the test output, in a TAP-compatible fashion.
         *
         * @param {String} message The message to dump.
         */
        this.diag = function(message) {
            queue_sync('diag', function() { diag(message); });
        };

        /**
         * Navigates to the given path. The path is considered relative to the
         * <tt>base_url</tt> you set when creating the test object.
         *
         * @param {String} path The path to navigate to.
         */
        this.open = function(path) {
            queue_async('open', function(done) {
                if ( ! page ) {
                    page = require('webpage').create();
                    page.viewportSize = { width: opt.width, height: opt.height };
                    /** @ignore */
                    page.onConsoleMessage = function(message) {
                        diag('console> ' + message, 1);
                    };
                }

                // Override the page console.log object so we capture all params
                page.onInitialized = proxy(function() {
                   page_eval(function() {
                       (function(old) {
                           /** @ignore */
                           console.log = function() {
                               old.apply(this, [Array.prototype.slice.call(arguments).join(' ')]);
                           };
                       })(console.log);
                   });
                });
                page.onLoadFinished = page_open_callback_factory(done);
                page.open(opt.base_url + path);
            });
        };

        /**
         * Pauses the test execution.
         *
         * Note that this has many legitimate uses, but you shouldn't use it if
         * there is a 'wait' method available that can do the job for you, as
         * they return as soon as the event they're waiting for has happened.
         *
         * <pre>t.sleep(1000); // sleep for a second</pre>
         *
         * @param {Integer} ms How many milliseconds to sleep for.
         */
        this.sleep = function(ms) {
            queue_async('sleep', function(done) {
                console.log('sleeping for ' + ms + 'ms');
                setTimeout(function() { console.log('finished sleeping'); done(); }, ms);
            });
        };

        /**
         * Takes a screenshot.
         *
         * The file type of the screenshot is determined by the extension you
         * use. Supported formats are PNG, JPEG and PDF.
         *
         * <pre>t.screenshot('wat.png');</pre>
         *
         * @param {String} filename
         */
        this.screenshot = function(filename) {
            queue_sync('screenshot', function() {
                page.render(filename);
            });
        };

        /**
         * Tell the testlib that you are done with your tests.
         *
         * This will output a TAP summary of the tests run, and exit. Calling
         * this lets TAP parsers know that your script finished (as opposed to
         * crashing), so make sure you call it.
         */
        this.done = function() {
            queue_async('done', function(done) {
                var exit_code = 0;
                if ( tests.total ) {
                    console.log('1..' + tests.total);
                    if ( tests.failed ) {
                        diag('Looks like you failed ' + tests.failed + ' test(s) of ' + tests.total + '.');
                        exit_code = 1;
                    }
                }
                else {
                    console.log('1..0');
                    diag('No tests run!');
                }

                page.release();
                phantom.exit(exit_code);
            });
        };

        /**
         * Check that the one value matches a regular expression.
         *
         * Typically, you would call this method like so:
         *
         * <pre>t.like(t.text('title'), /Title/, 'Page title contains "Title"');</pre>
         *
         * @param got The value to check - typically you should use the result
         *            of a call to {@link #text}, {@link #val}, {@link #attr}
         *            or similar here.
         * @param expected The regex this value should match.
         * @param {String} description The test description.
         */
        this.like = function(got, expected, description) {
            queue_sync('like', function() {
                got = page_eval(got);
                ok(expected.test(got), description, got, expected);
            });
        };

        /**
         * Check that the one value matches another.
         *
         * Typically, you would call this method like so:
         *
         * <pre>t.is(t.text('title'), 'My Title', 'Page title is correct');</pre>
         *
         * @param got The value to check - typically you should use the result
         *            of a call to {@link #text}, {@link #val}, {@link #attr}
         *            or similar here.
         * @param expected The value you expect. Will be compared using ==.
         * @param {String} description The test description.
         */
        this.is = function(got, expected, description) {
            queue_sync('is', function() {
                got = page_eval(got);
                expected = page_eval(expected);
                ok(got == expected, description, got, expected);
            });
        };

        /**
         * Returns the <tt>textContent</tt> of the element(s) matching the
         * given selector.
         *
         * @param {String} selector The element(s) to get the text content of.
         */
        this.text = function() {
            var args = Array.prototype.slice.call(arguments);
            args.unshift('text');
            return invoke_jquery.apply(this, args);
        };

        /**
         * Returns - or sets - the <tt>value</tt> of the element(s) matching
         * the given selector.
         *
         * This is most useful for form elements:
         *
         * <pre>t.val('#myform input[name="firstname"]', 'waawaamilk');  // set first name
         * t.is(t.val('#myform input[name="firstname"]'), 'waawaamilk', 'First name set correctly');</pre>
         *
         * @param {String} selector The element(s) to get the value of.
         */
        this.val = function() {
            var args = Array.prototype.slice.call(arguments);
            args.unshift('val');
            return invoke_jquery.apply(this, args);
        };

        /**
         * Sends a click event to the element matching the given selector.
         *
         * If the element is a link, it will be followed, and if the element
         * triggers a form submission, the form will be submitted. If you're
         * expecting the click to take the browser to another page, consider
         * using {@link #click_and_wait} instead.
         *
         * @param {String} selector The element to click on.
         */
        this.click = function() {
            var args = Array.prototype.slice.call(arguments);
            args.unshift('click');
            return invoke_jquery.apply(this, args);
        };

        /**
         * Sends a click event to the element matching the given selector, then
         * waits for a page load to occur.
         *
         * @param {String} selector The element to click on.
         */
        this.click_and_wait = function() {
            var args = Array.prototype.slice.call(arguments);
            args.unshift('click');
            invoke_jquery.apply(this, args);
            queue_async('click_and_wait', function(done) {
                page.onLoadFinished = page_open_callback_factory(done);
            });
        };
    };

    exports.Promise = Promise;
    exports.Test = Test;
})(this);
