phantom.injectJs('testlib.js');

var t = new Test('https://github.com');

t.open('/');
t.is(t.text('title'), 'GitHub · Social Coding', 'Homepage loaded');

//t.click_and_wait('li.explore a');
//t.is(t.text('title'), 'Explore · GitHub', 'Explore page title correct');

t.open('/search');

t.diag('Searching for phantom-testlib');
t.val('[name=q]', 'phantom-testlib');
t.val('#type_value', 'Repositories');
t.click_and_wait('button:submit');

t.is(t.text('.header .title'), 'Repositories (1)', 'Exactly one match in search results');

t.click_and_wait('.results a:eq(0)');

t.is(t.text('.title-actions-bar h1 span:eq(0)'), 'shoptime', 'Repo is owned by Shoptime');

t.done();
