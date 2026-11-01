'use strict';

const warning = function (condition, format, ...args) {
  if (!condition && typeof console !== 'undefined' && console.warn) {
    if (format) {
      let index = 0;
      const message = 'Warning: ' + format.replace(/%s/g, () => args[index++]);
      console.warn(message);
    }
  }
};

module.exports = warning;
module.exports.default = warning;

