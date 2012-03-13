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
2. Either install PhantomJS from the repository (Ubuntu natty, maverick)

    <pre>sudo add-apt-repository ppa:jerome-etienne/neoip
    sudo apt-get update
    sudo apt-get install phantomjs</pre>

3. Or build PhantomJS from source 


    <pre>sudo apt-get install libqt4-dev qt4-qmake
    git clone git://github.com/ariya/phantomjs.git && cd phantomjs
    git checkout 1.4
    qmake-qt4 && make
    sudo ln -s  $(pwd)/bin/phantomjs /usr/local/bin/phantomjs</pre>
    
3. Test:

    
    <pre>phantomjs github-test.js</pre>

Notes
-----

It's early days for this project, feel free to contribute.

For now (a temporary restriction), the page you are testing must have JQuery
loaded. We'll work around this shortly.

Legal
-----

(C) 2012 Shoptime Software.

This project is licensed under the MIT license.
