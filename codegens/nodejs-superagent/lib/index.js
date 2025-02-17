const { convert, getOptions } = require('./superagent'),
  mainCollection = require('../test/unit/fixtures/testcollection/collection.json'),
  sdk = require('postman-collection');
const request = new sdk.Request(mainCollection.item[0].request);

// console.log(JSON.stringify(request));

console.log(convert(request, {
  // indentType: 'Tab',
  // indentCount: 1
}, function (error, snippet) {
  if (error) {
    expect.fail(null, null, error);
    return;
  }
  console.log(snippet);
}));

module.exports = {
  convert: require('./superagent').convert,
  getOptions: require('./superagent').getOptions
};
