# codex-test
Testing out openai codex

## Chinese Conversation Practice Webapp

A single-page webapp (`index.html`) lets you practice Chinese conversation using the OpenAI API. Enter your API key and a scenario, click **Go**, and converse with your AI teacher 小王.

### Usage
1. Open `index.html` in your browser.
2. Provide your OpenAI API key and a scenario.
3. Click **Go** to begin. The teacher speaks first. After each response, click **Record** to answer.
4. Click **Stop** at any time to end the conversation.

All requests are made directly from the browser, so your API key is never sent anywhere except the OpenAI API.
Your key is saved in your browser's localStorage so it will be there next time you open the page.
