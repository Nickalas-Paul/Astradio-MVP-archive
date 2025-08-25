const fs = require("fs");
const path = require("path");

async function getPlanets() {
  const filePath = path.join(__dirname, "../data/sample.json");
  const raw = fs.readFileSync(filePath);
  return JSON.parse(raw);
}

module.exports = { getPlanets };
