import { aJsxDirective2, createElement, useState as _useState } from './angular-jsx-react';
const useState = _useState;

import { JSDOM } from "jsdom";
const { window } = new JSDOM(`
<html>
<head>
</head>
<body>
</body>
</html>
`, {
    url: "https://example.org/",
    referrer: "https://example.com/",
    contentType: "text/html",
});

// happy-dom is only used to mock DOM in node
(globalThis as any).window = window;
(globalThis as any).document = window.document;
(globalThis as any).Node = window.Node;
(globalThis as any).createElement = createElement;
import 'angular/angular';

const angular = window.angular;

async function updateName(name: string) {
    return new Promise((r) => {
        setTimeout(r, 500);
    })
}

function UpdateName({}) {
  const [name, setName] = useState("test");
  const [error, setError] = useState(null);
  const [isPending, setIsPending] = useState(false);

  const handleSubmit = async () => {
    console.log('handleSubmit');
    setIsPending(true);
    const error = await updateName(name);
    setIsPending(false);
    if (error) {
      setError(error);
      return;
    }
  };

  return (
    <div>
      <input value={name} onChange={(event) => setName(event.target.value)} />
      <button onClick={handleSubmit} disabled={isPending}>
        Update
      </button>
      {error && <p>{error}</p>}
    </div>
  );
}

const app = angular.module('app', []);

app.directive('updateName', aJsxDirective2(UpdateName));

var injector = angular.injector(['ng', 'app']);

const $compile = injector.get('$compile');
const $rootScope = injector.get('$rootScope');

var element = $compile("<update-name></update-name>")($rootScope);
// fire all the watches, so the scope expression {{1 + 1}} will be evaluated
$rootScope.$digest();
element.find('input')[0].value = 'test change';
console.log(element.find('button')[0].click());


