const { TwitterApi } = require('twitter-api-v2');
const client = new TwitterApi({ appKey: 'test', appSecret: 'test' });
client.generateAuthLink('http://localhost').then(res => console.log(res)).catch(e => console.log(e));
