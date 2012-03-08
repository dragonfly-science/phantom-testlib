/*
 * This library provides some simple functions for doing automated browser
 * testing using PhantomJS. It has tap output
 */

(function(exports) {
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

    var Test = function(base_url) {
        var running = false;
        var page;
        var opt = {
            base_url: null,
            width: 1024,
            height: 768
        };
        var tests = {
            total: 0,
            ok: 0,
            failed: 0
        };
        var queue = [];

        // initialise
        opt.base_url = base_url;

        function proxy(func) {
            return func.apply(this, arguments);
        }

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

        function diag(message, indent) {
            indent = indent || 0;
            indent = Array(1+indent).join("\t");
            message.split(/\r?\n/).forEach(function(line) {
                console.log('# ' + indent + line);
            });
        }

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
        function job_done() {
            running = false;
            run_queue();
        }

        function run_queue() {
            if ( running || queue.length === 0 ) {
                // Nothing needs doing
                return;
            }
            running = true;
            var job = queue.shift();
            try {
                if ( job.is_async ) {
                    job.func.call(this, job_done_factory(job.func));
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

        function queue_async(name, func) {
            func.toString = function() { return name; };
            queue.push({
                is_async: true,
                func: func
            });
            run_queue();
        }

        function queue_sync(name, func) {
            func.toString = function() { return name; };
            queue.push({
                is_async: false,
                func: func
            });
            run_queue();
        }

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

        function page_set_argument(arg) {
            page.evaluate('function() { __testlib_argument = ' + JSON.stringify(arg) + '; }');
        }

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

        function page_open_callback_factory(done) {
            return function() {
                diag('loaded: ' + page_eval(function() { return location.href; }));
                page_eval(function() {
                    $(window).click(function(e) {
                        var link = $(e.target).filter('a');
                        if ( link.length ) {
                            location.href = link.attr('href');
                        }
                    });
                });
                done();
            };
        }

        // Public functions start here

        this.diag = function(message) {
            queue_sync('diag', function() { diag(message); });
        };

        this.open = function(path) {
            queue_async('open', function(done) {
                // TODO - timeouts
                //this.startTimeout('Navigate to ' + url, function() {
                //    this.state.page.onLoadFinished = null;
                //});
                if ( ! page ) {
                    page = require('webpage').create();
                    page.viewportSize = { width: opt.width, height: opt.height };
                    // TODO - console???
                    //// This is a rather coarsely-grained 'verbose' implementation -
                    //// it means you need to set t.state.verbose = true before
                    //// loading a page, then all of the console log messages on that
                    //// page will be emitted. Maybe we can do better in future.
                    //if (this.state.verbose) {
                    //    this.state.page.onConsoleMessage = function(message) {
                    //        console.log('> ' + message);
                    //    };
                    //}
                    page.onConsoleMessage = function(message) {
                        diag('console> ' + message, 1);
                    };
                }

                // Override the page console.log object so we capture all params
                //page.onInitialized = proxy(function() {
                //    page_eval(function() {
                //        (function(old) {
                //            console.log = function() {
                //                old.apply(this, [Array.prototype.slice.call(arguments).join(' ')]);
                //            };
                //        })(console.log);
                //    });
                //});
                page.onLoadFinished = page_open_callback_factory(done);
                page.open(opt.base_url + path);
            });
        };

        this.sleep = function(ms) {
            queue_async('sleep', function(done) {
                console.log('sleeping for ' + ms + 'ms');
                setTimeout(function() { console.log('finished sleeping'); done(); }, ms);
            });
        };

        this.screenshot = function(filename) {
            queue_sync('screenshot', function() {
                page.render(filename);
            });
        };

        this.done = function(cb) {
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

        this.like = function(got, expected, description) {
            queue_sync('like', function() {
                got = page_eval(got);
                ok(expected.test(got), description, got, expected);
            });
        };

        this.is = function(got, expected, description) {
            queue_sync('is', function() {
                got = page_eval(got);
                expected = page_eval(expected);
                ok(got == expected, description, got, expected);
            });
        };

        this.text = function() {
            var args = Array.prototype.slice.call(arguments);
            args.unshift('text');
            return invoke_jquery.apply(this, args);
        };

        this.val = function() {
            var args = Array.prototype.slice.call(arguments);
            args.unshift('val');
            return invoke_jquery.apply(this, args);
        };

        this.click = function() {
            var args = Array.prototype.slice.call(arguments);
            args.unshift('click');
            return invoke_jquery.apply(this, args);
        };

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
