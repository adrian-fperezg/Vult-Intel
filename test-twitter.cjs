const { TwitterApi } = require('twitter-api-v2');
const client = new TwitterApi({ appKey: 'USrPcCiMh6BuDnE1WTMjQCq7s', appSecret: '46shR5A7gkJqFMCkNR2IBnVATNtfKCsrXTeLKZ8Z60EU5BNLwq' });
client.generateAuthLink('http://localhost').then(res => console.log(res)).catch(e => console.log(e));
