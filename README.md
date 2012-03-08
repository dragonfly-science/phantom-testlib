A library for writing web application tests in javascript.

Provides a procedural interface for writing tests, so you don't have to
grok event based programming. Uses PhantomJS to provide a webkit-based
headless browser to run your tests against.

Synopsis
--------

    phantom.injectJs('testlib.js');
    var t = new Test('https://github.com');
    t.open('/');
    t.is(t.text('title'), 'GitHub · Social Coding', 'Homepage loaded');
    t.done();

Installation
------------

1. Clone this repository
2. Install PhantomJS:

    <pre># Ubuntu instructions
    sudo add-apt-repository ppa:jerome-etienne/neoip
    sudo apt-get update
    sudo apt-get install phantomjs
    # See http://code.google.com/p/phantomjs/wiki/Installation for more</pre>

3. Test:

    phantomjs github-test.js

Notes
-----

It's early days for this project, feel free to contribute.

For now (a temporary restriction), the page you are testing must have JQuery
loaded. We'll work around this shortly.

Legal
-----

(C) 2012 Shoptime Software.

This project is licensed under the MIT license.
