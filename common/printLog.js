
const print = (...args) => {
  console.log(new Date().toISOString(), ...args);
};

module.exports = print;